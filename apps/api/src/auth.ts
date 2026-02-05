// Minimal authentication middleware
// Usage: import and wrap protected routes in server.ts

import { IncomingMessage, ServerResponse } from 'http';
import { decodeToken, extractToken, TokenPayload } from './services/auth';

// Extend IncomingMessage to include user info
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      orgId?: string;
    }
  }
}

/**
 * Middleware: extract and verify token, attach to request
 */
export function authMiddleware(
  req: IncomingMessage & { user?: TokenPayload; orgId?: string },
  res: ServerResponse,
  next: () => void
) {
  const token = extractToken(req.headers['authorization']);
  if (!token) {
    // Allow unauthenticated for now (dev mode)
    return next();
  }

  const payload = decodeToken(token);
  if (payload) {
    req.user = payload;
    req.orgId = payload.orgId;
  }
  next();
}

/**
 * Middleware: require authentication
 */
export function requireAuth(
  req: IncomingMessage & { user?: TokenPayload; orgId?: string },
  res: ServerResponse,
  next: () => void
) {
  if (!req.user) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }
  next();
}

/**
 * Middleware: require specific role
 */
export function requireRole(role: string) {
  return (
    req: IncomingMessage & { user?: TokenPayload; orgId?: string },
    res: ServerResponse,
    next: () => void
  ) => {
    if (!req.user || req.user.role !== role) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }
    next();
  };
}

