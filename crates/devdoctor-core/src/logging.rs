//! Local logging: a rolling file under the DevDoctor logs directory plus optional stderr output.
//! Nothing is ever uploaded. Callers must never log secret values.

use crate::paths::DevDoctorDirs;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer};

pub struct LogGuard {
    _guard: tracing_appender::non_blocking::WorkerGuard,
}

/// Initialises logging. `stderr_level` enables human-readable stderr output (e.g. "warn").
/// Returns a guard that must be kept alive for the lifetime of the process.
pub fn init(dirs: &DevDoctorDirs, stderr_level: Option<&str>) -> Option<LogGuard> {
    let _ = std::fs::create_dir_all(&dirs.logs_dir);
    let file_appender = tracing_appender::rolling::daily(&dirs.logs_dir, "devdoctor.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
    let file_filter = EnvFilter::try_from_env("DEVDOCTOR_LOG").unwrap_or_else(|_| EnvFilter::new("info"));
    let file_layer = fmt::layer().with_writer(non_blocking).with_ansi(false).with_target(true).with_filter(file_filter);
    let registry = tracing_subscriber::registry().with(file_layer);
    let result = match stderr_level {
        Some(level) => {
            let stderr_layer =
                fmt::layer().with_writer(std::io::stderr).with_target(false).without_time().with_filter(EnvFilter::new(level));
            registry.with(stderr_layer).try_init()
        }
        None => registry.try_init(),
    };
    if result.is_err() {
        // A subscriber is already installed (tests, embedding); keep going.
        return None;
    }
    Some(LogGuard { _guard: guard })
}
