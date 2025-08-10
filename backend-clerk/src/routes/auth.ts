import express from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { requireAuth, extensionAuth } from '../middleware/clerk.js';

const router = express.Router();

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: 'No user ID found' });
    }

    const user = await clerkClient.users.getUser(req.auth.userId);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user information' });
  }
});

/**
 * POST /api/auth/extension
 * Validate extension authentication and return user info
 * Supports both cookie-based and token-based auth
 */
router.post('/extension', extensionAuth, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const user = await clerkClient.users.getUser(req.auth.userId);
    
    res.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl
      },
      session: {
        userId: req.auth.userId,
        sessionId: req.auth.sessionId
      }
    });
  } catch (error) {
    console.error('Extension auth error:', error);
    res.status(500).json({ 
      error: 'Authentication service error',
      authenticated: false 
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (revoke session)
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    if (req.auth?.sessionId) {
      await clerkClient.sessions.revokeSession(req.auth.sessionId);
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

/**
 * GET /api/auth/session
 * Check if current session is valid
 */
router.get('/session', requireAuth, async (req, res) => {
  try {
    if (!req.auth?.sessionId) {
      return res.status(401).json({ valid: false });
    }

    const session = await clerkClient.sessions.getSession(req.auth.sessionId);
    
    res.json({
      valid: true,
      session: {
        id: session.id,
        userId: session.userId,
        status: session.status,
        lastActiveAt: session.lastActiveAt,
        expireAt: session.expireAt
      }
    });
  } catch (error) {
    console.error('Session check error:', error);
    res.status(401).json({ valid: false, error: 'Invalid session' });
  }
});

export default router;