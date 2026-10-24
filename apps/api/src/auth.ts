// apps/api/src/auth.ts
// Admin authentication: passcode login, signed cookie session, constant-time compare.
// architecture.md section 16, techstack.md section 4.

import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const COOKIE_NAME = 'qn_session';

interface SessionPayload {
  exp: number;
}

function getAdminPasscode(): string {
  return process.env['ADMIN_PASSCODE'] || 'demo';
}

function getSessionSecret(): string {
  return process.env['SESSION_SECRET'] || 'queuenova-dev-secret-change-me';
}

function getCookieDomain(): string | undefined {
  return process.env['COOKIE_DOMAIN'] || undefined;
}

// Constant-time passcode comparison
export function verifyPasscode(input: string): boolean {
  const expected = getAdminPasscode();
  const inputBuf = Buffer.from(input.padEnd(256, '\0'));
  const expectedBuf = Buffer.from(expected.padEnd(256, '\0'));
  return crypto.timingSafeEqual(inputBuf, expectedBuf) && input === expected;
}

// Sign a session payload with HMAC-SHA256
function signPayload(payload: SessionPayload): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString('base64url');
  const hmac = crypto.createHmac('sha256', getSessionSecret());
  hmac.update(encoded);
  const sig = hmac.digest('base64url');
  return `${encoded}.${sig}`;
}

// Verify and parse a signed session token
function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const hmac = crypto.createHmac('sha256', getSessionSecret());
  hmac.update(encoded);
  const expectedSig = hmac.digest('base64url');

  if (sig.length !== expectedSig.length) return null;
  const sigBuf = Buffer.from(sig, 'base64url');
  const expectedBuf = Buffer.from(expectedSig, 'base64url');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const data = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    return data as SessionPayload;
  } catch {
    return null;
  }
}

export function createSessionCookie(reply: FastifyReply): void {
  const payload: SessionPayload = {
    exp: Date.now() + SESSION_DURATION_MS,
  };
  const token = signPayload(payload);
  const isProduction = process.env['NODE_ENV'] === 'production';

  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    domain: getCookieDomain(),
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  const isProduction = process.env['NODE_ENV'] === 'production';
  reply.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    domain: getCookieDomain(),
    path: '/',
  });
}

export function isAuthenticated(request: FastifyRequest): boolean {
  const token = request.cookies[COOKIE_NAME];
  if (!token) return false;

  const payload = verifyToken(token);
  if (!payload) return false;

  return payload.exp > Date.now();
}

// Fastify preHandler hook for admin routes
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!isAuthenticated(request)) {
    reply.status(401).send({ error: { code: 'FORBIDDEN', message: 'Authentication required.' } });
    return;
  }

  // Mutating requests require X-Requested-With header
  const method = request.method.toUpperCase();
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    const xrw = request.headers['x-requested-with'];
    if (xrw !== 'queuenova') {
      reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Missing X-Requested-With header.' } });
      return;
    }
  }
}
