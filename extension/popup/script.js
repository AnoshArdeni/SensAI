// Global variables
let currentMode = 'next_code';
let currentLanguage = 'python';
let currentProblem = null;
let currentCode = '';

// DOM elements
const nextCodeBtn = document.getElementById('starter-btn');
const hintBtn = document.getElementById('hint-btn');
const languageSelect = document.getElementById('language-select');
const getAssistanceBtn = document.getElementById('get-assistance-btn');
const responseSection = document.getElementById('response-section');
const responseContent = document.getElementById('response-content');
const copyBtn = document.getElementById('copy-btn');
const clearBtn = document.getElementById('clear-btn');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const problemTitle = document.getElementById('problem-title');
const problemDescription = document.getElementById('problem-description');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    // Load saved preferences
    const savedMode = await chrome.storage.local.get(['mode']);
    if (savedMode.mode) {
        currentMode = savedMode.mode;
        updateModeButtons();
    }

    const savedLanguage = await chrome.storage.local.get(['language']);
    if (savedLanguage.language) {
        currentLanguage = savedLanguage.language;
        languageSelect.value = currentLanguage;
    }

    // Get current problem info and code
    await updateProblemInfo();
    
    // Set up event listeners
    setupEventListeners();
});

// Update UI elements
function updateModeButtons() {
    nextCodeBtn.classList.toggle('active', currentMode === 'next_code');
    hintBtn.classList.toggle('active', currentMode === 'hint');
    nextCodeBtn.textContent = '🚀 Next Step';
    hintBtn.textContent = '💡 Get Hint';
}

// Set up event listeners
function setupEventListeners() {
    nextCodeBtn.addEventListener('click', () => {
        currentMode = 'next_code';
        chrome.storage.local.set({ mode: currentMode });
        updateModeButtons();
    });

    hintBtn.addEventListener('click', () => {
        currentMode = 'hint';
        chrome.storage.local.set({ mode: currentMode });
        updateModeButtons();
    });

    languageSelect.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        chrome.storage.local.set({ language: currentLanguage });
    });

    getAssistanceBtn.addEventListener('click', getAssistance);
    copyBtn.addEventListener('click', copyResponse);
    clearBtn.addEventListener('click', clearResponse);
}

// Get current problem info and code from LeetCode
async function updateProblemInfo() {
    try {
        // Query the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes('leetcode.com/problems/')) {
            problemTitle.textContent = 'Not a LeetCode problem page';
            problemDescription.textContent = 'Please navigate to a LeetCode problem';
            getAssistanceBtn.disabled = true;
            return;
        }

        // Ensure content script is injected
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content/content.js']
            });
        } catch (err) {
            console.log('Content script already injected or injection failed:', err);
        }

        // Wait a bit for the page to be fully loaded
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Inject content script to get problem info and code
        const result = await chrome.tabs.sendMessage(tab.id, { action: 'getProblemInfo' })
            .catch(err => {
                throw new Error('Could not connect to LeetCode page. Please refresh the page and try again.');
            });
        
        if (result?.success) {
            currentProblem = result.data;
            problemTitle.textContent = currentProblem.title;
            problemDescription.textContent = currentProblem.description;
            currentCode = result.data.code || '';
            getAssistanceBtn.disabled = false;
        } else {
            throw new Error(result?.error || 'Failed to get problem info');
        }
    } catch (error) {
        console.error('Error getting problem info:', error);
        problemTitle.textContent = 'Error';
        problemDescription.textContent = error.message;
        getAssistanceBtn.disabled = true;
    }
}

// Get assistance from backend
async function getAssistance() {
    if (!currentProblem) {
        showError('No problem detected. Please navigate to a LeetCode problem.');
        return;
    }

    setLoading(true);
    hideError();
    clearResponse();

    try {
        const requestData = {
            problem_name: currentProblem.title,
            code_so_far: currentCode,
            language: currentLanguage,
            mode: currentMode
        };

        const response = await fetch('http://localhost:8000/api/assist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            displayResponse(data.response);
        } else {
            throw new Error('Failed to generate assistance');
        }
    } catch (error) {
        console.error('Error getting assistance:', error);
        showError(`Failed to get assistance: ${error.message}`);
    } finally {
        setLoading(false);
    }
}

// UI helper functions
function setLoading(isLoading) {
    loading.style.display = isLoading ? 'flex' : 'none';
    getAssistanceBtn.disabled = isLoading;
}

function showError(message) {
    error.style.display = 'block';
    errorMessage.textContent = message;
}

function hideError() {
    error.style.display = 'none';
}

function displayResponse(text) {
    responseSection.style.display = 'block';
    responseContent.textContent = text;
}

function clearResponse() {
    responseContent.textContent = '';
    responseSection.style.display = 'none';
}

async function copyResponse() {
    try {
        await navigator.clipboard.writeText(responseContent.textContent);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
} 