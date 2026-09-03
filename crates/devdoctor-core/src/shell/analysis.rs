//! Multi-file analysis of a user's shell startup configuration.

use super::parser::{parse_shell_file, ParseWarning, Statement, StatementKind};
use super::path_model::{extract_path_mutation, PathMutation};
use crate::fs_util;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ShellKind {
    Zsh,
    Bash,
    Fish,
    Sh,
    Other,
}

impl ShellKind {
    pub fn from_path(path: &Path) -> Self {
        match path.file_name().and_then(|n| n.to_str()).unwrap_or("") {
            "zsh" => ShellKind::Zsh,
            "bash" => ShellKind::Bash,
            "fish" => ShellKind::Fish,
            "sh" | "dash" => ShellKind::Sh,
            _ => ShellKind::Other,
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            ShellKind::Zsh => "zsh",
            ShellKind::Bash => "bash",
            ShellKind::Fish => "fish",
            ShellKind::Sh => "sh",
            ShellKind::Other => "unknown",
        }
    }
}

/// Startup files in the order a login + interactive shell reads them.
pub fn startup_files(shell: ShellKind, home: &Path) -> Vec<(PathBuf, &'static str)> {
    match shell {
        ShellKind::Zsh => vec![
            (home.join(".zshenv"), "env"),
            (home.join(".zprofile"), "profile"),
            (home.join(".zshrc"), "rc"),
            (home.join(".zlogin"), "login"),
        ],
        ShellKind::Bash => vec![
            (home.join(".bash_profile"), "profile"),
            (home.join(".bash_login"), "profile"),
            (home.join(".profile"), "profile"),
            (home.join(".bashrc"), "rc"),
        ],
        _ => vec![(home.join(".profile"), "profile")],
    }
}

