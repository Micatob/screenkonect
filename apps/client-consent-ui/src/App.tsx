import { useState, useEffect } from 'react';
import { ConsentScreen } from './ConsentScreen';
import { SessionIndicator } from './SessionIndicator';

type AppState = 'loading' | 'consent' | 'active' | 'error' | 'ended';

interface SessionInfo {
  id: string;
  status: string;
  consent_state: string;
  permissions: {
    view: boolean;
    control: boolean;
    clipboard: boolean;
    file_transfer: boolean;
    audio: boolean;
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
        const data = await res.json();
        throw new Error(data.error || 'Failed to join session');
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
      setError(err instanceof Error ? err.message : 'Failed to join session');
      setState('error');
    }
  };

  const handleApprove = async (permissions: {
    view: boolean;
    control: boolean;
    clipboard: boolean;
    file_transfer: boolean;
    audio: boolean;
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

  const detectPlatform = (): 'windows' | 'macos' | 'linux' => {
    const ua = navigator.userAgent.toLowerCase();
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

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✕</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Connection Error</h1>
          <p className="text-gray-600">{error}</p>
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
