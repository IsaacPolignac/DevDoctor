//! Structured process execution.
//!
//! DevDoctor never builds shell command strings. Every external program is started with an
//! explicit argument vector, a timeout and (optionally) a controlled environment. The
//! [`CommandRunner`] trait lets tests substitute canned outputs.

use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

pub const DEFAULT_TIMEOUT_MS: u64 = 10_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandSpec {
    pub program: String,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    /// Start from an empty environment (plus `env`) instead of inheriting the process env.
    pub clear_env: bool,
    pub cwd: Option<PathBuf>,
    pub timeout_ms: u64,
}

impl CommandSpec {
    pub fn new(program: impl Into<String>) -> Self {
        Self { program: program.into(), args: Vec::new(), env: Vec::new(), clear_env: false, cwd: None, timeout_ms: DEFAULT_TIMEOUT_MS }
    }

    pub fn arg(mut self, arg: impl Into<String>) -> Self {
        self.args.push(arg.into());
        self
    }

    pub fn args<I, S>(mut self, args: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.args.extend(args.into_iter().map(Into::into));
        self
    }

    pub fn env(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env.push((key.into(), value.into()));
        self
    }

    pub fn clear_env(mut self) -> Self {
        self.clear_env = true;
        self
    }

    pub fn cwd(mut self, dir: impl Into<PathBuf>) -> Self {
        self.cwd = Some(dir.into());
        self
    }

    pub fn timeout_ms(mut self, ms: u64) -> Self {
        self.timeout_ms = ms;
        self
    }

    /// Display form for logs and previews (arguments are quoted when they contain spaces).
    pub fn display(&self) -> String {
        let mut parts = vec![self.program.clone()];
        for a in &self.args {
            if a.contains(char::is_whitespace) || a.is_empty() {
                parts.push(format!("{a:?}"));
            } else {
                parts.push(a.clone());
            }
        }
        parts.join(" ")
    }

    pub fn program_name(&self) -> String {
        std::path::Path::new(&self.program).file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| self.program.clone())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CommandOutput {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub timed_out: bool,
}

impl CommandOutput {
    pub fn success(&self) -> bool {
        !self.timed_out && self.exit_code == Some(0)
    }

    pub fn ok(stdout: impl Into<String>) -> Self {
        Self { exit_code: Some(0), stdout: stdout.into(), ..Default::default() }
    }

    pub fn failed(code: i32, stderr: impl Into<String>) -> Self {
        Self { exit_code: Some(code), stderr: stderr.into(), ..Default::default() }
    }
}

pub trait CommandRunner: Send + Sync {
    fn run(&self, spec: &CommandSpec) -> Result<CommandOutput>;
}

/// Runs real processes with a hard timeout.
#[derive(Debug, Default)]
pub struct RealRunner;

impl CommandRunner for RealRunner {
    fn run(&self, spec: &CommandSpec) -> Result<CommandOutput> {
        let mut cmd = Command::new(&spec.program);
        cmd.args(&spec.args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
        if spec.clear_env {
            cmd.env_clear();
        }
        for (k, v) in &spec.env {
            cmd.env(k, v);
        }
        if let Some(cwd) = &spec.cwd {
            cmd.current_dir(cwd);
        }
        let start = Instant::now();
        let mut child = cmd.spawn().map_err(|e| Error::Command { program: spec.program.clone(), reason: e.to_string() })?;
        let mut stdout = child.stdout.take();
        let mut stderr = child.stderr.take();
        let out_thread = std::thread::spawn(move || {
            let mut buf = Vec::new();
            if let Some(s) = stdout.as_mut() {
                let _ = s.read_to_end(&mut buf);
            }
            buf
        });
        let err_thread = std::thread::spawn(move || {
            let mut buf = Vec::new();
            if let Some(s) = stderr.as_mut() {
                let _ = s.read_to_end(&mut buf);
            }
            buf
        });
        let timeout = Duration::from_millis(spec.timeout_ms.max(1));
        let mut timed_out = false;
        let status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break Some(status),
                Ok(None) => {
                    if start.elapsed() >= timeout {
                        timed_out = true;
                        let _ = child.kill();
                        let _ = child.wait();
                        break None;
                    }
                    std::thread::sleep(Duration::from_millis(5));
                }
                Err(e) => {
                    return Err(Error::Command { program: spec.program.clone(), reason: e.to_string() });
                }
            }
        };
        let stdout = out_thread.join().unwrap_or_default();
        let stderr = err_thread.join().unwrap_or_default();
        let duration_ms = start.elapsed().as_millis() as u64;
        if timed_out {
            tracing::warn!(program = %spec.program, timeout_ms = spec.timeout_ms, "command timed out");
        }
        Ok(CommandOutput {
            exit_code: status.and_then(|s| s.code()),
            stdout: String::from_utf8_lossy(&stdout).into_owned(),
            stderr: String::from_utf8_lossy(&stderr).into_owned(),
            duration_ms,
            timed_out,
        })
    }
}

