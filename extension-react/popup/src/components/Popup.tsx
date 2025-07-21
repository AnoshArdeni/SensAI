import React, { useState } from 'react';
import { useChromeStorage } from '../hooks/useChromeStorage';
import { useLeetCodeProblem } from '../hooks/useLeetCodeProblem';
import type { ExtensionMode, ProgrammingLanguage, AssistanceRequest, AssistanceResponse } from '../types/chrome';
import './Popup.css';

const PROGRAMMING_LANGUAGES: { value: ProgrammingLanguage; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
];

export const Popup: React.FC = () => {
  const [mode, setMode] = useChromeStorage<ExtensionMode>('mode', 'next_code');
  const [language, setLanguage] = useChromeStorage<ProgrammingLanguage>('language', 'python');
  const { problem, loading: problemLoading, error: problemError, refetch } = useLeetCodeProblem();
  
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showResponse, setShowResponse] = useState(false);

  const handleModeChange = (newMode: ExtensionMode) => {
    setMode(newMode);
  };

  const getAssistance = async () => {
    if (!problem) {
      setError('No problem detected. Please navigate to a LeetCode problem.');
      return;
    }

    setLoading(true);
    setError('');
    setResponse('');
    setShowResponse(false);

    try {
      const requestData: AssistanceRequest = {
        problem_name: problem.title,
        code_so_far: problem.code || '',
        language,
        mode
      };

      const response = await fetch('http://localhost:8000/api/assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const data: AssistanceResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      }
      
      if (data.success && data.response) {
        setResponse(data.response);
        setShowResponse(true);
      } else {
        throw new Error('Failed to generate assistance');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to get assistance: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(response);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };



  return (
    <div className="sensai-popup">
      <div className="top-bar">
        <button className="icon-btn gear-btn" title="Settings">
          <svg width="28" height="28" viewBox="0 0 64 64" fill="none" stroke="#FFB84D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="32" cy="32" r="10" fill="none"/>
            <g>
              <path d="M32 6v8"/>
              <path d="M32 50v8"/>
              <path d="M6 32h8"/>
              <path d="M50 32h8"/>
              <path d="M14.93 14.93l5.66 5.66"/>
              <path d="M43.41 43.41l5.66 5.66"/>
              <path d="M14.93 49.07l5.66-5.66"/>
              <path d="M43.41 20.59l5.66-5.66"/>
            </g>
            <circle cx="32" cy="32" r="28" fill="none"/>
          </svg>
        </button>
        <span className="sensai-title">SensAI</span>
        <button className="icon-btn monitor-btn" title="Monitor">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFB84D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
          </svg>
        </button>
      </div>
      
      <div className="top-separator"></div>
      
      <div className="main-panel">
        <div className="panel-header">
          <span className="panel-actions">
            <button className="panel-btn" onClick={copyResponse} disabled={!showResponse}>
              <span className="icon copy" title="Copy">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </span>
              <span className="panel-action-label">Copy</span>
            </button>
            <button className="panel-btn" onClick={refetch}>
              <span className="icon import" title="Refresh">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V6M5 12l7-7 7 7"/>
                  <rect x="3" y="17" width="18" height="4" rx="2"/>
                </svg>
              </span>
              <span className="panel-action-label">Refresh</span>
            </button>
          </span>
          <span className="current-problem">
            {problemLoading ? 'Loading...' : problem?.title || 'No Problem'}
          </span>
        </div>
        
        <div className="panel-content">
          {problemError && (
            <div className="error-message">
              {problemError}
            </div>
          )}
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          {loading && (
            <div className="loading">
              Getting assistance...
            </div>
          )}
          
          {showResponse && response && (
            <div className="response-content">
              <pre>{response}</pre>
            </div>
          )}
          
          {!showResponse && !loading && !error && !problemError && (
            <div className="display-text">
              {problem ? (
                <div>
                  <h3>{problem.title}</h3>
                  <p>{problem.description.slice(0, 200)}...</p>
                  <div className="language-selector">
                    <label htmlFor="language-select">Language: </label>
                    <select 
                      id="language-select"
                      value={language} 
                      onChange={(e) => setLanguage(e.target.value as ProgrammingLanguage)}
                    >
                      {PROGRAMMING_LANGUAGES.map(lang => (
                        <option key={lang.value} value={lang.value}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                'Navigate to a LeetCode problem to get started'
              )}
            </div>
          )}
        </div>
        
        <div className="panel-footer">
          <div className="footer-left">
            <button 
              className={`code-btn ${mode === 'next_code' ? 'selected' : ''}`}
              onClick={() => handleModeChange('next_code')}
            >
              Code
            </button>
            <button 
              className={`hint-btn ${mode === 'hint' ? 'selected' : ''}`}
              onClick={() => handleModeChange('hint')}
            >
              Hint
            </button>
          </div>
          <div className="footer-right">
            <button 
              className="send-btn" 
              title="Send"
              onClick={getAssistance}
              disabled={loading || !problem}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFB84D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 