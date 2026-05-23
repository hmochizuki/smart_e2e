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

    #[error("required executable not found: {0}")]
    NotFound(String),

    #[error("codegen produced empty output")]
    CodegenEmpty,

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("Playwright のブラウザがインストールされていません。リポジトリルートで `pnpm exec playwright install` を実行してから再度お試しください。")]
    PlaywrightBrowsersMissing,
}

impl Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