/// Canned responses for tests. Responses are matched on the program's base name and,
/// optionally, on a substring that must appear in the joined argument list.
#[derive(Default)]
pub struct MockRunner {
    responses: Mutex<Vec<(String, Option<String>, CommandOutput)>>,
    calls: Mutex<Vec<CommandSpec>>,
}

impl MockRunner {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn respond(&self, program: &str, output: CommandOutput) {
        self.responses.lock().expect("mock lock").push((program.to_string(), None, output));
    }

    pub fn respond_when(&self, program: &str, args_contain: &str, output: CommandOutput) {
        self.responses.lock().expect("mock lock").push((program.to_string(), Some(args_contain.to_string()), output));
    }

    pub fn calls(&self) -> Vec<CommandSpec> {
        self.calls.lock().expect("mock lock").clone()
    }

    pub fn call_count(&self, program: &str) -> usize {
        self.calls().iter().filter(|c| c.program_name() == program).count()
    }
}

impl CommandRunner for MockRunner {
    fn run(&self, spec: &CommandSpec) -> Result<CommandOutput> {
        self.calls.lock().expect("mock lock").push(spec.clone());
        let name = spec.program_name();
        let joined = spec.args.join(" ");
        let responses = self.responses.lock().expect("mock lock");
        // Most specific match first: entries with an argument filter win over generic ones.
        let specific = responses.iter().rfind(|(p, a, _)| p == &name && a.as_ref().is_some_and(|needle| joined.contains(needle.as_str())));
        let generic = responses.iter().rfind(|(p, a, _)| p == &name && a.is_none());
        match specific.or(generic) {
            Some((_, _, out)) => Ok(out.clone()),
            None => Err(Error::Command { program: spec.program.clone(), reason: "no mock response configured".into() }),
        }
    }
}

/// Small helper used by inventories to memoise `--version` calls within a scan.
#[derive(Default)]
pub struct VersionCache {
    inner: Mutex<HashMap<PathBuf, Option<String>>>,
}

impl VersionCache {
    pub fn get_or_insert_with(&self, key: &PathBuf, f: impl FnOnce() -> Option<String>) -> Option<String> {
        if let Some(v) = self.inner.lock().expect("cache lock").get(key) {
            return v.clone();
        }
        let v = f();
        self.inner.lock().expect("cache lock").insert(key.clone(), v.clone());
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn real_runner_captures_output() {
        let out = RealRunner.run(&CommandSpec::new("/bin/echo").arg("hello")).expect("echo runs");
        assert!(out.success());
        assert_eq!(out.stdout.trim(), "hello");
    }

    #[test]
    fn real_runner_times_out() {
        let out = RealRunner.run(&CommandSpec::new("/bin/sleep").arg("5").timeout_ms(100)).expect("spawns");
        assert!(out.timed_out);
        assert!(!out.success());
    }

    #[test]
    fn mock_runner_matches_specific_first() {
        let m = MockRunner::new();
        m.respond("brew", CommandOutput::ok("generic"));
        m.respond_when("brew", "--prefix", CommandOutput::ok("/opt/homebrew"));
        let a = m.run(&CommandSpec::new("/opt/homebrew/bin/brew").arg("--prefix")).unwrap();
        assert_eq!(a.stdout, "/opt/homebrew");
        let b = m.run(&CommandSpec::new("brew").arg("list")).unwrap();
        assert_eq!(b.stdout, "generic");
        assert_eq!(m.call_count("brew"), 2);
    }
}
