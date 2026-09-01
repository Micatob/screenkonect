use thiserror::Error;

#[derive(Error, Debug)]
pub enum AgentError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Consent error: {0}")]
    Consent(String),

    #[error("Capture error: {0}")]
    Capture(String),

    #[error("Input error: {0}")]
    Input(String),

    #[error("Signaling error: {0}")]
    Signaling(String),

    #[error("WebRTC error: {0}")]
    WebRtc(String),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, AgentError>;
