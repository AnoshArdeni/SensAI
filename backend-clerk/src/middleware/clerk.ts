import { Request, Response, NextFunction } from 'express';
import { requireAuth as clerkRequireAuth, getAuth, verifyToken, clerkMiddleware } from '@clerk/express';

// Extend Express Request type to include auth
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
        user?: any;
      };
    }
  }
}

/**
 * Middleware to require authentication for protected routes
 * Returns 401 if user is not authenticated
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  
  if (!auth?.userId) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Valid authentication required' 
    });
  }
  
  req.auth = {
    userId: auth.userId,
    sessionId: auth.sessionId || '',
    user: auth
  };
  
  next();
};

/**
 * Middleware to optionally check authentication
 * Continues even if user is not authenticated
 */
export const withAuth = (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  
  if (auth?.userId) {
    req.auth = {
      userId: auth.userId,
      sessionId: auth.sessionId || '',
      user: auth
    };
  }
  
  next();
};

/**
 * Custom middleware to handle Chrome extension authentication
 * Supports both cookie-based and token-based auth
 */
export const extensionAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // First try normal Clerk auth (cookies/headers)
    const auth = getAuth(req);
    
    if (auth?.userId) {
      req.auth = {
        userId: auth.userId,
        sessionId: auth.sessionId || '',
        user: auth
      };
      return next();
    }
    
    // If normal auth fails, try token-based auth for extensions
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (token) {
      try {
        // Verify the token with Clerk
        const payload = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY
        });
        
        if (payload.sub) {
          req.auth = {
            userId: payload.sub,
            sessionId: payload.sid || '',
            user: payload
          };
          return next();
        }
      } catch (tokenError) {
        console.error('Token verification failed:', tokenError);
      }
    }
    
    // Both auth methods failed
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Valid authentication required for extension' 
    });
  } catch (error) {
    console.error('Extension auth middleware error:', error);
    res.status(500).json({ error: 'Authentication service error' });
  }
};