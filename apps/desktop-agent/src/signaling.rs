use crate::config::Config;
use crate::error::{AgentError, Result};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalingMessage {
    pub r#type: String,
    pub session_id: String,
    pub payload: serde_json::Value,
}

pub struct SignalingClient {
    config: Config,
    tx: mpsc::Sender<SignalingMessage>,
    rx: mpsc::Receiver<SignalingMessage>,
}

impl SignalingClient {
    pub async fn connect(config: &Config) -> Result<Self> {
        info!("Connecting to signaling server: {}", config.url);

        // https servers need wss, plain http uses ws
        let (scheme, host) = if let Some(h) = config.url.strip_prefix("https://") {
            ("wss", h)
        } else {
            ("ws", config.url.strip_prefix("http://").unwrap_or(&config.url))
        };
        let ws_url = format!("{}://{}/ws/signaling", scheme, host.trim_end_matches('/'));

        let (ws_stream, _) = connect_async(&ws_url)
            .await
            .map_err(|e| AgentError::Signaling(format!("WebSocket connection failed: {}", e)))?;

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();

        let (tx, mut internal_rx) = mpsc::channel(100);
        let (internal_tx, rx) = mpsc::channel(100);

        // Send join message
        let join_msg = serde_json::json!({
            "type": "join",
            "session_id": config.token,
            "role": "agent"
        });

        ws_sender
            .send(Message::Text(join_msg.to_string()))
            .await
            .map_err(|e| AgentError::Signaling(format!("Failed to send join message: {}", e)))?;

        // Spawn task to forward messages from WebSocket to internal channel
        tokio::spawn(async move {
            while let Some(msg) = ws_receiver.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Ok(sig_msg) = serde_json::from_str::<SignalingMessage>(&text) {
                            if internal_tx.send(sig_msg).await.is_err() {
                                break;
                            }
                        }
                    }
                    Ok(Message::Close(_)) => {
                        warn!("WebSocket connection closed by server");
                        break;
                    }
                    Err(e) => {
                        warn!("WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
        });

        // Spawn task to forward messages from internal channel to WebSocket
        tokio::spawn(async move {
            while let Some(msg) = internal_rx.recv().await {
                if let Ok(text) = serde_json::to_string(&msg) {
                    if ws_sender.send(Message::Text(text)).await.is_err() {
                        break;
                    }
                }
            }
        });

        info!("Connected to signaling server");

        Ok(SignalingClient {
            config: config.clone(),
            tx,
            rx,
        })
    }

    pub async fn send(&self, message: SignalingMessage) -> Result<()> {
        self.tx
            .send(message)
            .await
            .map_err(|e| AgentError::Signaling(format!("Failed to send message: {}", e)))?;
        Ok(())
    }

    pub async fn receive(&mut self) -> Option<SignalingMessage> {
        self.rx.recv().await
    }

    pub async fn send_offer(&self, session_id: &str, offer: &str) -> Result<()> {
        self.send(SignalingMessage {
            r#type: "offer".to_string(),
            session_id: session_id.to_string(),
            payload: serde_json::json!({ "sdp": offer }),
        })
        .await
    }

    pub async fn send_answer(&self, session_id: &str, answer: &str) -> Result<()> {
        self.send(SignalingMessage {
            r#type: "answer".to_string(),
            session_id: session_id.to_string(),
            payload: serde_json::json!({ "sdp": answer }),
        })
        .await
    }

    pub async fn send_ice_candidate(&self, session_id: &str, candidate: &str) -> Result<()> {
        self.send(SignalingMessage {
            r#type: "ice-candidate".to_string(),
            session_id: session_id.to_string(),
            payload: serde_json::json!({ "candidate": candidate }),
        })
        .await
    }
}
