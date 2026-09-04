use crate::config::Config;
use crate::error::{AgentError, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{info, warn};

#[derive(Debug, Serialize, Deserialize)]
pub struct ConsentPermissions {
    pub view: bool,
    pub control: bool,
    pub clipboard: bool,
    pub file_transfer: bool,
    pub audio: bool,
}

#[derive(Debug, Deserialize)]
struct JoinSession {
    id: String,
}

#[derive(Debug, Deserialize)]
struct JoinResponse {
    session: JoinSession,
}

#[derive(Debug, Deserialize)]
struct ConsentStateResponse {
    consent_state: String,
}

fn platform() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(target_os = "macos")]
    {
        "macos"
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        "linux"
    }
}

/// Join the session with our token (like the browser client does), then wait
/// for the client/technician to approve. Returns the real session id on success.
pub async fn wait_for_consent(config: &Config) -> Result<String> {
    info!("Joining session...");

    let base = config.url.trim_end_matches('/');
    let client = Client::new();

    // Step 1: join - validates the token and gives us the session id.
    // (Polling consent-state with the short session CODE never matches:
    // the server looks sessions up by uuid.)
    let join_url = format!("{}/v1/sessions/join", base);
    let join_res = client
        .post(&join_url)
        .json(&serde_json::json!({ "token": config.token, "platform": platform() }))
        .send()
        .await?;
    if !join_res.status().is_success() {
        return Err(AgentError::Consent(format!(
            "join rejected ({}). The link is invalid, expired, or the session ended - ask the technician for a NEW link.",
            join_res.status()
        )));
    }
    let joined: JoinResponse = join_res.json().await?;
    let session_id = joined.session.id;
    info!("Joined session {}, waiting for approval...", session_id);

    // Step 2: poll until approved / denied / timeout (30 min max).
    let poll_url = format!("{}/v1/sessions/{}/consent-state", base, session_id);
    let max_retries = 900;
    let poll_interval = Duration::from_secs(2);

    for attempt in 0..max_retries {
        match client.get(&poll_url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    match response.json::<ConsentStateResponse>().await {
                        Ok(state) => {
                            match state.consent_state.as_str() {
                                "approved" | "auto_approved" => {
                                    info!("Session {} approved", session_id);
                                    return Ok(session_id);
                                }
                                "denied" | "rejected" | "revoked" => {
                                    return Err(AgentError::Consent(
                                        "The session was denied or ended".to_string(),
                                    ));
                                }
                                "pending" => {
                                    if attempt % 15 == 0 {
                                        info!(
                                            "Still waiting for approval... ({}/{})",
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
                    return Err(AgentError::Consent(
                        "Session no longer exists on the server".to_string(),
                    ));
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
        "Timed out waiting for approval".to_string(),
    ))
}