/// Files DevDoctor inspects for a shell even though other shells may also read them.
pub fn all_known_startup_files(home: &Path) -> Vec<(PathBuf, &'static str)> {
    let mut v = startup_files(ShellKind::Zsh, home);
    v.extend(startup_files(ShellKind::Bash, home));
    v
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellConfigFile {
    pub path: PathBuf,
    pub role: String,
    pub exists: bool,
    #[serde(skip)]
    pub content: Option<String>,
    #[serde(skip)]
    pub statements: Vec<Statement>,
    pub warnings: Vec<ParseWarning>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
    pub size: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mtime: Option<i64>,
    pub statement_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceRef {
    pub file: PathBuf,
    pub line: u32,
    pub raw: String,
    pub target_raw: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expanded: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exists: Option<bool>,
    pub guarded: bool,
    pub conditional: bool,
    pub in_function: bool,
    pub exclusive_line: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AliasDef {
    pub file: PathBuf,
    pub line: u32,
    pub name: String,
    pub value_raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalRef {
    pub file: PathBuf,
    pub line: u32,
    pub command: String,
    pub conditional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VarAssignment {
    pub file: PathBuf,
    pub line: u32,
    pub name: String,
    pub value_raw: String,
    pub exported: bool,
    pub conditional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellAnalysis {
    pub shell: ShellKind,
    pub files: Vec<ShellConfigFile>,
    /// PATH mutations in evaluation order across files.
    pub mutations: Vec<PathMutation>,
    pub sources: Vec<SourceRef>,
    pub aliases: Vec<AliasDef>,
    pub evals: Vec<EvalRef>,
    pub assignments: Vec<VarAssignment>,
    /// Variables known statically (seeded from the login shell capture, updated by the files).
    pub vars: BTreeMap<String, String>,
    /// PATH before any user file runs (launchd default plus `path_helper`).
    pub initial_path: Vec<String>,
}

impl ShellAnalysis {
    pub fn file(&self, path: &Path) -> Option<&ShellConfigFile> {
        self.files.iter().find(|f| f.path == path)
    }

    pub fn contents(&self) -> BTreeMap<PathBuf, String> {
        self.files.iter().filter_map(|f| f.content.clone().map(|c| (f.path.clone(), c))).collect()
    }

    pub fn expand(&self, text: &str) -> Option<String> {
        expand_text(text, &self.vars)
    }
}

/// Expands `~`, `$VAR`, `${VAR}` and `${VAR:-default}` using `vars`. Returns `None` when the text
/// contains command substitution or an unknown variable.
pub fn expand_text(text: &str, vars: &BTreeMap<String, String>) -> Option<String> {
    if text.contains("$(") || text.contains('`') {
        return None;
    }
    let home = vars.get("HOME").cloned().unwrap_or_default();
    let mut s = text.to_string();
    if s == "~" {
        s = home.clone();
    } else if let Some(rest) = s.strip_prefix("~/") {
        s = format!("{home}/{rest}");
    }
    let mut out = String::new();
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] != '$' {
            out.push(chars[i]);
            i += 1;
            continue;
        }
        // ${...}
        if i + 1 < chars.len() && chars[i + 1] == '{' {
            let close = chars[i + 2..].iter().position(|c| *c == '}')? + i + 2;
            let inner: String = chars[i + 2..close].iter().collect();
            let (name, default) = match inner.find(":-").or_else(|| inner.find('-')) {
                Some(pos) => {
                    let (n, d) = inner.split_at(pos);
                    let d = d.strip_prefix(":-").or_else(|| d.strip_prefix('-')).unwrap_or("");
                    (n.to_string(), Some(d.to_string()))
                }
                None => (inner.clone(), None),
            };
            if !name.chars().all(|c| c.is_alphanumeric() || c == '_') {
                return None;
            }
            match vars.get(&name) {
                Some(v) => out.push_str(v),
                None => {
                    let d = default?;
                    out.push_str(&expand_text(&d, vars)?)
                }
            }
            i = close + 1;
            continue;
        }
        // $NAME
        let mut j = i + 1;
        while j < chars.len() && (chars[j].is_alphanumeric() || chars[j] == '_') {
            j += 1;
        }
        if j == i + 1 {
            return None;
        }
        let name: String = chars[i + 1..j].iter().collect();
        out.push_str(vars.get(&name)?);
        i = j;
    }
    Some(out)
}

/// Reads and analyses the startup files of `shell` under `home`.
pub fn analyze(shell: ShellKind, home: &Path, seed_vars: &BTreeMap<String, String>, initial_path: Vec<String>) -> ShellAnalysis {
    let inputs: Vec<(PathBuf, &'static str, Option<String>)> = startup_files(shell, home)
        .into_iter()
        .map(|(path, role)| {
            let content = fs_util::read_to_string_opt(&path).ok().flatten();
            (path, role, content)
        })
        .collect();
    analyze_contents(shell, home, inputs, seed_vars, initial_path)
}

/// Pure analysis over already-read file contents (used by tests and by the fixers when they
/// re-parse fresh content).
pub fn analyze_contents(
    shell: ShellKind,
    home: &Path,
    inputs: Vec<(PathBuf, &'static str, Option<String>)>,
    seed_vars: &BTreeMap<String, String>,
    initial_path: Vec<String>,
) -> ShellAnalysis {
    let mut vars: BTreeMap<String, String> = seed_vars.clone();
    vars.insert("HOME".into(), home.to_string_lossy().into_owned());
    let mut analysis = ShellAnalysis {
        shell,
        files: Vec::new(),
        mutations: Vec::new(),
        sources: Vec::new(),
        aliases: Vec::new(),
        evals: Vec::new(),
        assignments: Vec::new(),
        vars: BTreeMap::new(),
        initial_path,
    };
    for (path, role, content) in inputs {
        let (statements, warnings, sha, size, mtime) = match &content {
            Some(c) => {
                let parsed = parse_shell_file(&path, c);
                let meta = std::fs::symlink_metadata(&path).ok();
                (parsed.statements, parsed.warnings, Some(crate::ids::sha256_hex(c.as_bytes())), c.len() as u64, meta.map(|m| m.mtime()))
            }
            None => (Vec::new(), Vec::new(), None, 0, None),
        };
        for stmt in &statements {
            let expand = |t: &str| expand_text(t, &vars);
            if let Some(m) = extract_path_mutation(stmt, &expand) {
                let mut m = m;
                for c in &mut m.components {
                    if let Some(p) = &c.expanded {
                        c.exists = Some(p.is_dir());
                    }
                }
                analysis.mutations.push(m);
            }
            match &stmt.kind {
                StatementKind::Assign(a) if a.name != "PATH" => {
                    if let Some(v) = &a.value_raw {
                        let text = super::parser::split_words(v).into_iter().map(|w| w.text).collect::<Vec<_>>().join("");
                        analysis.assignments.push(VarAssignment {
                            file: path.clone(),
                            line: stmt.line,
                            name: a.name.clone(),
                            value_raw: v.clone(),
                            exported: a.exported,
                            conditional: stmt.conditional || stmt.in_function,
                        });
                        if !stmt.in_function {
                            if let Some(expanded) = expand_text(&text, &vars) {
                                vars.insert(a.name.clone(), expanded);
                            }
                        }
                    }
                }
                StatementKind::Source { target_raw, guarded } => {
                    let expanded = expand_text(target_raw, &vars).map(|s| fs_util::expand_home(&s, home));
                    let exists = expanded.as_ref().map(|p| p.exists());
                    analysis.sources.push(SourceRef {
                        file: path.clone(),
                        line: stmt.line,
                        raw: stmt.raw.clone(),
                        target_raw: target_raw.clone(),
                        expanded,
                        exists,
                        guarded: *guarded,
                        conditional: stmt.conditional,
                        in_function: stmt.in_function,
                        exclusive_line: stmt.exclusive_line,
                    });
                }
                StatementKind::Alias { name, value_raw } => analysis.aliases.push(AliasDef {
                    file: path.clone(),
                    line: stmt.line,
                    name: name.clone(),
                    value_raw: value_raw.clone(),
                }),
                StatementKind::Eval { command } => analysis.evals.push(EvalRef {
                    file: path.clone(),
                    line: stmt.line,
                    command: command.clone(),
                    conditional: stmt.conditional || stmt.in_function,
                }),
                _ => {}
            }
        }
        analysis.files.push(ShellConfigFile {
            path,
            role: role.to_string(),
            exists: content.is_some(),
            statement_count: statements.len(),
            content,
            statements,
            warnings,
            sha256: sha,
            size,
            mtime,
        });
    }
    analysis.vars = vars;
    analysis
}

#[cfg(test)]
mod tests {
    use super::*;

    fn analysis_for(zshrc: &str) -> ShellAnalysis {
        let home = PathBuf::from("/home/me");
        let mut seed = BTreeMap::new();
        seed.insert("NVM_DIR".to_string(), "/home/me/.nvm".to_string());
        analyze_contents(
            ShellKind::Zsh,
            &home,
            vec![(home.join(".zshrc"), "rc", Some(zshrc.to_string()))],
            &seed,
            vec!["/usr/bin".into(), "/bin".into()],
        )
    }

    #[test]
    fn expands_variables_defined_earlier() {
        let a =
            analysis_for("export PYENV_ROOT=\"$HOME/.pyenv\"\nexport PATH=\"$PYENV_ROOT/bin:$PATH\"\nexport PATH=\"$UNKNOWN/bin:$PATH\"\n");
        assert_eq!(a.mutations.len(), 2);
        assert_eq!(a.mutations[0].components[0].expanded, Some(PathBuf::from("/home/me/.pyenv/bin")));
        assert_eq!(a.mutations[1].components[0].expanded, None);
        assert!(!a.mutations[1].rewritable);
    }

    #[test]
    fn collects_sources_and_aliases() {
        let a = analysis_for("[ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\"\nsource ~/.secrets.zsh\nalias python=python3\n");
        assert_eq!(a.sources.len(), 2);
        assert_eq!(a.sources[0].expanded, Some(PathBuf::from("/home/me/.nvm/nvm.sh")));
        assert!(a.sources[0].guarded);
        assert_eq!(a.sources[1].expanded, Some(PathBuf::from("/home/me/.secrets.zsh")));
        assert_eq!(a.aliases[0].name, "python");
    }

    #[test]
    fn expand_text_handles_defaults() {
        let mut vars = BTreeMap::new();
        vars.insert("HOME".into(), "/h".into());
        assert_eq!(expand_text("${XDG_DATA_HOME:-$HOME/.local/share}/x", &vars), Some("/h/.local/share/x".into()));
        assert_eq!(expand_text("$(brew --prefix)/bin", &vars), None);
        assert_eq!(expand_text("~/bin", &vars), Some("/h/bin".into()));
    }
}
