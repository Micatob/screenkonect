import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { authFetch, copyTextWithFallback } from '../App';
import { Monitor, Copy, CheckCircle, XCircle, AlertCircle, Clock, ArrowLeft } from 'lucide-react';
import type { Session } from '@screenkonect/shared';

export function Session() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { join_url?: string } };
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [joinUrl, setJoinUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    fetchSession();
  }, [id]);

  // Poll until active/ended so technician sees consent changes without refresh
  useEffect(() => {
    if (!session) return;
    if (session.status === 'created' || session.status === 'pending_approval') {
      const iv = setInterval(fetchSession, 3000);
      return () => clearInterval(iv);
    }
  }, [session?.status, session?.id]);

  useEffect(() => {
    if (session?.status === 'active') {
      connectSignaling();
    }
    return () => {
      wsRef.current?.close();
      pcRef.current?.close();
    };
  }, [session?.status]);

  const fetchSession = async () => {
    try {
      const res = await authFetch(`/v1/sessions/${id}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error || 'Failed to fetch session');
      setSession(data.session);

      if (data.session) {
        // Priority: navigation state > sessionStorage > fallback
        const stateUrl = (location.state as any)?.join_url;
        const storedUrl = sessionStorage.getItem(`sk_join_url_${data.session.id}`);
        const storedToken = sessionStorage.getItem(`sk_join_token_${data.session.id}`);
        if (stateUrl) {
          setJoinUrl(stateUrl);
          sessionStorage.setItem(`sk_join_url_${data.session.id}`, stateUrl);
        } else if (storedUrl) {
          setJoinUrl(storedUrl);
        } else if (storedToken) {
          const reconstructed = `${window.location.origin}/join/${data.session.session_code}?token=${storedToken}`;
          setJoinUrl(reconstructed);
        } else {
          // No token available (already used or page reloaded after cleanup) - show code-only hint
          // Still set a link without token so UI isn't blank; it will fail but technician knows code
          setJoinUrl(`${window.location.origin}/join/${data.session.session_code}?token=`);
        }
      }
    } catch (err) {
      console.error('Failed to fetch session:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectSignaling = useCallback(() => {
    if (!session) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/signaling`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[signaling] connected as technician for', session.id);
      // Register as technician so stored offers can be delivered even if client joined first
      try {
        ws.send(JSON.stringify({ type: 'join', session_id: session.id, role: 'technician' }));
      } catch {}
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'connected') {
          console.log('[signaling] registered as', msg.role);
          return;
        }
        handleSignalingMessage(msg);
      } catch (e) {
        console.error('[signaling] parse error', e);
      }
    };

    ws.onclose = () => {
      if (session?.status === 'active') {
        setTimeout(connectSignaling, 3000);
      }
    };

    ws.onerror = (e) => console.error('[signaling] ws error', e);
  }, [session?.id, session?.status]);

  const handleSignalingMessage = async (msg: any) => {
    if (msg.type === 'offer' && msg.payload) {
      try {
        console.log('[signaling] received offer');
        // Clean previous PC if any
        if (pcRef.current) {
          try { pcRef.current.close(); } catch {}
        }
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;
        const pendingRemoteCandidates: RTCIceCandidateInit[] = [];
        let controlChannel: RTCDataChannel | null = null;

        (pc as any)._pendingCandidates = pendingRemoteCandidates;

        // Create control data channel (technician -> client)
        if (session?.permissions?.control) {
          try {
            controlChannel = pc.createDataChannel('control', { ordered: true });
            controlChannel.onopen = () => console.log('[control] data channel open');
            controlChannel.onclose = () => console.log('[control] data channel closed');
            (pc as any)._controlChannel = controlChannel;
            // Also handle clipboard channel from client
            pc.ondatachannel = (ev) => {
              if (ev.channel.label === 'clipboard') {
                ev.channel.onmessage = (e) => {
                  try {
                    const msg = JSON.parse(e.data);
                    if (msg.type === 'clipboard' && msg.text) {
                      navigator.clipboard.writeText(msg.text).catch(()=>{});
                    }
                  } catch {}
                };
              }
            };
          } catch (e) { console.warn('[control] createDataChannel failed', e); }
        }

        pc.ontrack = (event) => {
          console.log('[webrtc] ontrack', event.streams[0]?.id, event.track.kind, 'streams', event.streams.length);
          const stream = event.streams[0];
          if (!stream) {
            // Fallback: use track directly
            const fallbackStream = new MediaStream([event.track]);
            console.log('[webrtc] no stream, using track');
            attachStream(fallbackStream);
            return;
          }
          attachStream(stream);
        };

        const attachStream = (stream: MediaStream) => {
          // Ensure video track is enabled and not ended
          const vTracks = stream.getVideoTracks();
          console.log('[webrtc] video tracks', vTracks.length, vTracks[0]?.readyState, vTracks[0]?.enabled);
          if (vTracks.length === 0) {
            console.warn('[webrtc] no video tracks in stream');
            return;
          }
          if (vTracks[0].readyState === 'ended') {
            console.warn('[webrtc] video track ended');
            return;
          }
          // Lock display to one: use first track only, disable others to avoid mirror
          vTracks.slice(1).forEach(t => { t.enabled = false; t.stop(); });
          let video = document.getElementById('remote-video') as HTMLVideoElement | null;
          if (!video) {
            video = document.createElement('video');
            video.id = 'remote-video';
            video.autoplay = true;
            (video as any).playsInline = true;
            video.muted = true;
            video.controls = false;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'contain';
            video.style.background = 'black';
            // Fix for Firefox: ensure video is not mirrored
            video.style.transform = 'none';
            const container = document.getElementById('remote-screen');
            if (container) {
              container.innerHTML = '';
              container.appendChild(video);
              // Attach input handlers for remote control
              if (session?.permissions?.control) {
                attachControlHandlers(video, pc);
              }
            }
          }
          (video as HTMLVideoElement).srcObject = stream;
          // Ensure video actually plays (handle browser autoplay)
          const playPromise = (video as HTMLVideoElement).play();
          if (playPromise) playPromise.catch((e) => {
            console.warn('[webrtc] play failed, trying muted play', e);
            (video as HTMLVideoElement).muted = true;
            (video as HTMLVideoElement).play().catch(()=>{});
          });
          // Remove any black screen placeholder
          const placeholder = document.getElementById('remote-placeholder');
          if (placeholder) placeholder.remove();
        };

        const attachControlHandlers = (video: HTMLVideoElement, pc: RTCPeerConnection) => {
          const getChannel = () => (pc as any)._controlChannel as RTCDataChannel | null;
          const send = (data: any) => {
            const ch = getChannel();
            if (ch && ch.readyState === 'open') {
              ch.send(JSON.stringify(data));
            }
          };
          const rect = () => video.getBoundingClientRect();
          // Prevent context menu
          video.addEventListener('contextmenu', (e) => e.preventDefault());
          video.addEventListener('mousemove', (e) => {
            const r = rect();
            const x = Math.round(((e.clientX - r.left) / r.width) * 1920);
            const y = Math.round(((e.clientY - r.top) / r.height) * 1080);
            send({ type: 'mousemove', x: e.clientX, y: e.clientY, rx: x, ry: y });
          });
          video.addEventListener('mousedown', (e) => {
            send({ type: 'mousedown', x: e.clientX, y: e.clientY, button: e.button });
          });
          video.addEventListener('mouseup', (e) => {
            send({ type: 'mouseup', x: e.clientX, y: e.clientY, button: e.button });
          });
          video.addEventListener('click', (e) => {
            send({ type: 'click', x: e.clientX, y: e.clientY });
          });
          video.addEventListener('wheel', (e) => {
            send({ type: 'wheel', x: e.clientX, y: e.clientY, deltaY: e.deltaY });
            e.preventDefault();
          }, { passive: false });
          video.addEventListener('keydown', (e) => {
            send({ type: 'keydown', key: e.key, code: e.code });
          });
          // Focus video for keyboard
          video.tabIndex = 0;
          video.addEventListener('click', () => video.focus());
        };

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          const payload = event.candidate.toJSON();
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current!.send(
              JSON.stringify({
                type: 'ice-candidate',
                session_id: session?.id,
                payload,
              })
            );
          } else {
            pendingRemoteCandidates.push(payload);
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('[webrtc] state', pc.connectionState);
        };
        pc.oniceconnectionstatechange = () => {
          console.log('[webrtc] ice state', pc.iceConnectionState);
        };

        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        // flush any candidates that arrived before remoteDescription
        for (const c of pendingRemoteCandidates.splice(0)) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[signaling] sending answer');
        wsRef.current?.send(
          JSON.stringify({
            type: 'answer',
            session_id: session?.id,
            payload: answer,
          })
        );
      } catch (err) {
        console.error('[signaling] failed to handle offer', err);
      }
    } else if (msg.type === 'ice-candidate' && msg.payload) {
      try {
        if (pcRef.current?.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload));
        } else if (pcRef.current) {
          // queue until remoteDescription is set
          const pending = (pcRef.current as any)._pendingCandidates as RTCIceCandidateInit[] | undefined;
          if (pending) pending.push(msg.payload);
          else await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload));
        }
      } catch (err) {
        console.error('[signaling] ice candidate error', err);
      }
    } else if (msg.type === 'answer') {
      console.log('[signaling] unexpected answer for technician', msg);
    }
  };

  const copyJoinUrl = async () => {
    if (!joinUrl) return;
    const ok = await copyTextWithFallback(joinUrl);
    setCopied(ok);
    if (!ok) {
      // Fallback: select the visible input so user can copy manually
      const el = document.getElementById('join-url-input') as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const endSession = async () => {
    if (!confirm('Are you sure you want to end this session?')) return;

    try {
      await authFetch(`/v1/sessions/${id}/end`, {
        method: 'POST',
      });
      navigate('/');
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending_approval':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'ended':
        return <XCircle className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading session...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Session not found</h2>
          <button onClick={() => navigate('/')} className="text-blue-600 hover:text-blue-800">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Monitor className="w-6 h-6 text-blue-400" />
            <h1 className="text-lg font-semibold text-white">Session {session.session_code}</h1>
            <div className="flex items-center gap-2">
              {getStatusIcon(session.status)}
              <span className="text-sm text-gray-300">
                {session.status === 'active'
                  ? 'Connected'
                  : session.status === 'pending_approval'
                  ? 'Awaiting consent'
                  : session.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {joinUrl && (
              <button
                onClick={copyJoinUrl}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                Copy join link
              </button>
            )}
            <button
              onClick={endSession}
              className="px-4 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
            >
              End Session
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto p-4">
        {session.status === 'created' && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-gray-800 rounded-lg p-8 text-center max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">Waiting for client</h2>
              <p className="text-gray-400 mb-6">
                Send the join link to the person you want to help. They will need to approve
                the session before you can view their screen.
              </p>
              {joinUrl && (
                <div className="bg-gray-900 rounded p-3 mb-4">
                  <input
                    id="join-url-input"
                    readOnly
                    value={joinUrl}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full bg-transparent text-sm text-green-400 break-all outline-none"
                  />
                </div>
              )}
              <button
                onClick={copyJoinUrl}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {copied ? 'Copied!' : 'Copy join link'}
              </button>
              {!copied && joinUrl && (
                <p className="text-xs text-gray-500 mt-2">If auto-copy is blocked, tap the link above to select and copy manually.</p>
              )}
            </div>
          </div>
        )}

        {session.status === 'pending_approval' && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-8 text-center max-w-md">
              <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Awaiting consent</h2>
              <p className="text-gray-400">
                The client has joined but has not yet approved the session.
                Once they approve, you will be able to view their screen.
              </p>
            </div>
          </div>
        )}

        {session.status === 'active' && (
          <div className="flex gap-4">
            <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden">
              <div
                id="remote-screen"
                className="w-full aspect-video bg-black flex items-center justify-center relative"
              >
                <canvas ref={canvasRef} className="w-full h-full hidden" />
                <div id="remote-placeholder" className="text-gray-500 text-sm">Waiting for screen share... (client must choose Entire Screen for desktop)</div>
              </div>
              {session.client_platform && session.client_platform === 'windows' && (
                <div className="bg-yellow-900/20 border-t border-yellow-800 p-2 text-xs text-yellow-300">
                  Tip: If both windows are on same PC, sharing Entire Screen will mirror. Use a second device or share Window to avoid loop. Remote control needs Rust agent for OS-level; browser tab control is limited to page.
                </div>
              )}
            </div>
            <div className="w-80 bg-gray-800 rounded-lg p-4 space-y-4">
              <div>
                <h3 className="text-white font-semibold mb-4">Session Info</h3>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-gray-400">Status</dt>
                    <dd className="text-white">{session.status}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Platform</dt>
                    <dd className="text-white">{session.client_platform || 'Unknown'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Consent</dt>
                    <dd className="text-white">{session.consent_state}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Permissions</dt>
                    <dd className="text-white">
                      {session.permissions?.view && 'View '}
                      {session.permissions?.control && 'Control '}
                      {session.permissions?.clipboard && 'Clipboard '}
                      {session.permissions?.file_transfer && 'File Transfer '}
                      {session.permissions?.audio && 'Audio'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Started</dt>
                    <dd className="text-white">
                      {session.started_at ? new Date(session.started_at).toLocaleString() : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
              {session.permissions?.control && (
                <div className="border-t border-gray-700 pt-4">
                  <h4 className="text-white text-sm font-medium mb-2">Remote Control</h4>
                  <p className="text-xs text-gray-400 mb-2">Click/drag on video to control. Keyboard when video focused. Requires client enabled control.</p>
                  <div className="text-xs text-yellow-300 bg-yellow-900/20 rounded p-2">
                    Browser control is page-level only - browsers block OS-desktop control for security, no workaround without client action. For full desktop the client must run the desktop agent (one click, no tech skills once packaged).
                  </div>
                </div>
              )}
              {session.permissions?.file_transfer && (
                <div className="border-t border-gray-700 pt-4">
                  <h4 className="text-white text-sm font-medium mb-2">File Transfer</h4>
                  <input
                    type="file"
                    id="file-input"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const pc: any = pcRef.current;
                      let fileCh = pc?._fileChannel as RTCDataChannel | undefined;
                      if (!fileCh || (fileCh as RTCDataChannel).readyState !== 'open') {
                        try {
                          const newCh = (pc as RTCPeerConnection).createDataChannel('file', { ordered: true });
                          (pc as any)._fileChannel = newCh;
                          newCh.onopen = () => console.log('[file] channel open');
                        } catch {}
                      }
                      const sendFile = () => {
                        const channel = (pcRef.current as any)?._fileChannel as RTCDataChannel | undefined;
                        if (!channel || channel.readyState !== 'open') {
                          setTimeout(sendFile, 200);
                          return;
                        }
                        channel.send(JSON.stringify({ type: 'file-start', fileName: file.name, fileSize: file.size }));
                        const chunkSize = 16384;
                        let offset = 0;
                        const reader = new FileReader();
                        const readSlice = () => {
                          const slice = file.slice(offset, offset + chunkSize);
                          reader.readAsArrayBuffer(slice);
                        };
                        reader.onload = (ev) => {
                          if (ev.target?.result) {
                            channel.send(ev.target.result as ArrayBuffer);
                            offset += chunkSize;
                            if (offset < file.size) readSlice();
                            else channel.send(JSON.stringify({ type: 'file-end', fileName: file.name }));
                          }
                        };
                        readSlice();
                      };
                      sendFile();
                    }}
                  />
                  <button
                    onClick={() => document.getElementById('file-input')?.click()}
                    className="w-full py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Send File
                  </button>
                  <p className="text-xs text-gray-500 mt-1">Client will auto-download.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {session.status === 'ended' && (
          <div className="flex flex-col items-center justify-center py-20">
            <XCircle className="w-16 h-16 text-gray-500 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Session ended</h2>
            <p className="text-gray-400 mb-4">
              This session has ended{session.ended_reason ? ` (${session.ended_reason})` : ''}.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Back to dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
