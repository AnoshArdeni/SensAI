import { useState, useEffect } from 'react';
import type { ProblemInfo, ContentScriptResponse } from '../types/chrome';

export function useLeetCodeProblem() {
  const [problem, setProblem] = useState<ProblemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateProblemInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      // Query the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url?.includes('leetcode.com/problems/')) {
        throw new Error('Not a LeetCode problem page');
      }

      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          files: ['content/content.js']
        });
      } catch (err) {
        console.log('Content script already injected or injection failed:', err);
      }

      // Wait a bit for the page to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get problem info from content script
      const result: ContentScriptResponse = await chrome.tabs.sendMessage(tab.id!, { 
        action: 'getProblemInfo' 
      });
      
      if (result?.success && result.data) {
        setProblem(result.data);
      } else {
        throw new Error(result?.error || 'Failed to get problem info');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      setProblem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    updateProblemInfo();
  }, []);

  return { problem, loading, error, refetch: updateProblemInfo };
} 