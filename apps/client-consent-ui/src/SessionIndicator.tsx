import { useState, useEffect, useRef } from 'react';
import { Monitor, Shield, Eye, MousePointer, Clipboard, FileUp, Volume2, Camera, Mic, AlertTriangle } from 'lucide-react';

interface SessionIndicatorProps {
  sessionId: string;
  permissions: {
    view: boolean;
    control: boolean;
    clipboard: boolean;
    file_transfer: boolean;
    audio: boolean;
    camera?: boolean;
    mic?: boolean;
  };
  shareTarget?: 'monitor' | 'window' | 'browser';
  onEndSession: () => void;
}

export function SessionIndicator({ sessionId, permissions, shareTarget = 'monitor', onEndSession }: SessionIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [ending, setEnding] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const camRef = useRef<MediaStream | null>(null);

  const isMobile = /android|iphone|ipad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    let cancelled = false;

    const startSharing = async () => {
      if (!permissions.view) return;

      try {
        // getDisplayMedia requires secure context (https or localhost).
        // Plain http://<IP> exposes no mediaDevices -> show actionable fix, not generic error.
        if (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia) {
          throw new Error(
            'Screen sharing requires a secure connection (https). ' +
            'Options to fix this:\n' +
            '1. Cloudflare Tunnel (free): On your PC run cloudflared tunnel --url http://localhost:8090, then open the public URL it prints\n' +
            '2. Tailscale Funnel (free): On your PC run tailscale funnel --bg 8090, then open the URL it prints\n' +
            '3. VPS: Deploy to your VPS (e.g. 168.222.97.214:8090) — friends connect to the public IP\n' +
            '4. Quick test: in Chrome open chrome://flags/#unsafely-treat-insecure-origin-as-secure, add your URL, Enable, Relaunch'
          );
        }

        // Android Chrome doesn't support displaySurface/selfBrowserSurface constraints
        // Use simple constraints on mobile, full constraints on desktop
        let stream: MediaStream;
        if (isMobile) {
          // Mobile: simple constraints (Android Chrome supports getDisplayMedia for entire screen on Android 10+)
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: permissions.audio,
            } as any);
          } catch (e: any) {
            if (e?.name === 'AbortError' || e?.name === 'NotAllowedError') {
              throw e;
            }
            // Fallback: try without audio
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
            } as any);
          }
        } else {
          // Desktop: use shareTarget to avoid mirror loop and ensure correct capture
          // monitor = entire screen (desktop), window = single window, browser = tab
          // selfBrowserSurface: exclude avoids capturing the consent tab itself (prevents mirror)
          const videoConstraints: any = {};
          if (shareTarget === 'monitor') {
            videoConstraints.displaySurface = 'monitor';
            videoConstraints.selfBrowserSurface = 'exclude';
          } else if (shareTarget === 'window') {
            videoConstraints.displaySurface = 'window';
            videoConstraints.selfBrowserSurface = 'exclude';
          } else {
            videoConstraints.displaySurface = 'browser';
            videoConstraints.selfBrowserSurface = 'exclude';
          }
          // Try with constraints, fallback to simple if not supported (Firefox)
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: videoConstraints,
              audio: permissions.audio,
              // @ts-ignore - Chrome specific to prefer monitor and exclude self
              preferCurrentTab: false,
              selfBrowserSurface: 'exclude',
              systemAudio: permissions.audio ? 'include' : 'exclude',
            } as any);
          } catch (e: any) {
            console.warn('[sharing] constrained getDisplayMedia failed, fallback to video:true', e);
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: permissions.audio,
            } as any);
          }
        }
        // Validate stream has video
        if (stream.getVideoTracks().length === 0) {
          throw new Error('No video track captured — try sharing Entire Screen instead of Browser Tab');
        }
        // Lock display to one: check if multiple tracks (should be one)
        if (stream.getVideoTracks().length > 1) {
          console.warn('[sharing] multiple video tracks, using first');
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setSharing(true);
        setError(null);

        // If user stops sharing via OS prompt, end session
        stream.getVideoTracks()[0].onended = () => {
          handleEnd();
        };

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;
        const pendingCandidates: RTCIceCandidateInit[] = [];
        const pendingRemoteCandidates: RTCIceCandidateInit[] = [];

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Optional meeting devices (fail soft - meeting continues without them)
        if (permissions.mic) {
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (cancelled) {
              micStream.getTracks().forEach((t) => t.stop());
            } else {
              micStream.getAudioTracks().forEach((track) => pc.addTrack(track, micStream));
              micRef.current = micStream;
            }
          } catch (e) {
            console.warn('[sharing] mic unavailable, continuing without it', e);
          }
        }
        if (permissions.camera) {
          try {
            const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (cancelled) {
              camStream.getTracks().forEach((t) => t.stop());
            } else {
              camRef.current = camStream;
              const tile = document.createElement('video');
              tile.id = 'camera-preview-tile';
              tile.autoplay = true;
              (tile as any).playsInline = true;
              (tile as HTMLVideoElement).muted = true;
              tile.style.cssText =
                'position:fixed;bottom:16px;right:16px;width:160px;border-radius:8px;z-index:50;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
              (tile as HTMLVideoElement).srcObject = camStream;
              document.body.appendChild(tile);
            }
          } catch (e) {
            console.warn('[sharing] camera unavailable, continuing without it', e);
          }
        }

        // Data channels for remote control + file transfer + clipboard
        const fileReceivers = new Map<string, { chunks: ArrayBuffer[], fileName: string, fileSize: number, received: number }>();
        if (permissions.control || permissions.file_transfer || permissions.clipboard) {
          pc.ondatachannel = (event) => {
            const channel = event.channel;
            console.log('[data] ondatachannel', channel.label);
            if (channel.label === 'control' && permissions.control) {
              channel.onopen = () => console.log('[control] data channel open');
              channel.onmessage = (e) => {
                try {
                  const input = JSON.parse(e.data as string);
                  if (input.type === 'mousemove' && input.x !== undefined) {
                    const ev = new MouseEvent('mousemove', { clientX: input.x, clientY: input.y, bubbles: true });
                    document.dispatchEvent(ev);
                  } else if (input.type === 'mousedown') {
                    const ev = new MouseEvent('mousedown', { clientX: input.x, clientY: input.y, button: input.button || 0, bubbles: true });
                    const el = document.elementFromPoint(input.x, input.y);
                    el?.dispatchEvent(ev);
                  } else if (input.type === 'mouseup') {
                    const ev = new MouseEvent('mouseup', { clientX: input.x, clientY: input.y, button: input.button || 0, bubbles: true });
                    const el = document.elementFromPoint(input.x, input.y);
                    el?.dispatchEvent(ev);
                  } else if (input.type === 'click') {
                    const el = document.elementFromPoint(input.x, input.y) as HTMLElement;
                    el?.click();
                  } else if (input.type === 'wheel') {
                    const ev = new WheelEvent('wheel', { deltaY: input.deltaY, bubbles: true });
                    const el = document.elementFromPoint(input.x, input.y);
                    el?.dispatchEvent(ev);
                  } else if (input.type === 'keydown' || input.type === 'keyup') {
                    const ev = new KeyboardEvent(input.type, { key: input.key, code: input.code, bubbles: true });
                    document.dispatchEvent(ev);
                  } else if (input.type === 'paste' && permissions.clipboard) {
                    navigator.clipboard.writeText(input.text || '').catch(()=>{});
                  }
                } catch {}
              };
            } else if (channel.label === 'file' && permissions.file_transfer) {
              let fileMeta: { fileName: string, fileSize: number } | null = null;
              channel.onmessage = (e) => {
                if (typeof e.data === 'string') {
                  try {
                    const msg = JSON.parse(e.data as string);
                    if (msg.type === 'file-start') {
                      fileMeta = { fileName: msg.fileName, fileSize: msg.fileSize };
                      fileReceivers.set(msg.fileName, { chunks: [], fileName: msg.fileName, fileSize: msg.fileSize, received: 0 });
                      console.log('[file] start', msg.fileName, msg.fileSize);
                            } else if (msg.type === 'file-end' && fileMeta) {
                              const rec = fileReceivers.get(fileMeta.fileName);
                              if (rec) {
                                const blob = new Blob(rec.chunks);
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = rec.fileName;
                                a.style.display = 'none';
                                document.body.appendChild(a);
                                a.click();
                                setTimeout(() => {
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                }, 30000);
                                fileReceivers.delete(fileMeta.fileName);
                                console.log('[file] received', rec.fileName, blob.size, 'bytes');
                              }
                    }
                  } catch {}
                } else {
                  // binary chunk
                  if (fileMeta) {
                    const rec = fileReceivers.get(fileMeta.fileName);
                    if (rec) {
                      rec.chunks.push(e.data as ArrayBuffer);
                      rec.received += (e.data as ArrayBuffer).byteLength;
                    }
                  }
                }
              };
            } else if (channel.label === 'clipboard' && permissions.clipboard) {
              channel.onmessage = (e) => {
                try {
                  const msg = JSON.parse(e.data as string);
                  if (msg.type === 'clipboard' && msg.text) {
                    navigator.clipboard.writeText(msg.text).catch(()=>{});
                  }
                } catch {}
              };
            }
          };
          if (permissions.clipboard) {
            try {
              const clipChannel = pc.createDataChannel('clipboard');
              clipChannel.onopen = () => {
                document.addEventListener('copy', () => {
                  navigator.clipboard.readText().then((t) => {
                    if (clipChannel.readyState === 'open') clipChannel.send(JSON.stringify({ type: 'clipboard', text: t }));
                  }).catch(()=>{});
                });
              };
            } catch {}
          }
          // File channel will be created by technician; client just waits for ondatachannel
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/signaling`);
        wsRef.current = ws;

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          const payload = event.candidate.toJSON();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'ice-candidate',
                session_id: sessionId,
                payload,
              })
            );
          } else {
            pendingCandidates.push(payload);
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('[sharing] pc state', pc.connectionState);
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            setError('Connection failed - trying to reconnect');
          }
        };

        const sendOffer = async () => {
          if (cancelled || pc.signalingState !== 'stable') return;
          try {
            const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
            await pc.setLocalDescription(offer);
            console.log('[sharing] sending offer', offer.type);
            ws.send(
              JSON.stringify({
                type: 'offer',
                session_id: sessionId,
                payload: offer,
              })
            );
            // flush pending candidates
            for (const c of pendingCandidates.splice(0)) {
              ws.send(JSON.stringify({ type: 'ice-candidate', session_id: sessionId, payload: c }));
            }
          } catch (err) {
            console.error('[sharing] failed to create offer', err);
            setError('Failed to start sharing');
          }
        };

        ws.onopen = async () => {
          if (cancelled) return;
          console.log('[sharing] ws open, sending offer for', sessionId);
          // flush any candidates that were queued before open
          await sendOffer();
          // retry offer if no answer after 3s (technician may have joined late)
          setTimeout(async () => {
            if (cancelled) return;
            if (pc.signalingState === 'have-local-offer') {
              console.log('[sharing] no answer yet, resending offer');
              await sendOffer();
            }
          }, 3000);
        };

        ws.onmessage = async (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'connected') {
              console.log('[sharing] signaling connected as', msg.role);
              return;
            }
            if (msg.type === 'answer' && msg.payload) {
              console.log('[sharing] received answer');
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
                for (const c of pendingRemoteCandidates.splice(0)) {
                  try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
                }
              }
            } else if (msg.type === 'ice-candidate' && msg.payload) {
              try {
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
                } else {
                  pendingRemoteCandidates.push(msg.payload);
                }
              } catch (e) {
                console.warn('[sharing] addIceCandidate failed', e);
              }
            } else if (msg.type === 'session-end' || msg.type === 'error') {
              if (msg.message === 'Session ended') {
                handleEnd();
              }
            }
          } catch (err) {
            console.error('[sharing] ws message error', err);
          }
        };

        ws.onclose = () => {
          if (!cancelled && sharing) {
            console.log('[sharing] ws closed');
          }
        };

        ws.onerror = (err) => {
          console.error('[sharing] ws error', err);
          if (!cancelled) {
            setError('Could not connect to the support server. Try refreshing the page.');
          }
        };
      } catch (err: any) {
        console.error('[sharing] getDisplayMedia failed', err);
        if (cancelled) return;
        if (err?.name === 'NotAllowedError') {
          setError('Screen share permission was denied. Please click "End Session" and re-join to try again.');
        } else {
          setError(err?.message || 'Failed to start screen sharing');
        }
      }
    };

    startSharing();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (micRef.current) {
        micRef.current.getTracks().forEach((t) => t.stop());
        micRef.current = null;
      }
      if (camRef.current) {
        camRef.current.getTracks().forEach((t) => t.stop());
        camRef.current = null;
      }
      document.getElementById('camera-preview-tile')?.remove();
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {}
        pcRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
    };
  }, [sessionId, permissions.view, permissions.audio, permissions.control, permissions.camera, permissions.mic, retryCount]);

  // If capture hasn't started after a few seconds, the system permission
  // prompt is probably waiting (or was missed). Show actionable guidance.
  useEffect(() => {
    if (sharing || error) return;
    const t = setTimeout(() => setStalled(true), 8000);
    return () => clearTimeout(t);
  }, [sharing, error, retryCount, sessionId]);

  const handleRetry = () => {
    setError(null);
    setStalled(false);
    setSharing(false);
    setRetryCount((c) => c + 1);
  };

  const handleEnd = async () => {
    if (ending) return;
    if (!confirm('End this support session? The technician will lose access immediately.')) {
      return;
    }
    setEnding(true);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (pcRef.current) pcRef.current.close();
      if (wsRef.current) wsRef.current.close();
    } catch {}
    await onEndSession();
  };

  return (
    <div className="fixed inset-0 pointer-events-none">
      <div className={`fixed top-4 right-4 pointer-events-auto ${isMobile ? 'left-4' : ''}`}>
        <div className="bg-red-600 text-white rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 w-full hover:bg-red-700 transition-colors ${isMobile ? 'text-sm' : ''}`}
          >
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-medium">Screen Shared</span>
            <span className="text-red-200 hidden sm:inline">•</span>
            <span className="text-xs sm:text-sm text-red-200">{sharing ? 'Active' : 'Starting...'}</span>
          </button>

          {showDetails && (
            <div className="border-t border-red-500 bg-red-700 p-4">
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Active Permissions:</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span>Screen viewing</span>
                    {sharing && <span className="ml-auto text-green-200 text-xs">● sharing</span>}
                  </div>
                  {permissions.control && (
                    <div className="flex items-center gap-2">
                      <MousePointer className="w-4 h-4" />
                      <span>Remote control</span>
                    </div>
                  )}
                  {permissions.clipboard && (
                    <div className="flex items-center gap-2">
                      <Clipboard className="w-4 h-4" />
                      <span>Clipboard sync</span>
                    </div>
                  )}
                  {permissions.file_transfer && (
                    <div className="flex items-center gap-2">
                      <FileUp className="w-4 h-4" />
                      <span>File transfer</span>
                    </div>
                  )}
                  {permissions.audio && (
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4" />
                      <span>Audio sharing</span>
                    </div>
                  )}
                  {permissions.camera && (
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      <span>Camera</span>
                    </div>
                  )}
                  {permissions.mic && (
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4" />
                      <span>Microphone</span>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-400/30 rounded-xl p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-400/20 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-100 mb-1">Connection Issue</p>
                      <p className="text-xs text-amber-200/70 leading-relaxed">Sharing hit a snag — use Try again, or ask your technician for help.</p>
                    </div>
                  </div>
                </div>
              )}

              {!sharing && !error && (
                <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-400/20 rounded-lg flex items-center justify-center">
                      <Monitor className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-100 mb-0.5">Preparing screen share</p>
                      <p className="text-xs text-blue-200/70">Select the screen or window to share in the browser prompt.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-red-800 rounded p-3 mb-3">
                <p className="text-sm text-red-200">
                  Your screen is being shared with a support technician. You can end this session at any time.
                  {permissions.control && ' Remote control is enabled.'}
                </p>
                {!permissions.control && (
                  <p className="text-xs text-red-300 mt-1">Tip: re-join and enable “Remote control” if you want the technician to control your mouse/keyboard.</p>
                )}
              </div>

              <button
                onClick={handleEnd}
                disabled={ending}
                className="w-full py-2 bg-white text-red-600 font-medium rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {ending ? 'Ending...' : 'End Session'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`fixed bottom-4 left-4 pointer-events-auto ${isMobile ? 'right-4' : ''}`}>
        <div className="bg-white rounded-lg shadow-lg p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
          <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
          <div className="text-xs sm:text-sm">
            <div className="font-medium text-gray-900">Protected Session</div>
            <div className="text-gray-500">End anytime</div>
          </div>
        </div>
      </div>

      {/* Friendly fallback only — details stay on the technician side. */}
      {error && (
        <div className="fixed bottom-20 left-4 right-4 pointer-events-auto">
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-center">
            <p className="text-sm text-gray-700 mb-3">Couldn't start sharing.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRetry}
                className="flex-1 py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={handleEnd}
                className="flex-1 py-2 px-4 text-sm text-gray-500"
              >
                End session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Still not sharing after several seconds: the OS/browser permission
          prompt is waiting or was dismissed. Make it unmissable + retryable. */}
      {!sharing && !error && stalled && (
        <div className="fixed inset-0 pointer-events-auto flex items-center justify-center bg-black/60 p-4 z-50">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Waiting for permission</h2>
            {isMobile ? (
              <p className="text-sm text-gray-600 mb-4">
                Your phone shows a system popup after you tap Allow.
                Choose <strong>Entire screen</strong>, then tap{' '}
                <strong>Start recording</strong> / <strong>Start now</strong>.
                Nothing appearing? Tap Try again.
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-4">
                Your browser shows a picker to choose what to share.
                Select a screen or window, then click <strong>Share</strong>.
                Nothing appearing? Tap Try again.
              </p>
            )}
            <button
              type="button"
              onClick={handleRetry}
              className="w-full py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={handleEnd}
              className="w-full mt-2 py-2 px-4 text-sm text-gray-500 hover:text-gray-700"
            >
              End session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
