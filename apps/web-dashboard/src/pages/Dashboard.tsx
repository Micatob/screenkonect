import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, authFetch } from '../App';
import { Monitor, Plus, LogOut, Clock, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import type { Session } from '@screenkonect/shared';

export function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await authFetch('/v1/sessions');
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    setCreating(true);
    try {
      const res = await authFetch('/v1/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create session');
      }
      if (data.session) {
        // Persist join link because GET /:id does not return token (security)
        if (data.join_url) {
          sessionStorage.setItem(`sk_join_url_${data.session.id}`, data.join_url);
        }
        if (data.join_token) {
          sessionStorage.setItem(`sk_join_token_${data.session.id}`, data.join_token);
        }
        if (data.join_url) {
          try {
            await navigator.clipboard.writeText(data.join_url);
          } catch {}
        }
        navigate(`/session/${data.session.id}`, { state: { join_url: data.join_url } });
      }
    } catch (err) {
      console.error('Failed to create session:', err);
      alert(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setCreating(false);
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

  const deleteSession = async (id: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await authFetch(`/v1/sessions/${id}`, {
        method: 'DELETE',
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setSessions((prev) => prev.filter((s) => s.id !== id));
      sessionStorage.removeItem(`sk_join_url_${id}`);
      sessionStorage.removeItem(`sk_join_token_${id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const deleteBulk = async (mode: 'ended' | 'created' | 'expired' | 'all') => {
    const msg =
      mode === 'all'
        ? 'Delete ALL your sessions? This cannot be undone.'
        : `Delete all ${mode} sessions?`;
    if (!confirm(msg)) return;
    try {
      const qs = mode === 'all' ? '?all=true' : `?status=${mode}`;
      const res = await authFetch(`/v1/sessions${qs}`, {
        method: 'DELETE',
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error || 'Bulk delete failed');
      alert(`Deleted ${data.deleted_count || 0} sessions`);
      fetchSessions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bulk delete failed');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'created':
        return 'Waiting for client';
      case 'pending_approval':
        return 'Awaiting consent';
      case 'active':
        return 'In progress';
      case 'paused':
        return 'Paused';
      case 'ended':
        return 'Ended';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold">ScreenKonect</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.display_name || user?.email}</span>
            <button
              onClick={logout}
              className="p-2 text-gray-500 hover:text-gray-700"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Support Sessions</h2>
          <div className="flex items-center gap-2">
            {sessions.length > 0 && (
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={() => deleteBulk('ended')}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  title="Delete all ended sessions"
                >
                  Clear ended
                </button>
                <button
                  onClick={() => deleteBulk('expired')}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  title="Delete expired waiting sessions"
                >
                  Clear expired
                </button>
                <button
                  onClick={() => deleteBulk('all')}
                  className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100"
                  title="Delete all sessions"
                >
                  <Trash2 className="w-4 h-4 inline mr-1" />
                  Delete all
                </button>
              </div>
            )}
            <button
              onClick={createSession}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              {creating ? 'Creating...' : 'New Session'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions yet</h3>
            <p className="text-gray-500 mb-4">Create a new session to start helping someone</p>
            <button
              onClick={createSession}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create your first session
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Session Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(session.status)}
                        <span className="text-sm text-gray-900">{getStatusLabel(session.status)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                        {session.session_code}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {session.client_platform || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(session.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm flex items-center gap-3">
                      <button
                        onClick={() => navigate(`/session/${session.id}`)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View
                      </button>
                      <button
                        onClick={() => deleteSession(session.id)}
                        disabled={deleting === session.id}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        title="Delete session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
