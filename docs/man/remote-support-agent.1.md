# screenkonect-agent(1)

## NAME

screenkonect-agent - Consent-based remote desktop support agent

## SYNOPSIS

**screenkonect-agent** [*OPTIONS*]

## DESCRIPTION

**screenkonect-agent** is a lightweight agent that runs on the client's machine to facilitate remote support sessions. It handles screen capture, input injection, and WebRTC media streaming with explicit client consent.

## OPTIONS

**--url** *URL*
  WebSocket signaling server URL (required)

**--token** *TOKEN*
  Session join token (required)

**--monitor** *INDEX*
  Monitor index to share (default: 0)

**--quality** *LEVEL*
  JPEG quality 1-100 (default: 80)

**--max-width** *PIXELS*
  Maximum capture width (default: 1920)

**--fps** *FRAMES*
  Target frames per second (default: 30)

**--log-level** *LEVEL*
  Log level: debug, info, warn, error (default: info)

**--config** *PATH*
  Path to configuration file

**--help**
  Show help message

**--version**
  Show version

## CONSENT

The agent requires explicit client consent before any screen data is transmitted. The consent flow:

1. Agent connects to signaling server
2. Client opens join URL in browser
3. Client reviews permissions
4. Client approves or denies
5. Only after approval does screen capture begin

## PERMISSIONS

The agent respects OS permission prompts:

- **Screen Capture**: Required for remote viewing
- **Accessibility**: Required for remote control
- **Microphone**: Optional for audio sharing

## SESSION INDICATOR

When a session is active, the agent displays a persistent "Screen Shared" indicator on the client's screen. This indicator cannot be hidden or minimized.

## SECURITY

- All media traffic is encrypted with DTLS-SRTP
- Session tokens are single-use and short-lived
- No screen data is transmitted without consent
- Agent shows clear visual indicator when active

## FILES

**~/.screenkonect/config.yaml**
  User configuration file

**~/.screenkonect/logs/**
  Log files directory

## EXAMPLES

```bash
# Join a session
screenkonect-agent --url wss://signaling.example.com --token abc123

# Join with custom settings
screenkonect-agent --url wss://signaling.example.com --token abc123 --monitor 1 --quality 90 --fps 60

# Use configuration file
screenkonect-agent --config ~/.screenkonect/config.yaml --token abc123
```

## EXIT STATUS

**0**
  Success

**1**
  Error (invalid arguments, connection failed, etc.)

## SEE ALSO

**screenkonect-server(1)**

## AUTHORS

ScreenKonect Contributors
