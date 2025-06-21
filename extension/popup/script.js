// Global variables
let currentMode = 'starter';
let currentLanguage = 'python';
let currentProblem = null;
let currentCode = '';

// DOM elements
const starterBtn = document.getElementById('starter-btn');
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

    // Get current problem info
    await updateProblemInfo();
    
    // Set up event listeners
    setupEventListeners();
});

// Set up event listeners
function setupEventListeners() {
    // Mode selection
    starterBtn.addEventListener('click', () => setMode('starter'));
    hintBtn.addEventListener('click', () => setMode('hint'));
    
    // Language selection
    languageSelect.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        chrome.storage.local.set({ language: currentLanguage });
    });
    
    // Action buttons
    getAssistanceBtn.addEventListener('click', getAssistance);
    copyBtn.addEventListener('click', copyResponse);
    clearBtn.addEventListener('click', clearResponse);
}

// Set mode
async function setMode(mode) {
    currentMode = mode;
    updateModeButtons();
    
    // Save preference
    await chrome.storage.local.set({ mode: mode });
    
    // Clear previous response
    clearResponse();
}

// Update mode button states
function updateModeButtons() {
    starterBtn.classList.toggle('active', currentMode === 'starter');
    hintBtn.classList.toggle('active', currentMode === 'hint');
}

// Get current problem information from LeetCode page
async function updateProblemInfo() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.url && tab.url.includes('leetcode.com/problems/')) {
            // Extract problem info from URL
            const urlParts = tab.url.split('/');
            const problemSlug = urlParts[urlParts.length - 1];
            
            // Get problem details from content script
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'getProblemInfo'
            });
            
            if (response && response.success) {
                currentProblem = {
                    title: response.title,
                    description: response.description,
                    slug: problemSlug
                };
                
                problemTitle.textContent = currentProblem.title;
                problemDescription.textContent = currentProblem.description || 'Problem description not available';
                getAssistanceBtn.disabled = false;
            } else {
                // Fallback to URL-based detection
                currentProblem = {
                    title: problemSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    description: 'Problem description not available',
                    slug: problemSlug
                };
                
                problemTitle.textContent = currentProblem.title;
                problemDescription.textContent = 'Problem description not available';
                getAssistanceBtn.disabled = false;
            }
        } else {
            currentProblem = null;
            problemTitle.textContent = 'No problem detected';
            problemDescription.textContent = 'Navigate to a LeetCode problem to get started';
            getAssistanceBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error updating problem info:', error);
        currentProblem = null;
        problemTitle.textContent = 'Error detecting problem';
        problemDescription.textContent = 'Please refresh the page and try again';
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
            problem_description: `${currentProblem.title}: ${currentProblem.description}`,
            language: currentLanguage,
            mode: currentMode,
            current_code: currentCode
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

// Display response in the UI
function displayResponse(response) {
    responseContent.innerHTML = '';
    
    if (currentMode === 'starter') {
        // Display code template
        const codeBlock = document.createElement('pre');
        codeBlock.textContent = response;
        responseContent.appendChild(codeBlock);
    } else {
        // Display hint text
        const hintText = document.createElement('p');
        hintText.textContent = response;
        responseContent.appendChild(hintText);
    }
    
    responseSection.style.display = 'block';
}

// Copy response to clipboard
async function copyResponse() {
    const text = responseContent.textContent;
    if (!text) return;
    
    try {
        await navigator.clipboard.writeText(text);
        showSuccess('Copied to clipboard!');
    } catch (error) {
        console.error('Error copying response:', error);
        showError('Failed to copy response');
    }
}

// Clear response
function clearResponse() {
    responseContent.innerHTML = '<p>Click "Get Assistance" to receive AI-powered guidance.</p>';
    responseSection.style.display = 'none';
}

// Set loading state
function setLoading(isLoading) {
    loading.style.display = isLoading ? 'flex' : 'none';
    getAssistanceBtn.disabled = isLoading;
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    error.style.display = 'block';
}

// Hide error message
function hideError() {
    error.style.display = 'none';
}

// Show success message (temporary)
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #48bb78;
        color: white;
        padding: 10px 15px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
} 