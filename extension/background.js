// Simple working background script
console.log('Background script loaded');

// Handle messages from content scripts for OAuth
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.action);
    
    if (message.action === 'signInWithGoogle') {
        handleRealGoogleSignIn().then(sendResponse);
        return true; // Will respond asynchronously
    } else if (message.action === 'signOut') {
        handleRealSignOut().then(sendResponse);
        return true;
    } else if (message.action === 'checkAuthStatus') {
        checkRealAuthStatus().then(sendResponse);
        return true;
    }
});

// Real Google Sign In handler using Chrome Identity API
async function handleRealGoogleSignIn() {
    try {
        console.log('Background: Starting real Google sign-in...');
        
        // Get OAuth token using Chrome Identity API
        const token = await new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true }, (token) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(token);
                }
            });
        });
        
        console.log('Background: Got OAuth token from Chrome Identity API');
        
        // Get user info from Google API
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const userInfo = await response.json();
        console.log('Background: Got real user info for:', userInfo.email);
        
        const user = {
            uid: userInfo.id,
            email: userInfo.email,
            displayName: userInfo.name,
            photoURL: userInfo.picture
        };
        
        // Store user data in Chrome storage
        await chrome.storage.local.set({ 
            currentUser: user,
            authToken: token,
            isRealAuth: true
        });
        
        return { success: true, user, isReal: true };
        
    } catch (error) {
        console.error('Background: Real sign-in error:', error);
        
        if (error.message.includes('OAuth2') || error.message.includes('client id')) {
            return { 
                success: false, 
                error: 'OAuth not configured. Please set up Google Cloud OAuth 2.0 Client ID for Chrome extension. See get-extension-id.html for instructions.' 
            };
        }
        
        return { success: false, error: error.message };
    }
}

// Real sign out handler
async function handleRealSignOut() {
    try {
        console.log('Background: Signing out real user...');
        
        // Get current token and revoke it
        const result = await chrome.storage.local.get(['authToken']);
        if (result.authToken) {
            chrome.identity.removeCachedAuthToken({ token: result.authToken });
        }
        
        // Clear stored user data
        await chrome.storage.local.remove(['currentUser', 'authToken', 'isRealAuth']);
        
        return { success: true };
        
    } catch (error) {
        console.error('Background: Real sign-out error:', error);
        return { success: false, error: error.message };
    }
}

// Check real auth status
async function checkRealAuthStatus() {
    try {
        const result = await chrome.storage.local.get(['currentUser', 'isRealAuth']);
        if (result.currentUser && result.isRealAuth) {
            return { success: true, user: result.currentUser, isReal: true };
        } else {
            return { success: false };
        }
    } catch (error) {
        console.error('Background: Error checking real auth status:', error);
        return { success: false, error: error.message };
    }
}

// Listen for extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
    console.log('Extension clicked on tab:', tab.url);
    
    // Only work on LeetCode problem pages
    if (tab.url?.includes('leetcode.com/problems/')) {
        console.log('LeetCode problem page detected, injecting panel...');
        try {
            // Inject the draggable panel
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: injectDraggablePanel
            });
            console.log('Panel injection completed');
        } catch (err) {
            console.error('Failed to inject draggable panel:', err);
        }
    } else {
        console.log('Not a LeetCode problem page, showing badge');
        // For non-LeetCode pages, show a notification
        chrome.action.setBadgeText({ 
            text: '!', 
            tabId: tab.id 
        });
        chrome.action.setBadgeBackgroundColor({ 
            color: '#FFB84D', 
            tabId: tab.id 
        });
    }
});

