use crate::config::Config;
use crate::error::{AgentError, Result};
use tracing::info;

pub struct InputHandler {
    config: Config,
}

impl InputHandler {
    pub fn new(config: &Config) -> Result<Self> {
        info!("Initializing input handler");

        Ok(InputHandler {
            config: config.clone(),
        })
    }

    pub async fn handle_mouse_move(&self, x: f64, y: f64) -> Result<()> {
        #[cfg(target_os = "windows")]
        {
            self.move_mouse_windows(x, y).await
        }
        #[cfg(target_os = "macos")]
        {
            self.move_mouse_macos(x, y).await
        }
        #[cfg(target_os = "linux")]
        {
            self.move_mouse_linux(x, y).await
        }
    }

    pub async fn handle_mouse_button(&self, button: u32, pressed: bool) -> Result<()> {
        #[cfg(target_os = "windows")]
        {
            self.mouse_button_windows(button, pressed).await
        }
        #[cfg(target_os = "macos")]
        {
            self.mouse_button_macos(button, pressed).await
        }
        #[cfg(target_os = "linux")]
        {
            self.mouse_button_linux(button, pressed).await
        }
    }

    pub async fn handle_mouse_wheel(&self, delta_y: f64) -> Result<()> {
        #[cfg(target_os = "windows")]
        {
            self.mouse_wheel_windows(delta_y).await
        }
        #[cfg(target_os = "macos")]
        {
            self.mouse_wheel_macos(delta_y).await
        }
        #[cfg(target_os = "linux")]
        {
            self.mouse_wheel_linux(delta_y).await
        }
    }

    pub async fn handle_key(&self, code: &str, pressed: bool) -> Result<()> {
        #[cfg(target_os = "windows")]
        {
            self.key_windows(code, pressed).await
        }
        #[cfg(target_os = "macos")]
        {
            self.key_macos(code, pressed).await
        }
        #[cfg(target_os = "linux")]
        {
            self.key_linux(code, pressed).await
        }
    }

    pub async fn handle_paste(&self, text: &str) -> Result<()> {
        #[cfg(target_os = "windows")]
        {
            self.paste_windows(text).await
        }
        #[cfg(target_os = "macos")]
        {
            self.paste_macos(text).await
        }
        #[cfg(target_os = "linux")]
        {
            self.paste_linux(text).await
        }
    }

    // Windows implementations
    #[cfg(target_os = "windows")]
    async fn move_mouse_windows(&self, x: f64, y: f64) -> Result<()> {
        use std::process::Command;

        // Use PowerShell to move mouse cursor
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; \
             [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point({}, {})",
            x as i32, y as i32
        );

        Command::new("powershell")
            .args(["-Command", &script])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to move mouse: {}", e)))?;

        Ok(())
    }

    #[cfg(target_os = "windows")]
    async fn mouse_button_windows(&self, button: u32, pressed: bool) -> Result<()> {
        use std::process::Command;

        let action = if pressed { "down" } else { "up" };
        let btn = match button {
            0 => "left",
            1 => "right",
            2 => "middle",
            _ => "left",
        };

        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; \
             $method = '{}'; \
             if ($method -eq 'down') {{ \
                 [System.Windows.Forms.SendKeys]::SendWait('{}'.ToUpper()) \
             }}",
            action, btn
        );

        Command::new("powershell")
            .args(["-Command", &script])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to handle mouse button: {}", e)))?;

