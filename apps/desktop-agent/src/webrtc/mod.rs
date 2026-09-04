pub mod peer;

use crate::capture::ScreenCapture;
use crate::config::Config;
use crate::error::{AgentError, Result};
use crate::input::InputHandler;
use crate::signaling::{SignalingClient, SignalingMessage};
use tracing::{info, warn};

pub struct WebRtcPeer {
    config: Config,
    session_id: String,
    signaling: SignalingClient,
}

impl WebRtcPeer {
    pub async fn new(
        config: &Config,
        signaling: SignalingClient,
        session_id: String,
    ) -> Result<Self> {
        info!("Initializing WebRTC peer");

        Ok(WebRtcPeer {
            config: config.clone(),
            session_id,
            signaling,
        })
    }

    pub async fn run(
        mut self,
        capture: ScreenCapture,
        input: InputHandler,
    ) -> Result<()> {
        info!("Starting WebRTC peer");

        let peer = peer::PeerConnection::new();

        // Create and send offer
        let offer = peer.create_offer().await?;
        self.signaling
            .send_offer(&self.session_id, &offer)
            .await?;

        // Process signaling messages
        let signaling = &mut self.signaling;
        let capture = std::sync::Arc::new(capture);
        let input = std::sync::Arc::new(input);

        loop {
            tokio::select! {
                Some(msg) = signaling.receive() => {
                    match msg.r#type.as_str() {
                        "answer" => {
                            if let Some(sdp) = msg.payload.get("sdp") {
                                if let Some(sdp_str) = sdp.as_str() {
                                    peer.set_answer(sdp_str).await?;
                                    info!("Set remote answer");
                                }
                            }
                        }
                        "ice-candidate" => {
                            if let Some(candidate) = msg.payload.get("candidate") {
                                if let Some(candidate_str) = candidate.as_str() {
                                    peer.add_ice_candidate(candidate_str).await?;
                                }
                            }
                        }
                        "input-event" => {
                            Self::handle_input_event(&input, &msg.payload).await?;
                        }
                        "ping" => {
                            signaling.send(SignalingMessage {
                                r#type: "pong".to_string(),
                                session_id: msg.session_id,
                                payload: serde_json::json!({}),
                            }).await?;
                        }
                        _ => {
                            warn!("Unknown message type: {}", msg.r#type);
                        }
                    }
                }
                _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {
                    // Capture and send frame periodically
                    if let Ok(frame) = capture.capture_frame().await {
                        // In production, this would send the frame via WebRTC video track
                        // For now, we just log it
                        info!("Captured frame: {} bytes", frame.len());
                    }
                }
                _ = tokio::signal::ctrl_c() => {
                    info!("Shutting down...");
                    break;
                }
            }
        }

        Ok(())
    }

    async fn handle_input_event(input: &InputHandler, payload: &serde_json::Value) -> Result<()> {
        let event_type = payload
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        match event_type {
            "mouse_move" => {
                let x = payload.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let y = payload.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
                input.handle_mouse_move(x, y).await?;
            }
            "mouse_button" => {
                let button = payload.get("button").and_then(|v| v.as_u32()).unwrap_or(0);
                let pressed = payload.get("pressed").and_then(|v| v.as_bool()).unwrap_or(false);
                input.handle_mouse_button(button, pressed).await?;
            }
            "mouse_wheel" => {
                let delta_y = payload.get("deltaY").and_then(|v| v.as_f64()).unwrap_or(0.0);
                input.handle_mouse_wheel(delta_y).await?;
            }
            "key" => {
                let code = payload.get("code").and_then(|v| v.as_str()).unwrap_or("");
                let pressed = payload.get("pressed").and_then(|v| v.as_bool()).unwrap_or(false);
                input.handle_key(code, pressed).await?;
            }
            "paste" => {
                let text = payload.get("text").and_then(|v| v.as_str()).unwrap_or("");
                input.handle_paste(text).await?;
            }
            _ => {
                warn!("Unknown input event type: {}", event_type);
            }
        }

        Ok(())
    }
}
