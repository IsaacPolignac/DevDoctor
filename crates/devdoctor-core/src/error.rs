use std::path::PathBuf;

/// Typed error for every fallible core operation.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("I/O error at {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("serialization error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("command `{program}` failed: {reason}")]
    Command { program: String, reason: String },
    #[error("command `{program}` timed out after {timeout_ms} ms")]
    CommandTimeout { program: String, timeout_ms: u64 },
    #[error("not found: {0}")]
    NotFound(String),
    #[error("invalid input: {0}")]
    Invalid(String),
    #[error("refusing unsafe path operation: {0}")]
    UnsafePath(String),
    #[error("validation failed: {0}")]
    Validation(String),
    #[error("no fix available: {0}")]
    FixUnavailable(String),
    #[error("{0}")]
    Other(String),
}

impl Error {
    pub fn io(path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        Error::Io { path: path.into(), source }
    }

    pub fn other(msg: impl Into<String>) -> Self {
        Error::Other(msg.into())
    }

    pub fn invalid(msg: impl Into<String>) -> Self {
        Error::Invalid(msg.into())
    }
}

pub type Result<T> = std::result::Result<T, Error>;