        Ok(())
    }

    #[cfg(target_os = "windows")]
    async fn mouse_wheel_windows(&self, delta_y: f64) -> Result<()> {
        use std::process::Command;

        let clicks = (delta_y / 120.0).round() as i32;
        let direction = if clicks > 0 { "{UP}" } else { "{DOWN}" };
        let count = clicks.abs();

        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; \
             1..{} | ForEach- {{ [System.Windows.Forms.SendKeys]::SendWait('{}') }}",
            count, direction
        );

        Command::new("powershell")
            .args(["-Command", &script])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to handle mouse wheel: {}", e)))?;

        Ok(())
    }

    #[cfg(target_os = "windows")]
    async fn key_windows(&self, code: &str, pressed: bool) -> Result<()> {
        use std::process::Command;

        let key = convert_web_keycode_to_windows(code);
        let action = if pressed { "KeyDown" } else { "KeyUp" };

        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; \
             [System.Windows.Forms.SendKeys]::SendWait('{}')",
            key
        );

        Command::new("powershell")
            .args(["-Command", &script])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to handle key: {}", e)))?;

        Ok(())
    }

    #[cfg(target_os = "windows")]
    async fn paste_windows(&self, text: &str) -> Result<()> {
        use std::process::Command;

        // Set clipboard and paste
        let script = format!(
            "Set-Clipboard -Value '{}'; \
             Add-Type -AssemblyName System.Windows.Forms; \
             [System.Windows.Forms.SendKeys]::SendWait('^v')",
            text.replace('\'', "''")
        );

        Command::new("powershell")
            .args(["-Command", &script])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to paste text: {}", e)))?;

        Ok(())
    }

    // macOS implementations
    #[cfg(target_os = "macos")]
    async fn move_mouse_macos(&self, x: f64, y: f64) -> Result<()> {
        use std::process::Command;

        let script = format!(
            "tell application \"System Events\" to set position of mouse cursor to {{{}, {}}}",
            x as i32, y as i32
        );

        Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to move mouse: {}", e)))?;

        Ok(())
    }

    #[cfg(target_os = "macos")]
    async fn mouse_button_macos(&self, button: u32, pressed: bool) -> Result<()> {
        use std::process::Command;

        let btn = match button {
            0 => "left",
            1 => "right",
            2 => "middle",
            _ => "left",
        };

        let action = if pressed { "down" } else { "up" };

        let script = format!(
            "tell application \"System Events\" to {} mouse button {}",
            action, btn
        );

        Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to handle mouse button: {}", e)))?;

        Ok(())
    }

    #[cfg(target_os = "macos")]
    async fn mouse_wheel_macos(&self, delta_y: f64) -> Result<()> {
        use std::process::Command;

        let clicks = (delta_y / 10.0).round() as i32;

        let script = format!(
            "tell application \"System Events\" to scroll wheel click {}",
            clicks
        );

        Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to handle mouse wheel: {}", e)))?;

        Ok(())
    }

    #[cfg(target_os = "macos")]
    async fn key_macos(&self, code: &str, pressed: bool) -> Result<()> {
        use std::process::Command;

        let key = convert_web_keycode_to_macos(code);
        let action = if pressed { "key down" } else { "key up" };

        let script = format!(
            "tell application \"System Events\" to {} \"{}\"",
            action, key
        );

        Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to handle key: {}", e)))?;

        Ok(())
    }

    #[cfg(target_os = "macos")]
    async fn paste_macos(&self, text: &str) -> Result<()> {
        use std::process::Command;

        // Set clipboard and paste
        Command::new("pbcopy")
            .arg(text)
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to set clipboard: {}", e)))?;

        let script = "tell application \"System Events\" to keystroke \"v\" using command down";

        Command::new("osascript")
            .args(["-e", script])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to paste text: {}", e)))?;

        Ok(())
    }

    // Linux implementations
    #[cfg(target_os = "linux")]
    async fn move_mouse_linux(&self, x: f64, y: f64) -> Result<()> {
        use std::process::Command;

        let output = Command::new("xdotool")
            .args(["mousemove", &x.to_string(), &y.to_string()])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to move mouse: {}", e)))?;

        if !output.status.success() {
            return Err(AgentError::Input("xdotool mousemove failed".to_string()));
        }

        Ok(())
    }

    #[cfg(target_os = "linux")]
    async fn mouse_button_linux(&self, button: u32, pressed: bool) -> Result<()> {
        use std::process::Command;

        let btn = match button {
            0 => "1",
            1 => "3",
            2 => "2",
            _ => "1",
        };

        let cmd = if pressed { "mousedown" } else { "mouseup" };

        let output = Command::new("xdotool")
            .args([cmd, btn])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to handle mouse button: {}", e)))?;

        if !output.status.success() {
            return Err(AgentError::Input(format!("xdotool {} failed", cmd)));
        }

        Ok(())
    }

    #[cfg(target_os = "linux")]
    async fn mouse_wheel_linux(&self, delta_y: f64) -> Result<()> {
        use std::process::Command;

        let clicks = (delta_y / 120.0).round() as i32;

        let output = Command::new("xdotool")
            .args(["click", "5"])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to handle mouse wheel: {}", e)))?;

        if !output.status.success() {
            return Err(AgentError::Input("xdotool click failed".to_string()));
        }

        Ok(())
    }

    #[cfg(target_os = "linux")]
    async fn key_linux(&self, code: &str, pressed: bool) -> Result<()> {
        use std::process::Command;

        let key = convert_web_keycode_to_linux(code);

        let cmd = if pressed { "keydown" } else { "keyup" };

        let output = Command::new("xdotool")
            .args([cmd, &key])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to handle key: {}", e)))?;

        if !output.status.success() {
            return Err(AgentError::Input(format!("xdotool {} failed", cmd)));
        }

        Ok(())
    }

    #[cfg(target_os = "linux")]
    async fn paste_linux(&self, text: &str) -> Result<()> {
        use std::process::Command;

        // Set clipboard using xclip
        let output = Command::new("xclip")
            .args(["-selection", "clipboard"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| AgentError::Input(format!("Failed to spawn xclip: {}", e)))?;

        if let Some(mut stdin) = output.stdin {
            use std::io::Write;
            stdin
                .write_all(text.as_bytes())
                .map_err(|e| AgentError::Input(format!("Failed to write to clipboard: {}", e)))?;
        }

        // Paste with Ctrl+V
        Command::new("xdotool")
            .args(["key", "ctrl+v"])
            .output()
            .map_err(|e| AgentError::Input(format!("Failed to paste: {}", e)))?;

        Ok(())
    }
}

