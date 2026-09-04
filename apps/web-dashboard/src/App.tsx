import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Session } from './pages/Session';

interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;
  try {
    const res = await fetch('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await safeJson(res);
    if (!res.ok || !data.access_token) return null;
    localStorage.setItem('token', data.access_token);
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
    return data.access_token as string;
  } catch {
    return null;
  }
}

// Clipboard on plain http://IP is blocked (needs secure context) - fallback to textarea+execCommand
export async function copyTextWithFallback(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { (ta as any).setSelectionRange?.(0, ta.value.length); } catch {}
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function authFetch(input: RequestInfo, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = localStorage.getItem('token');
  const res = await fetch(input, {
    ...init,
    headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (res.status === 401 && retry) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      return fetch(input, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${fresh}` },
      });
    }
  }
  return res;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const loadMe = async (t: string, retry = true): Promise<void> => {
      try {
        const res = await fetch('/v1/auth/me', {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (res.status === 401 && retry) {
          const fresh = await refreshAccessToken();
          if (fresh && !cancelled) {
            setToken(fresh);
            await loadMe(fresh, false);
            return;
          }
          throw new Error('unauthorized');
        }
        const data = await safeJson(res);
        if (cancelled) return;
        if (data.user) {
          setUser(data.user);
        } else {
          localStorage.removeItem('token');
          setToken(null);
        }
      } catch {
        if (cancelled) return;
        // Don't logout on transient network/502 - keep token, user can retry
        // Only clear if refresh also failed with no network-independent signal.
        // Try one silent refresh before giving up.
        try {
          const fresh = await refreshAccessToken();
          if (fresh && !cancelled) {
            setToken(fresh);
            return;
          }
        } catch {}
      }
    };
    loadMe(token);
    // Auto-refresh every 40min so 45min access token never expires mid-session
    const iv = setInterval(async () => {
      const fresh = await refreshAccessToken();
      if (fresh) setToken(fresh);
    }, 40 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    let res: Response;
    try {
      res = await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error('Connection error - server not reachable. Wait 30s and retry.');
    }

    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error || (res.status === 502 ? 'Server starting - wait 30s and retry' : 'Login failed'));
    }

    localStorage.setItem('token', data.access_token);
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
    // Schedule pre-emptive refresh 1min before expiry (expires_in secs, default 2700)
    setToken(data.access_token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/session/:id"
            element={
              <ProtectedRoute>
                <Session />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
