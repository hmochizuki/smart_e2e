use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CommandError {
    #[error("subprocess spawn failed: {0}")]
    SpawnFailed(String),

    #[error("subprocess returned non-zero (status {status}): {stderr}")]
    SubprocessFailed { status: i32, stderr: String },

    #[error("failed to parse subprocess output: {0}")]
    InvalidOutput(String),
}

impl Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