// Keycode conversion helpers
fn convert_web_keycode_to_windows(code: &str) -> String {
    match code {
        "Enter" => "{ENTER}".to_string(),
        "Backspace" => "{BACKSPACE}".to_string(),
        "Tab" => "{TAB}".to_string(),
        "Escape" => "{ESC}".to_string(),
        "Delete" => "{DELETE}".to_string(),
        "ArrowUp" => "{UP}".to_string(),
        "ArrowDown" => "{DOWN}".to_string(),
        "ArrowLeft" => "{LEFT}".to_string(),
        "ArrowRight" => "{RIGHT}".to_string(),
        "Home" => "{HOME}".to_string(),
        "End" => "{END}".to_string(),
        "PageUp" => "{PGUP}".to_string(),
        "PageDown" => "{PGDN}".to_string(),
        "F1" => "{F1}".to_string(),
        "F2" => "{F2}".to_string(),
        "F3" => "{F3}".to_string(),
        "F4" => "{F4}".to_string(),
        "F5" => "{F5}".to_string(),
        "F6" => "{F6}".to_string(),
        "F7" => "{F7}".to_string(),
        "F8" => "{F8}".to_string(),
        "F9" => "{F9}".to_string(),
        "F10" => "{F10}".to_string(),
        "F11" => "{F11}".to_string(),
        "F12" => "{F12}".to_string(),
        "Control" => "^".to_string(),
        "Alt" => "%".to_string(),
        "Shift" => "+".to_string(),
        _ => code.to_string(),
    }
}

fn convert_web_keycode_to_macos(code: &str) -> String {
    match code {
        "Enter" => "return".to_string(),
        "Backspace" => "delete".to_string(),
        "Tab" => "tab".to_string(),
        "Escape" => "escape".to_string(),
        "Delete" => "forward delete".to_string(),
        "ArrowUp" => "up arrow".to_string(),
        "ArrowDown" => "down arrow".to_string(),
        "ArrowLeft" => "left arrow".to_string(),
        "ArrowRight" => "right arrow".to_string(),
        "Home" => "home".to_string(),
        "End" => "end".to_string(),
        "PageUp" => "page up".to_string(),
        "PageDown" => "page down".to_string(),
        _ => code.to_string(),
    }
}

fn convert_web_keycode_to_linux(code: &str) -> String {
    match code {
        "Enter" => "Return".to_string(),
        "Backspace" => "BackSpace".to_string(),
        "Tab" => "Tab".to_string(),
        "Escape" => "Escape".to_string(),
        "Delete" => "Delete".to_string(),
        "ArrowUp" => "Up".to_string(),
        "ArrowDown" => "Down".to_string(),
        "ArrowLeft" => "Left".to_string(),
        "ArrowRight" => "Right".to_string(),
        "Home" => "Home".to_string(),
        "End" => "End".to_string(),
        "PageUp" => "Page_Up".to_string(),
        "PageDown" => "Page_Down".to_string(),
        "Control" => "Control_L".to_string(),
        "Alt" => "Alt_L".to_string(),
        "Shift" => "Shift_L".to_string(),
        _ => code.to_string(),
    }
}
