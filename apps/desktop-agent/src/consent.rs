use crate::config::Config;
use crate::error::{AgentError, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{info, warn};

#[derive(Debug, Serialize, Deserialize)]
pub struct ConsentState {
    pub session_id: String,
    pub consent_state: String,
    pub permissions: ConsentPermissions,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConsentPermissions {
    pub view: bool,
    pub control: bool,
    pub clipboard: bool,
    pub file_transfer: bool,
    pub audio: bool,
}

pub async fn wait_for_consent(config: &Config) -> Result<()> {
    info!("Waiting for client consent...");

    let client = Client::new();
    let session_code = extract_session_code(&config.url)?;

    let poll_url = format!(
        "{}/v1/sessions/{}/consent-state",
        config.url, session_code
    );

    let max_retries = 60;
    let poll_interval = Duration::from_secs(2);

    for attempt in 0..max_retries {
        match client.get(&poll_url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    match response.json::<ConsentState>().await {
                        Ok(state) => {
                            match state.consent_state.as_str() {
                                "approved" | "auto_approved" => {
                                    info!("Consent approved for session {}", state.session_id);
                                    return Ok(());
                                }
                                "rejected" => {
                                    return Err(AgentError::Consent(
                                        "Client rejected the connection".to_string(),
                                    ));
                                }
                                "pending" | "none" => {
                                    if attempt % 5 == 0 {
                                        info!(
                                            "Still waiting for consent... (attempt {}/{})",
                                            attempt + 1,
                                            max_retries
                                        );
                                    }
                                }
                                unknown => {
                                    warn!("Unknown consent state: {}", unknown);
                                }
                            }
                        }
                        Err(e) => {
                            warn!("Failed to parse consent state: {}", e);
                        }
                    }
                } else if response.status() == 404 {
                    warn!("Session not found, waiting for session to be created...");
                } else {
                    warn!("Server returned status: {}", response.status());
                }
            }
            Err(e) => {
                warn!("Failed to connect to server: {}", e);
            }
        }

        tokio::time::sleep(poll_interval).await;
    }

    Err(AgentError::Consent(
        "Timed out waiting for consent".to_string(),
    ))
}

fn extract_session_code(url: &str) -> Result<String> {
    // Extract session code from URL like screenkonect://join?session=ABC123&token=xyz
    // or from direct session code
    if let Some(pos) = url.find("session=") {
        let start = pos + 8;
        let end = url[start..].find('&').map(|e| start + e).unwrap_or(url.len());
        return Ok(url[start..end].to_string());
    }

    // If it's just a session code
    if url.len() <= 20 && url.chars().all(|c| c.is_alphanumeric()) {
        return Ok(url.to_string());
    }

    Err(AgentError::Config(
        "Could not extract session code from URL".to_string(),
    ))
}
