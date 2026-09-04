mod capture;
mod config;
mod consent;
mod error;
mod input;
mod signaling;
mod webrtc;

use anyhow::Result;
use tracing::info;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse()?))
        .init();

    info!("ScreenKonect Agent starting...");

    let config = config::load_config()?;

    let session_id = consent::wait_for_consent(&config).await?;

    info!("Consent approved, starting screen capture...");

    let capture = capture::ScreenCapture::new(&config)?;
    let input_handler = input::InputHandler::new(&config)?;

    let signaling_client =
        signaling::SignalingClient::connect(&config, &session_id).await?;

    let webrtc_peer =
        webrtc::WebRtcPeer::new(&config, signaling_client, session_id).await?;

    webrtc_peer.run(capture, input_handler).await?;

    Ok(())
}
