# Enhancement Note — iOS + Android support for ScreenKonect (NOT IMPLEMENTED)

Status: design note only. Mobile clients are currently blocked on purpose
(consent app shows "Computer required"). Do not implement until the PC flow
plus desktop agent are stable and released.

## Why mobile was removed

- **iOS Safari has no screen-capture API** (`getDisplayMedia` undefined).
  Browser-based iOS sharing is impossible, not just hard.
- **Android is possible in theory** (Chrome 90+, Android 10+, `getDisplayMedia`
  with `video: true`) but failed in practice here: permission sheets get lost,
  in-app browsers/WebViews lack the API, and file downloads via programmatic
  clicks are silently swallowed. Support cost exceeds value right now.

## Option A — Native apps (recommended for real mobile support)

- Android: native app (Kotlin) with `MediaProjection` + WebRTC SDK
  (`org.webrtc:google-webrtc`). Full capture + control injection, no browser limits.
- iOS: **screen capture from another app is sandbox-blocked**; only
  ReplayKit in-app broadcast or MDM-managed AirPlay mirroring work. Realistic
  iOS scope = view/approve/chat only, or a Mac-side agent. Do not promise iOS
  client sharing.
- Server impact: re-add `android | ios` to `Platform`
  (`packages/shared/src/types/session.ts`, `JoinSessionSchema` in
  `services/session/src/routes/sessions.ts`); the signaling relay is
  platform-agnostic already.

## Option B — PWA / mobile web again

- Only viable if constrained to Android Chrome opened directly (never in-app
  browsers), with deep-link UX forcing Chrome, plus server-side upload
  fallback for files (POST to `/v1/sessions/:id/files`) instead of data
  channels. iOS stays excluded.
- Cheaper than native, but keeps the flakiness that got mobile removed.

## Option C — Mobile agent app (Rust core reuse)

- Reuse `apps/desktop-agent` capture/input/signaling modules behind a Tauri
  (or UniFFI) mobile shell. One protocol, one backend. Heaviest lift.

## Suggested phasing (when the time comes)

1. Android native viewer+sharer (MediaProjection + WebRTC) against the
   unchanged signaling protocol; re-add `android` platform only.
2. Server-side file upload fallback (helps PWA and flaky networks too).
3. Re-evaluate iOS: viewer-only app unless a ReplayKit story is funded.
4. Marketing/docs updates only after 1 ships (README, SETUP-GUIDE, TERMIUS).

## Acceptance criteria (for whoever implements)

- Android phone on mobile data joins via funnel `https://` link, shares
  Entire Screen, technician sees Live < 5s, control + file transfer work.
- iOS explicitly scoped out of sharing (documented, with "Computer required").
- No regressions to PC flow (cold page load still < 1s, 7/7 healthy).
