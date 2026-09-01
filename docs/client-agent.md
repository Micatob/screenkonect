# Client Agent

## Overview

The ScreenKonect client agent is a lightweight application that runs on the client's machine to facilitate remote support sessions. It handles screen capture, input injection, and WebRTC media streaming.

## Architecture

```
┌─────────────────────────────────────┐
│           Client Agent              │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  │
│  │   Screen    │  │    Input    │  │
│  │   Capture   │  │  Injection  │  │
│  └──────┬──────┘  └──────┬──────┘  │
│         │                │         │
│  ┌──────▼────────────────▼──────┐  │
│  │       WebRTC Pipeline        │  │
│  └──────────────┬───────────────┘  │
│                 │                  │
│  ┌──────────────▼───────────────┐  │
│  │       Signaling Client       │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Features

### Screen Capture

- **Windows**: Desktop Duplication API (DXGI)
- **macOS**: ScreenCaptureKit
- **Linux**: PipeWire (Wayland) / X11 fallback

### Input Injection

- **Windows**: SendInput API
- **macOS**: CGEventPost
- **Linux**: xdotool (X11) / libei (Wayland)

### Media Streaming

- WebRTC with VP9/AV1/H.264
- Hardware acceleration when available
- Adaptive bitrate
- Low-latency mode

## Installation

### Windows

```bash
# Download installer
# Run ScreenKonect-Setup.exe
# Follow installation wizard
```

### macOS

```bash
# Download DMG
# Drag to Applications
# Grant required permissions in System Preferences
```

### Linux

```bash
# Download AppImage or DEB package
chmod +x ScreenKonect.AppImage
./ScreenKonect.AppImage
```

## Permissions

### Windows

- Screen capture: Enabled by default
- Input injection: Requires accessibility permissions

### macOS

- Screen capture: Requires Screen Recording permission
- Input injection: Requires Accessibility permission
- Microphone: Optional, for audio sharing

### Linux

- Screen capture: PipeWire portal (Wayland) or X11
- Input injection: xdotool or libei

## Configuration

### Command Line Options

```bash
screenkonect-agent \
  --url wss://signaling.screenkonect.com \
  --token <session-token> \
  --monitor 0 \
  --quality 80 \
  --max-width 1920 \
  --fps 30
```

### Configuration File

`~/.screenkonect/config.yaml`:

```yaml
url: wss://signaling.screenkonect.com
monitor: 0
quality: 80
max_width: 1920
fps: 30
log_level: info
```

## Security

### Consent Enforcement

1. Agent requires valid session token
2. Client must approve session via browser
3. No screen data transmitted before consent
4. Agent shows persistent "Screen Shared" indicator

### Token Validation

1. Token validated against server
2. Token hashed before storage
3. Single-use tokens
4. Automatic expiry

### Media Encryption

1. DTLS-SRTP for all media
2. No media without consent
3. Encrypted signaling (WSS)

## Troubleshooting

### Common Issues

1. **Screen capture fails**: Check OS permissions
2. **Input not working**: Check accessibility permissions
3. **Connection failed**: Check network and token
4. **High latency**: Reduce quality or resolution

### Logs

Logs stored at:
- **Windows**: `%APPDATA%\ScreenKonect\logs\`
- **macOS**: `~/Library/Logs/ScreenKonect/`
- **Linux**: `~/.local/share/ScreenKonect/logs/`

### Debug Mode

```bash
screenkonect-agent --log-level debug
```

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/your-org/screenkonect.git
cd screenkonect/apps/desktop-agent

# Build
cargo build --release

# Run
./target/release/screenkonect-agent
```

### Project Structure

```
desktop-agent/
├── src/
│   ├── main.rs           # Entry point
│   ├── capture/          # Screen capture
│   │   ├── mod.rs
│   │   ├── windows.rs
│   │   ├── macos.rs
│   │   └── linux.rs
│   ├── input/            # Input injection
│   │   ├── mod.rs
│   │   ├── windows.rs
│   │   ├── macos.rs
│   │   └── linux.rs
│   ├── webrtc/           # WebRTC pipeline
│   │   ├── mod.rs
│   │   └── peer.rs
│   ├── signaling.rs      # Signaling client
│   ├── consent.rs        # Consent management
│   └── config.rs         # Configuration
├── tauri/                # Tauri UI
└── Cargo.toml
```
