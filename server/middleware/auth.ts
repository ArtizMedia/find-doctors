import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.ts';
import { UserRole } from '../db/schema.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'curalink-super-secret-jwt-key-2026-prod';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  profileId?: string; // patientProfile id or doctorProfile id
  fullName?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      profileId: user.profileId,
      fullName: user.fullName,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'No Bearer token provided in Authorization header',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    
    // Verify user still exists in database
    const userInDb = db.users.find((u) => u.id === decoded.id);
    if (!userInDb) {
      res.status(401).json({
        error: 'Invalid session',
        message: 'User account not found or has been disabled',
      });
      return;
    }

    // Attach profileId if not already in decoded token
    let profileId = decoded.profileId;
    let fullName = decoded.fullName;

    if (!profileId) {
      if (userInDb.role === 'PATIENT') {
        const pat = db.patientProfiles.find((p) => p.userId === userInDb.id);
        profileId = pat?.id;
        fullName = pat?.fullName;
      } else if (userInDb.role === 'DOCTOR') {
        const doc = db.doctorProfiles.find((d) => d.userId === userInDb.id);
        profileId = doc?.id;
        fullName = doc?.fullName;
      }
    }

    req.user = {
      id: userInDb.id,
      email: userInDb.email,
      role: userInDb.role,
      profileId,
      fullName,
    };

    next();
  } catch (err) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token has expired or is invalid',
    });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to perform this action',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `Action restricted to roles: [${allowedRoles.join(', ')}]. Your role is ${req.user.role}`,
      });
      return;
    }

    next();
  };
}

export function optionalAuthenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    const userInDb = db.users.find((u) => u.id === decoded.id);
    if (userInDb) {
      req.user = {
        id: userInDb.id,
        email: userInDb.email,
        role: userInDb.role,
        profileId: decoded.profileId,
        fullName: decoded.fullName,
      };
    }
  } catch {
    // Ignore invalid token for optional auth
  }
  next();
}
