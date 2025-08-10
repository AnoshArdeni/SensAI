import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAuth } from '../middleware/clerk.js';
import { z } from 'zod';

const router = express.Router();

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Request validation schema
const AssistRequestSchema = z.object({
  action: z.enum(['hint', 'code']),
  problem_title: z.string().min(1),
  problem_description: z.string().min(1),
  user_code: z.string().optional().default(''),
  language: z.string().optional().default('javascript')
});

/**
 * POST /api/ai/assist
 * Get AI assistance for coding problems
 * Requires authentication
 */
router.post('/assist', requireAuth, async (req, res) => {
  try {
    // Validate request body
    const validationResult = AssistRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.issues
      });
    }

    const { action, problem_title, problem_description, user_code, language } = validationResult.data;
    const userId = req.auth?.userId;

    console.log(`AI assist request from user ${userId}: ${action} for "${problem_title}"`);

    let prompt = '';
    
    if (action === 'hint') {
      prompt = `
You are an AI coding tutor helping students learn problem-solving skills. 

Problem: ${problem_title}
Description: ${problem_description}
Student's current code: ${user_code || 'No code written yet'}
Language: ${language}

Provide a helpful hint that guides the student toward the solution WITHOUT giving away the complete answer. Focus on:
1. Suggesting the right approach or algorithm
2. Pointing out what to consider next
3. Encouraging progressive thinking

Keep your hint concise (2-3 sentences) and educational.
`;
    } else {
      prompt = `
You are an AI coding assistant helping with LeetCode-style problems.

Problem: ${problem_title}
Description: ${problem_description}
Current code: ${user_code || 'No code written yet'}
Language: ${language}

Provide a working code solution with:
1. Clear, readable code
2. Brief explanation of the approach
3. Time and space complexity analysis

Format your response with proper code blocks and explanations.
`;
    }

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Log usage for analytics (you could store this in a database)
    console.log(`AI response generated for user ${userId}, action: ${action}, length: ${response.length}`);

    res.json({
      success: true,
      response,
      metadata: {
        action,
        problem_title,
        user_id: userId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('AI assist error:', error);
    res.status(500).json({
      error: 'Failed to generate AI response',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ai/usage
 * Get user's AI usage statistics
 */
router.get('/usage', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    
    // In a real app, you'd fetch this from a database
    // For now, return mock data
    res.json({
      success: true,
      usage: {
        user_id: userId,
        total_requests: 42,
        hints_requested: 25,
        code_generated: 17,
        last_request: new Date().toISOString(),
        monthly_limit: 1000,
        remaining: 958
      }
    });
  } catch (error) {
    console.error('Usage stats error:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

export default router;