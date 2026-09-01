export type SessionStatus = 'created' | 'pending_approval' | 'active' | 'paused' | 'ended';
export type ConsentState = 'none' | 'pending' | 'approved' | 'denied' | 'revoked';
export type TokenType = 'client_join' | 'technician_reconnect';
export type UserRole = 'technician' | 'admin';
export type Platform = 'windows' | 'macos' | 'linux';
export type PermissionKey = 'view' | 'control' | 'clipboard' | 'file_transfer' | 'audio';
export type ConsentEventType =
  | 'consent_requested'
  | 'consent_approved'
  | 'consent_denied'
  | 'consent_revoked'
  | 'permission_granted'
  | 'permission_revoked';
export type EndedReason = 'client_revoked' | 'technician_ended' | 'timeout' | 'idle_timeout' | 'error';

export interface SessionPermissions {
  view: boolean;
  control: boolean;
  clipboard: boolean;
  file_transfer: boolean;
  audio: boolean;
}

export interface Session {
  id: string;
  technician_id: string;
  status: SessionStatus;
  session_code: string;
  client_token_hash: string | null;
  client_token_used: boolean;
  consent_state: ConsentState;
  permissions: SessionPermissions;
  client_platform: Platform | null;
  client_ip: string | null;
  client_approx_location: string | null;
  max_duration_minutes: number;
  idle_timeout_minutes: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  ended_reason: EndedReason | null;
  recording_enabled: boolean;
  recording_consent: boolean;
  metadata: Record<string, unknown>;
}

export interface SessionToken {
  id: string;
  session_id: string;
  token_hash: string;
  token_type: TokenType;
  used: boolean;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface ConsentEvent {
  id: string;
  session_id: string;
  event_type: ConsentEventType;
  granted_by: 'client' | 'technician' | 'system';
  permissions: Partial<SessionPermissions> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CreateSessionRequest {
  max_duration_minutes?: number;
  idle_timeout_minutes?: number;
  recording_enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface JoinSessionRequest {
  token: string;
  platform: Platform;
  device_name?: string;
}

export interface ApproveSessionRequest {
  permissions: Partial<SessionPermissions>;
}

export interface SessionResponse {
  session: Session;
  join_url?: string;
  join_token?: string;
}

export interface WebRTCOffer {
  type: 'offer';
  sdp: string;
}

export interface WebRTCAnswer {
  type: 'answer';
  sdp: string;
}

export interface ICECandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'consent-update' | 'permission-update' | 'session-end' | 'ping' | 'pong';
  session_id: string;
  payload: unknown;
}

export interface InputEvent {
  type: 'mousemove' | 'mousedown' | 'mouseup' | 'wheel' | 'keydown' | 'keyup' | 'paste';
  x?: number;
  y?: number;
  button?: number;
  deltaY?: number;
  code?: string;
  text?: string;
  sequence: number;
}

export interface AuditLog {
  id: number;
  session_id: string | null;
  user_id: string | null;
  action: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}
