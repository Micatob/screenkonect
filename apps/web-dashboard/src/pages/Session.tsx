import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Monitor, Copy, CheckCircle, XCircle, AlertCircle, Clock, ArrowLeft } from 'lucide-react';
import type { Session } from '@screenkonect/shared';

export function Session() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [joinUrl, setJoinUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchSession();
  }, [id]);

  useEffect(() => {
    if (session?.status === 'active') {
      connectSignaling();
    }
    return () => {
      wsRef.current?.close();
    };
  }, [session?.status]);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/v1/sessions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSession(data.session);

      if (data.session) {
        const joinToken = new URLSearchParams(window.location.search).get('token');
        if (joinToken) {
          setJoinUrl(`${window.location.origin}/join/${data.session.session_code}?token=${joinToken}`);
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
      ws.send(
        JSON.stringify({
          type: 'answer',
          session_id: session.id,
          payload: {},
        })
      );
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleSignalingMessage(msg);
    };

    ws.onclose = () => {
      if (session?.status === 'active') {
        setTimeout(connectSignaling, 3000);
      }
    };
  }, [session?.id, session?.status]);

  const handleSignalingMessage = async (msg: any) => {
    if (msg.type === 'offer') {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      pc.ontrack = (event) => {
        const video = document.createElement('video');
        video.srcObject = event.streams[0];
        video.autoplay = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';

        const container = document.getElementById('remote-screen');
        if (container) {
          container.innerHTML = '';
          container.appendChild(video);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: 'ice-candidate',
              session_id: session?.id,
              payload: event.candidate,
            })
          );
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      wsRef.current?.send(
        JSON.stringify({
          type: 'answer',
          session_id: session?.id,
          payload: answer,
        })
      );
    }
  };

  const copyJoinUrl = () => {
    if (joinUrl) {
      navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const endSession = async () => {
    if (!confirm('Are you sure you want to end this session?')) return;

    try {
      await fetch(`/v1/sessions/${id}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
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
                  <code className="text-sm text-green-400 break-all">{joinUrl}</code>
                </div>
              )}
              <button
                onClick={copyJoinUrl}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {copied ? 'Copied!' : 'Copy join link'}
              </button>
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
                className="w-full aspect-video bg-black flex items-center justify-center"
              >
                <canvas ref={canvasRef} className="w-full h-full" />
              </div>
            </div>
            <div className="w-80 bg-gray-800 rounded-lg p-4">
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
