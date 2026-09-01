import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types/auth';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
const REFRESH_TOKEN_EXPIRY = '30d';

export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as JWTPayload;
}

export function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as JWTPayload;
}

export function decodeTokenWithoutVerify(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}
