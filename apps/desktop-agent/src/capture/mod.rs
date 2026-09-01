use crate::config::Config;
use crate::error::{AgentError, Result};
use tracing::info;

pub struct ScreenCapture {
    config: Config,
    #[cfg(target_os = "windows")]
    duplication: Option<WindowsDuplication>,
}

#[cfg(target_os = "windows")]
struct WindowsDuplication {
    // DXGI Desktop Duplication resources would be stored here
    // For now, we use a screenshot-based approach
}

impl ScreenCapture {
    pub fn new(config: &Config) -> Result<Self> {
        info!("Initializing screen capture for monitor {}", config.monitor);

        #[cfg(target_os = "windows")]
        {
            Ok(ScreenCapture {
                config: config.clone(),
                duplication: None,
            })
        }

        #[cfg(not(target_os = "windows"))]
        {
            Ok(ScreenCapture {
                config: config.clone(),
            })
        }
    }

    pub async fn capture_frame(&self) -> Result<Vec<u8>> {
        #[cfg(target_os = "windows")]
        {
            self.capture_windows().await
        }
        #[cfg(target_os = "macos")]
        {
            self.capture_macos().await
        }
        #[cfg(target_os = "linux")]
        {
            self.capture_linux().await
        }
    }

    #[cfg(target_os = "windows")]
    async fn capture_windows(&self) -> Result<Vec<u8>> {
        use std::process::Command;
        use std::path::PathBuf;

        // Use PowerShell to capture screenshot as a fallback
        // In production, this would use DXGI Desktop Duplication API
        let temp_dir = std::env::temp_dir();
        let screenshot_path = temp_dir.join("screenkonect_capture.png");

        let output = Command::new("powershell")
            .args([
                "-Command",
                &format!(
                    "Add-Type -AssemblyName System.Windows.Forms; \
                     [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object {{ \
                     $bitmap = New-Object System.Drawing.Bitmap($_.Bounds.Width, $_.Bounds.Height); \
                     $graphics = [System.Drawing.Graphics]::FromImage($bitmap); \
                     $graphics.CopyFromScreen($_.Bounds.Location, [System.Drawing.Point]::Empty, $_.Bounds.Size); \
                     $bitmap.Save('{}'); \
                     $graphics.Dispose(); $bitmap.Dispose() }}",
                    screenshot_path.display()
                ),
            ])
            .output()
            .map_err(|e| AgentError::Capture(format!("Failed to execute screenshot command: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AgentError::Capture(format!(
                "Screenshot command failed: {}",
                stderr
            )));
        }

        std::fs::read(&screenshot_path)
            .map_err(|e| AgentError::Capture(format!("Failed to read screenshot file: {}", e)))
    }

    #[cfg(target_os = "macos")]
    async fn capture_macos(&self) -> Result<Vec<u8>> {
        use std::process::Command;

        let temp_dir = std::env::temp_dir();
        let screenshot_path = temp_dir.join("screenkonect_capture.png");

        // Use screencapture command on macOS
        let output = Command::new("screencapture")
            .args(["-x", "-m", screenshot_path.to_str().unwrap()])
            .output()
            .map_err(|e| AgentError::Capture(format!("Failed to execute screencapture: {}", e)))?;

        if !output.status.success() {
            return Err(AgentError::Capture(
                "screencapture command failed".to_string(),
            ));
        }

        std::fs::read(&screenshot_path)
            .map_err(|e| AgentError::Capture(format!("Failed to read screenshot file: {}", e)))
    }

    #[cfg(target_os = "linux")]
    async fn capture_linux(&self) -> Result<Vec<u8>> {
        use std::process::Command;

        let temp_dir = std::env::temp_dir();
        let screenshot_path = temp_dir.join("screenkonect_capture.png");

        // Try different screenshot tools available on Linux
        let tools = [
            ("scrot", vec![screenshot_path.to_str().unwrap()]),
            (
                "gnome-screenshot",
                vec!["-f", screenshot_path.to_str().unwrap()],
            ),
            (
                "import",
                vec!["-window", "root", screenshot_path.to_str().unwrap()],
            ),
        ];

        for (tool, args) in &tools {
            if let Ok(output) = Command::new(tool).args(args).output() {
                if output.status.success() {
                    return std::fs::read(&screenshot_path).map_err(|e| {
                        AgentError::Capture(format!("Failed to read screenshot file: {}", e))
                    });
                }
            }
        }

        Err(AgentError::Capture(
            "No screenshot tool available on Linux".to_string(),
        ))
    }

    pub fn get_resolution(&self) -> Result<(u32, u32)> {
        // Return default resolution, would be detected from the capture API in production
        Ok((1920, 1080))
    }
}
