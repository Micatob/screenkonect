export interface User {
  id: string;
  email: string;
  display_name: string;
  role: 'technician' | 'admin';
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface Device {
  id: string;
  user_id: string | null;
  device_name: string;
  platform: string;
  platform_version: string;
  agent_version: string;
  public_key: string | null;
  enrolled_at: string;
  last_seen_at: string | null;
  is_active: boolean;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  device_id: string | null;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  user: User;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: 'technician' | 'admin';
  iat: number;
  exp: number;
  jti: string;
}
