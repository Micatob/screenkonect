import { useState, useEffect } from 'react';
import { ConsentScreen } from './ConsentScreen';
import { SessionIndicator } from './SessionIndicator';
import { AlertCircle, RefreshCw } from 'lucide-react';

type AppState = 'loading' | 'consent' | 'active' | 'error' | 'ended';

interface SessionInfo {
  id: string;
  status: string;
  consent_state: string;
  max_duration_minutes?: number;
  permissions: {
    view: boolean;
    control: boolean;
    clipboard: boolean;
    file_transfer: boolean;
    audio: boolean;
    camera?: boolean;
    mic?: boolean;
  };
}

export default function App() {
  const [state, setState] = useState<AppState>('loading');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<'monitor' | 'window' | 'browser'>('monitor');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    // Join URL format is /join/<CODE>?token=xxx - code is in pathname, not query
    // Keep backward compat: also accept ?session_id / ?code if present
    const pathMatch = window.location.pathname.match(/\/join\/([^/?#]+)/);
    const codeFromPath = pathMatch ? pathMatch[1] : null;

    if (!token) {
      // No token -> invalid link regardless of path
      setError(
        codeFromPath
          ? 'Invalid join link: missing token. Please request a new link from your support technician.'
          : 'Invalid join link. Please request a new link from your support technician.'
      );
      setState('error');
      return;
    }

    joinSession(token);
  }, []);

  const joinSession = async (token: string) => {
    try {
      const platform = detectPlatform();
      const res = await fetch('/v1/sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setSession(data.session);

      // Handle both manual consent and auto-approved (notification_only/admin_only) flows
      if (data.session.status === 'active') {
        setState('active');
      } else if (data.session.consent_state === 'approved' || data.session.consent_state === 'auto_approved') {
        setState('active');
      } else if (data.session.status === 'ended') {
        setState('ended');
      } else {
        setState('consent');
      }
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError(
          'Unable to connect to the server.\n' +
          'The support link may have expired, or the server is not reachable from your network.\n' +
          'Ask your technician for a new link, or check that the server is running.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Failed to join session');
      }
      setState('error');
    }
  };

  const handleApprove = async (permissions: {
    view: boolean;
    control: boolean;
    clipboard: boolean;
    file_transfer: boolean;
    audio: boolean;
    camera: boolean;
    mic: boolean;
  }, target: 'monitor' | 'window' | 'browser' = 'monitor') => {
    if (!session) return;
    setShareTarget(target);

    try {
      const res = await fetch(`/v1/sessions/${session.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });

      if (!res.ok) {
        throw new Error('Failed to approve session');
      }

      const data = await res.json();
      setSession(data.session);
      setState('active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve session');
    }
  };

  const handleReject = async () => {
    if (!session) return;

    try {
      const res = await fetch(`/v1/sessions/${session.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'User declined' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || 'Failed to deny session - please close this window instead (session stays pending).');
      }

      setState('ended');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deny session');
      setState('error');
    }
  };

  const handleEndSession = async () => {
    if (!session) return;

    try {
      await fetch(`/v1/sessions/${session.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      setState('ended');
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  };

  const detectPlatform = (): 'windows' | 'macos' | 'linux' | 'android' | 'ios' => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
    if (ua.includes('win')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    return 'linux';
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Joining session...</p>
        </div>
      </div>
    );
  }

  if (state === 'consent' && session) {
    return (
      <ConsentScreen
        sessionId={session.id}
        durationMinutes={session.max_duration_minutes || 60}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    );
  }

  if (state === 'active' && session) {
    return (
      <SessionIndicator
        sessionId={session.id}
        permissions={session.permissions}
        shareTarget={shareTarget}
        onEndSession={handleEndSession}
      />
    );
  }

  if (state === 'error') {
    const lines = error?.split('\n').filter(s => s.trim()) || [];

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-center">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                <AlertCircle className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-white">Connection Error</h1>
            </div>

            <div className="p-6">
              <div className="space-y-2 mb-5">
                {lines.map((line, i) => (
                  <p key={i} className="text-sm text-gray-600 leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>

              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'ended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Session Ended</h1>
          <p className="text-gray-600">
            The support session has been ended. You can close this window.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'consent' && session) {
    return (
      <ConsentScreen
        sessionId={session.id}
        durationMinutes={session.max_duration_minutes || 60}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    );
  }

  if (state === 'active' && session) {
    return (
      <SessionIndicator
        sessionId={session.id}
        permissions={session.permissions}
        shareTarget={shareTarget}
        onEndSession={handleEndSession}
      />
    );
  }

  return null;
}