// Function to inject the draggable panel
async function injectDraggablePanel() {
    console.log('injectDraggablePanel function called');
    
    // Check if panel already exists
    if (document.getElementById('sensai-draggable-panel')) {
        console.log('Panel already exists, returning');
        return;
    }

    try {
        console.log('Loading HTML template...');
        // Load the HTML template
        const htmlResponse = await fetch(chrome.runtime.getURL('ui/panel.html'));
        const htmlTemplate = await htmlResponse.text();
        console.log('HTML template loaded, length:', htmlTemplate.length);

        console.log('Loading CSS...');
        // Load the CSS
        const cssResponse = await fetch(chrome.runtime.getURL('ui/panel.css'));
        const cssStyles = await cssResponse.text();
        console.log('CSS loaded, length:', cssStyles.length);

        // Authentication setup
        console.log('Setting up authentication...');
        
        window.firebaseFunctions = {
            async signInWithGoogle() {
                try {
                    console.log('Starting Google authentication...');
                    
                    // Send message to background script for OAuth
                    const result = await chrome.runtime.sendMessage({
                        action: 'signInWithGoogle'
                    });
                    
                    if (result.success) {
                        window.currentUser = result.user;
                        window.isRealAuth = true;
                        updateAuthUI(true, result.user, true);
                        console.log('Google sign-in successful:', result.user.email);
                    } else {
                        console.error('Google sign-in failed:', result.error);
                    }
                    
                    return result;
                    
                } catch (error) {
                    console.error('Google sign-in error:', error);
                    return { success: false, error: error.message };
                }
            },
            
            async signOutUser() {
                try {
                    console.log('Signing out user...');
                    const result = await chrome.runtime.sendMessage({
                        action: 'signOut'
                    });
                    if (result.success) {
                        window.currentUser = null;
                        window.isRealAuth = false;
                        updateAuthUI(false);
                    }
                    return result;
                } catch (error) {
                    console.error('Sign-out error:', error);
                    return { success: false, error: error.message };
                }
            }
        };
        
        // Check for existing real authentication
        try {
            const result = await chrome.runtime.sendMessage({
                action: 'checkAuthStatus'
            });
            
            if (result.success && result.user && result.isReal) {
                window.currentUser = result.user;
                window.isRealAuth = true;
                updateAuthUI(true, result.user, true);
                console.log('Restored real user session:', result.user.email);
            }
        } catch (error) {
            console.error('Error checking real auth status:', error);
        }

        // UI update function
        function updateAuthUI(isLoggedIn, user = null, isRealAuth = false) {
            const panel = document.getElementById('sensai-draggable-panel');
            if (!panel) return;

            const authSection = panel.querySelector('.sensai-auth-section');
            if (authSection) {
                if (isLoggedIn && user) {
                    authSection.innerHTML = `
                        <div class="sensai-user-info">
                            <img src="${user.photoURL}" alt="Profile" class="sensai-user-avatar">
                            <span class="sensai-user-name">${user.displayName}</span>
                            <button class="sensai-signout-btn" title="Sign Out">Sign Out</button>
                        </div>
                    `;

                    // Add sign out event listener
                    const signOutBtn = authSection.querySelector('.sensai-signout-btn');
                    signOutBtn.addEventListener('click', async () => {
                        if (window.firebaseFunctions) {
                            await window.firebaseFunctions.signOutUser();
                        }
                    });

                    // Show progress section
                    const progressSection = panel.querySelector('.sensai-progress-section');
                    if (progressSection) {
                        progressSection.style.display = 'block';
                    }
                } else {
                    authSection.innerHTML = `
                        <button class="sensai-signin-btn" title="Sign in with Google">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Sign in with Google
                        </button>
                    `;

                    // Add sign in event listener
                    const signInBtn = authSection.querySelector('.sensai-signin-btn');
                    signInBtn.addEventListener('click', async () => {
                        if (window.firebaseFunctions) {
                            signInBtn.textContent = 'Signing in...';
                            signInBtn.disabled = true;
                            
                            const result = await window.firebaseFunctions.signInWithGoogle();
                            
                            if (!result.success) {
                                signInBtn.textContent = `Error: ${result.error}`;
                                setTimeout(() => {
                                    signInBtn.innerHTML = `
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                        </svg>
                                        Sign in with Google
                                    `;
                                    signInBtn.disabled = false;
                                }, 3000);
                            }
                        }
                    });
                }
            }
        }

        // Create the draggable panel
        console.log('Creating panel element...');
        const panel = document.createElement('div');
        panel.id = 'sensai-draggable-panel';
        panel.innerHTML = htmlTemplate;
        console.log('Panel HTML set');

        // Add styles
        console.log('Adding CSS styles...');
        const style = document.createElement('style');
        style.textContent = cssStyles;

        document.head.appendChild(style);
        document.body.appendChild(panel);
        console.log('Panel added to DOM');

        // Make the panel draggable
        const header = panel.querySelector('.sensai-panel-header');
        let isDragging = false;
        let currentX = 0;
        let currentY = 0;
        let initialX = 0;
        let initialY = 0;

        header.addEventListener('mousedown', (e) => {
                isDragging = true;
            initialX = e.clientX - currentX;
            initialY = e.clientY - currentY;
            panel.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                panel.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            panel.style.cursor = 'default';
        });

        // Minimize functionality
        const minimizeBtn = panel.querySelector('.sensai-minimize-btn');
        const content = panel.querySelector('.sensai-panel-content');
        let isMinimized = false;

        minimizeBtn.addEventListener('click', () => {
            isMinimized = !isMinimized;
            content.style.display = isMinimized ? 'none' : 'block';
            minimizeBtn.textContent = isMinimized ? '▲' : '▼';
            panel.style.height = isMinimized ? 'auto' : '';
        });

        // Close functionality
        const closeBtn = panel.querySelector('.sensai-close-btn');
        closeBtn.addEventListener('click', () => {
            panel.remove();
        });

        // Initialize with sign-in UI
        updateAuthUI(false);

        // === Button Functionality ===
        // Code/Hint button functionality
        const codeBtn = panel.querySelector('.sensai-code-btn');
        const hintBtn = panel.querySelector('.sensai-hint-btn');

        async function getAIResponse(action) {
            try {
                const problemInfo = extractProblemInfo();
                console.log('Problem info:', problemInfo);

                const response = await fetch('http://localhost:8000/assist', {
                        method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                        body: JSON.stringify({
                        action,
                        problem_title: problemInfo.title,
                        problem_description: problemInfo.description,
                        user_code: problemInfo.userCode,
                        user_id: window.currentUser?.uid || 'anonymous'
                        })
                    });

                const data = await response.json();
                return data.response;
            } catch (error) {
                console.error('Error getting AI response:', error);
                return 'Sorry, I encountered an error while processing your request.';
            }
        }

        function extractProblemInfo() {
            const title = document.querySelector('[data-cy="question-title"]')?.textContent?.trim() || 
                         document.querySelector('.css-v3d350')?.textContent?.trim() || 
                         'Unknown Problem';
            
            const description = document.querySelector('[data-track-load="description_content"]')?.textContent?.trim() || 
                               document.querySelector('.content__u3I1 .question-content')?.textContent?.trim() || 
                               'No description found';
            
            const codeEditor = document.querySelector('.monaco-editor textarea') || 
                              document.querySelector('.CodeMirror-code') || 
                              document.querySelector('#editor');
            
            let userCode = '';
            if (codeEditor) {
                userCode = codeEditor.value || codeEditor.textContent || '';
            }

            return { title, description, userCode };
        }

        // Button event listeners
        codeBtn.addEventListener('click', async () => {
            codeBtn.textContent = 'Getting code...';
            codeBtn.disabled = true;

            try {
                const response = await getAIResponse('code');
                showResponse(response, 'Code Solution');
            } finally {
                codeBtn.textContent = 'Get Code';
                codeBtn.disabled = false;
            }
        });

        hintBtn.addEventListener('click', async () => {
            hintBtn.textContent = 'Getting hint...';
            hintBtn.disabled = true;

            try {
                const response = await getAIResponse('hint');
                showResponse(response, 'Hint');
            } finally {
                hintBtn.textContent = 'Get Hint';
                hintBtn.disabled = false;
            }
        });

        function showResponse(response, title) {
            const responseContainer = panel.querySelector('.sensai-response');
            responseContainer.innerHTML = `
                <div class="sensai-response-header">
                    <strong>${title}</strong>
                    <button class="sensai-copy-btn" title="Copy to clipboard">📋</button>
                </div>
                <div class="sensai-response-content">${response}</div>
            `;
            responseContainer.style.display = 'block';

            // Copy functionality
            const copyBtn = responseContainer.querySelector('.sensai-copy-btn');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(response).then(() => {
                    copyBtn.textContent = '✓';
                    setTimeout(() => {
                        copyBtn.textContent = '📋';
                    }, 2000);
                });
            });
        }

        console.log('Panel setup completed successfully');

    } catch (error) {
        console.error('Failed to inject draggable panel:', error);
        
        // Fallback: Create a simple panel
        const fallbackPanel = document.createElement('div');
        fallbackPanel.id = 'sensai-draggable-panel';
        fallbackPanel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            background: white;
            border: 2px solid #FFB84D;
            border-radius: 10px;
            z-index: 10000;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        fallbackPanel.innerHTML = `
            <h3>SensAI Assistant</h3>
            <p>Extension loaded successfully!</p>
            <button style="background: #FFB84D; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer;">Demo Sign In</button>
        `;
        document.body.appendChild(fallbackPanel);
        
        console.log('Fallback panel created');
    }
}

console.log('Background script setup complete');