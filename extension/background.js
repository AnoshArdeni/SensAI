// Simple working background script
console.log('Background script loaded');

// Handle messages from content scripts for centralized auth
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.action);
    
    if (message.action === 'signIn') {
        handleSignIn().then(sendResponse);
        return true; // Will respond asynchronously
    } else if (message.action === 'signOut') {
        handleSignOut().then(sendResponse);
        return true;
    } else if (message.action === 'checkAuthStatus') {
        checkAuthStatus().then(sendResponse);
        return true;
    } else if (message.action === 'getAIAssistance') {
        handleAIAssistance(message.data).then(sendResponse);
        return true;
    }
});

// Check if user is already authenticated by trying to access website auth info
async function checkWebsiteAuthentication() {
    try {
        console.log('Background: Checking for existing authentication...');
        
        // Method 1: Check if we can get auth info from the website directly
        const websiteTab = await chrome.tabs.query({
            url: 'http://localhost:9002/*'
        });
        
        console.log('Background: Website tabs found:', websiteTab.length, websiteTab.map(t => t.url));
        
        if (websiteTab.length > 0) {
            console.log('Background: Found website tab, checking auth...');
            
            // Execute script in website tab to get auth status
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: websiteTab[0].id },
                    func: () => {
                        // Check if Clerk is available and user is signed in
                        console.log('Content script: Checking window.Clerk:', window.Clerk);
                        console.log('Content script: Checking window.Clerk.user:', window.Clerk?.user);
                        
                        if (window.Clerk && window.Clerk.user) {
                            const user = {
                                id: window.Clerk.user.id,
                                email: window.Clerk.user.primaryEmailAddress?.emailAddress,
                                firstName: window.Clerk.user.firstName,
                                lastName: window.Clerk.user.lastName,
                                fullName: window.Clerk.user.fullName
                            };
                            console.log('Content script: Found Clerk user:', user);
                            return {
                                success: true,
                                user: user
                            };
                        }
                        
                        console.log('Content script: No Clerk user found');
                        return { success: false };
                    }
                });
                
                console.log('Background: Script execution results:', results);
                if (results && results[0] && results[0].result && results[0].result.success) {
                    console.log('Background: Found authenticated user via website tab:', results[0].result.user);
                    return {
                        success: true,
                        user: {
                            ...results[0].result.user,
                            displayName: results[0].result.user.firstName || results[0].result.user.fullName || results[0].result.user.email?.split('@')[0] || 'User'
                        },
                        token: 'website-auth-token',
                        session: 'website-session'
                    };
                } else {
                    console.log('Background: No authenticated user found via website tab');
                }
            } catch (error) {
                console.log('Background: Could not execute script in website tab:', error);
            }
        }
        
        // Method 2: Check localStorage from website tab  
        if (websiteTab.length > 0) {
            try {
                const storageResults = await chrome.scripting.executeScript({
                    target: { tabId: websiteTab[0].id },
                    func: () => {
                        // Check for stored auth data
                        console.log('Content script: Checking localStorage...');
                        const clerkUser = localStorage.getItem('clerk-user');
                        const sensaiAuth = localStorage.getItem('sensai-auth');
                        const sessionClerk = sessionStorage.getItem('clerk-user');
                        
                        console.log('Content script: localStorage clerk-user:', clerkUser);
                        console.log('Content script: localStorage sensai-auth:', sensaiAuth);
                        console.log('Content script: sessionStorage clerk-user:', sessionClerk);
                        
                        const authData = clerkUser || sensaiAuth || sessionClerk;
                        if (authData) {
                            try {
                                const parsed = JSON.parse(authData);
                                console.log('Content script: Parsed auth data:', parsed);
                                return { success: true, user: parsed };
                            } catch (e) {
                                console.log('Content script: Error parsing auth data:', e);
                                return { success: false };
                            }
                        }
                        console.log('Content script: No auth data in storage');
                        return { success: false };
                    }
                });
                
                if (storageResults && storageResults[0] && storageResults[0].result && storageResults[0].result.success) {
                    console.log('Background: Found auth data in website storage');
                                    return {
                    success: true,
                    user: {
                        ...storageResults[0].result.user,
                        displayName: storageResults[0].result.user.firstName || storageResults[0].result.user.name || storageResults[0].result.user.email?.split('@')[0] || 'User'
                    },
                    token: 'storage-auth-token',
                    session: 'storage-session'
                };
                }
            } catch (error) {
                console.log('Background: Could not access website storage:', error);
            }
        }

        // Method 3: Try to make a request to our backend with website credentials
        try {
            const response = await fetch('http://localhost:8000/api/auth/session', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Background: Backend confirmed existing session, data:', data);
                
                // Only return success if we have real user data
                if (data.user && data.user.id && data.user.id !== 'fake-id') {
                    const user = data.user;
                    return {
                        success: true,
                        user: {
                            ...user,
                            displayName: user.firstName || user.name || user.email?.split('@')[0] || 'User'
                        },
                        token: 'backend-session-token',
                        session: 'backend-session'
                    };
                } else {
                    console.log('Background: Backend returned fake/empty user data');
                }
            }
        } catch (error) {
            console.log('Background: Backend auth check failed:', error);
        }
        
        return { success: false };
    } catch (error) {
        console.error('Background: Error checking website auth:', error);
        return { success: false };
    }
}

// Handle sign in through centralized backend
async function handleSignIn() {
    try {
        console.log('Background: Checking existing authentication...');
        
        // First, try to get session from website cookies
        const websiteAuth = await checkWebsiteAuthentication();
        if (websiteAuth.success) {
            console.log('Background: Found existing website authentication');
            // Store the auth info locally
            await chrome.storage.local.set({
                currentUser: websiteAuth.user,
                authToken: websiteAuth.token,
                clerkSession: websiteAuth.session
            });
            return {
                success: true,
                user: websiteAuth.user,
                message: 'Automatically signed in using existing session'
            };
        }
        
        // Final attempt: Try to get user data from stored extension data
        const storedData = await chrome.storage.local.get(['currentUser', 'authToken']);
        if (storedData.currentUser && storedData.currentUser.email !== 'user@example.com') {
            console.log('Background: Using stored user data:', storedData.currentUser);
            return {
                success: true,
                user: storedData.currentUser,
                message: 'Using stored session data'
            };
        }

        console.log('Background: No existing auth found, opening website...');
        const authUrl = 'http://localhost:9002?ext_auth=true'; // Add parameter to indicate extension auth
        const tab = await chrome.tabs.create({ url: authUrl });
        
        // Listen for messages from the website tab
        const messageListener = (message, sender, sendResponse) => {
            if (message.action === 'auth_completed' && sender.tab && sender.tab.id === tab.id) {
                console.log('Background: Received auth completion from website');
                // Store auth data
                chrome.storage.local.set({
                    currentUser: message.user,
                    authToken: message.token || 'website-token',
                    clerkSession: message.session || 'website-session'
                });
                // Remove listener
                chrome.runtime.onMessage.removeListener(messageListener);
                sendResponse({ success: true });
            }
        };
        
        chrome.runtime.onMessage.addListener(messageListener);
        
        return {
            success: false,
            message: 'Please sign in on the website tab that just opened. The extension will automatically detect when you\'re signed in.',
            tabId: tab.id,
            needsWebsiteAuth: true
        };
        
    } catch (error) {
        console.error('Background: Sign-in error:', error);
        return { success: false, error: error.message };
    }
}

// Handle sign out
async function handleSignOut() {
    try {
        console.log('Background: Signing out...');
        
        // Clear stored data
        await chrome.storage.local.remove(['currentUser', 'authToken', 'clerkSession']);
        
        return { success: true };
        
    } catch (error) {
        console.error('Background: Sign-out error:', error);
        return { success: false, error: error.message };
    }
}

// Check authentication status
async function checkAuthStatus() {
    try {
        const result = await chrome.storage.local.get(['currentUser', 'authToken']);
        if (result.currentUser && result.authToken) {
            // Verify with backend
            try {
                const response = await fetch('http://localhost:8000/api/auth/session', {
                    headers: {
                        'Authorization': `Bearer ${result.authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    return { success: true, user: result.currentUser, authenticated: true };
                }
            } catch (error) {
                console.error('Session verification failed:', error);
            }
            
            // Token invalid, clear storage
            await chrome.storage.local.remove(['currentUser', 'authToken']);
        }
        
        return { success: false, authenticated: false };
    } catch (error) {
        console.error('Background: Error checking auth status:', error);
        return { success: false, error: error.message };
    }
}

// Handle AI assistance requests
async function handleAIAssistance(data) {
    try {
        const result = await chrome.storage.local.get(['authToken']);
        if (!result.authToken) {
            return { success: false, error: 'Not authenticated' };
        }
        
        const response = await fetch('http://localhost:8000/api/ai/assist', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${result.authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`AI request failed: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('AI assistance error:', error);
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
                    console.log('Starting centralized authentication...');
                    
                    // Send message to background script for authentication
                    const result = await chrome.runtime.sendMessage({
                        action: 'signIn'
                    });
                    
                    if (result.success) {
                        window.currentUser = result.user;
                        console.log('Sign-in successful, user data:', result.user);
                        updateAuthUI(true, result.user);
                        console.log('Sign-in successful:', result.message || (result.user && result.user.email));
                        
                        // Show success message if auto-authenticated
                        if (result.message && result.message.includes('Automatically')) {
                            showNotification('✅ ' + result.message, 'success');
                        }
                    } else if (result.message && !result.needsWebsiteAuth) {
                        alert(result.message);
                        return result;
                    } else if (result.needsWebsiteAuth) {
                        showNotification('🔗 Opening authentication tab...', 'info');
                        return result;
                    } else {
                        console.error('Sign-in failed:', result.error);
                    }
                    
                    return result;
                    
                } catch (error) {
                    console.error('Sign-in error:', error);
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
                        updateAuthUI(false);
                    }
                    return result;
                } catch (error) {
                    console.error('Sign-out error:', error);
                    return { success: false, error: error.message };
                }
            }
        };
        
        // Check for existing authentication
        try {
            const result = await chrome.runtime.sendMessage({
                action: 'checkAuthStatus'
            });
            
            if (result.success && result.user && result.authenticated) {
                window.currentUser = result.user;
                updateAuthUI(true, result.user);
                console.log('Restored user session:', result.user.email);
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
        }

        // Helper function to show notifications
        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10001;
                padding: 12px 16px;
                border-radius: 8px;
                color: white;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 14px;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                backdrop-filter: blur(10px);
                transition: all 0.3s ease;
                ${type === 'success' ? 'background: rgba(34, 197, 94, 0.9);' : 
                  type === 'error' ? 'background: rgba(239, 68, 68, 0.9);' : 
                  'background: rgba(59, 130, 246, 0.9);'}
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // Auto remove after 3 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => notification.remove(), 300);
                }
            }, 3000);
        }

        // UI update function
        function updateAuthUI(isLoggedIn, user = null, isRealAuth = false) {
            const panel = document.getElementById('sensai-draggable-panel');
            if (!panel) return;

            const authSection = panel.querySelector('.sensai-auth-section');
            if (authSection) {
                if (isLoggedIn && user) {
                    // Extract user information with fallbacks
                    const displayName = user.displayName || user.firstName || user.name || user.email?.split('@')[0] || 'User';
                    const userEmail = user.email || user.primaryEmailAddress?.emailAddress || 'user@example.com';
                    const avatarLetter = displayName[0]?.toUpperCase() || userEmail[0]?.toUpperCase() || 'U';
                    const photoURL = user.photoURL || `https://placehold.co/32x32/4F46E5/FFFFFF?text=${avatarLetter}`;
                    
                    console.log('Updating UI with user:', { displayName, userEmail, photoURL, originalUser: user });
                    
                    authSection.innerHTML = `
                        <div class="sensai-user-info">
                            <img src="${photoURL}" alt="Profile" class="sensai-user-avatar">
                            <span class="sensai-user-name">${displayName}</span>
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

                // Call the new /process endpoint
                const response = await fetch('http://localhost:8000/process', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        problem: {
                            title: problemInfo.title,
                            description: problemInfo.description,
                            code: problemInfo.userCode
                        },
                        mode: action, // 'code' or 'hint'
                        use_evaluation: false // Default to false for speed
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                
                if (result.success) {
                    return result.response;
                } else {
                    return `Error: ${result.error || 'Failed to get AI assistance'}`;
                }
            } catch (error) {
                console.error('Error getting AI response:', error);
                return 'Sorry, I encountered an error while processing your request.';
            }
        }

        function extractProblemInfo() {
            // Try to get problem title
            let title = '';
            const titleSelectors = [
                '[data-cy="question-title"]',
                '.mr-2.text-label-1',
                'h1',
                '[class*="title"]',
                '.text-title-large',
                '.css-v3d350'
            ];
            
            for (const selector of titleSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    title = element.textContent.trim();
                    break;
                }
            }
            
            // Try to get problem description
            let description = '';
            const descriptionSelectors = [
                '[data-cy="question-content"]',
                '.question-content__JfgR',
                '[class*="description"]',
                '[class*="content"]',
                '.description__24sA',
                '[data-track-load="description_content"]',
                '.content__u3I1 .question-content'
            ];
            
            for (const selector of descriptionSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    description = element.textContent.trim();
                    description = description.replace(/\s+/g, ' ').substring(0, 500);
                    break;
                }
            }
            
            // Try to get current code from the editor - multiple methods
            let userCode = '';
            
            // Method 1: Try to get from Monaco editor's content
            const monacoEditor = document.querySelector('.monaco-editor');
            if (monacoEditor) {
                const lines = monacoEditor.querySelectorAll('.view-line');
                userCode = Array.from(lines)
                    .map(line => line.textContent)
                    .join('\n');
            }

            // Method 2: Fallback - try to get from the textarea if visible
            if (!userCode) {
                const textarea = document.querySelector('textarea.CodeMirror-line');
                if (textarea) {
                    userCode = textarea.value;
                }
            }

            // Method 3: Another fallback - try getting from pre-filled template
            if (!userCode) {
                const codeBlock = document.querySelector('[data-cy="code-content"]');
                if (codeBlock) {
                    userCode = codeBlock.textContent;
                }
            }

            // Clean up the code
            userCode = userCode.trim()
                .replace(/^\s*\n/gm, '\n') // Remove empty lines
                .replace(/\n{3,}/g, '\n\n'); // Reduce multiple newlines to max 2

            // Fallback: extract from URL if title is not found
            if (!title) {
                const urlParts = window.location.pathname.split('/');
                const slug = urlParts[urlParts.length - 1];
                if (slug) {
                    title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
            }

            return { 
                title: title || 'Unknown Problem', 
                description: description || 'Problem description not available',
                userCode: userCode || ''
            };
        }

        // Mode selection variables
        let selectedMode = 'hint'; // Default mode

        // Button event listeners for mode selection
        codeBtn.addEventListener('click', () => {
            selectedMode = 'code';
            codeBtn.classList.add('selected');
            hintBtn.classList.remove('selected');
        });

        hintBtn.addEventListener('click', () => {
            selectedMode = 'hint';
            hintBtn.classList.add('selected');
            codeBtn.classList.remove('selected');
        });

        // Send button functionality
        const sendBtn = panel.querySelector('.sensai-send-btn');
        sendBtn.addEventListener('click', async () => {
            const displayElement = panel.querySelector('.sensai-display-text');
            const displayContainer = panel.querySelector('.sensai-panel-display');
            
            // Show loading state
            displayElement.textContent = selectedMode === 'code' ? 'Getting code...' : 'Getting hint...';
            sendBtn.disabled = true;

            try {
                const response = await getAIResponse(selectedMode);
                
                if (selectedMode === 'code') {
                    // Display code with syntax highlighting
                    displayCodeResponse(displayContainer, response, 'code');
                } else {
                    // Display hint as formatted comment
                    const hintAsComment = `# ${response}`;
                    displayCodeResponse(displayContainer, hintAsComment, 'hint');
                }
            } catch (error) {
                console.error('Error getting AI response:', error);
                displayElement.textContent = 'Error: Could not get response. Check if server is running.';
            } finally {
                sendBtn.disabled = false;
            }
        });

                // Copy button functionality
        const copyBtn = panel.querySelector('.sensai-action-btn[title="Copy"]');
        copyBtn.addEventListener('click', async () => {
            let textToCopy = '';
            
            // Check if we have a code block
            const codeBlock = panel.querySelector('.sensai-code-content code');
            if (codeBlock) {
                // Extract plain text from highlighted code
                textToCopy = codeBlock.textContent;
                
                // If it's a hint (starts with #), remove the comment prefix
                const typeLabel = panel.querySelector('.sensai-code-type');
                if (typeLabel && typeLabel.textContent === 'Hint' && textToCopy.startsWith('# ')) {
                    textToCopy = textToCopy.substring(2); // Remove "# " prefix
                }
            } else {
                // Fallback to regular display text
                const displayElement = panel.querySelector('.sensai-display-text');
                textToCopy = displayElement.textContent;
            }
            
            if (textToCopy && textToCopy !== 'Ready' && !textToCopy.includes('Getting')) {
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    
                    // Visual feedback
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = 'Copied!';
                    copyBtn.style.backgroundColor = '#4CAF50';
                    
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.backgroundColor = '';
                    }, 2000);
                } catch (error) {
                    console.error('Failed to copy text:', error);
                    copyBtn.textContent = 'Failed';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy';
                    }, 2000);
                }
            } else {
                // Nothing to copy or still loading
                copyBtn.textContent = 'Nothing to copy';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 1500);
            }
        });

        // Import button functionality
        const importBtn = panel.querySelector('.sensai-action-btn[title="Import"]');
        importBtn.addEventListener('click', () => {
            let responseText = '';
            
            // Check if we have a code block
            const codeBlock = panel.querySelector('.sensai-code-content code');
            if (codeBlock) {
                // Extract plain text from highlighted code
                responseText = codeBlock.textContent;
            } else {
                // Fallback to regular display text
                const displayElement = panel.querySelector('.sensai-display-text');
                responseText = displayElement.textContent;
            }
            
            if (responseText && responseText !== 'Ready' && !responseText.includes('Getting')) {
                if (selectedMode === 'code') {
                    // For code, insert directly into editor
                    insertCodeIntoEditor(responseText);
                } else if (selectedMode === 'hint') {
                    // For hints, import as comment (keep the # prefix for import)
                    insertCodeIntoEditor(responseText);
                }
            } else {
                importBtn.textContent = 'Nothing to import';
                setTimeout(() => {
                    importBtn.textContent = 'Import';
                }, 1500);
            }
        });

                // Helper function to insert code into LeetCode editor
        function insertCodeIntoEditor(code) {
            try {
                // Strip indentation - just insert the raw line of code
                const cleanCode = stripIndentation(code);
                
                // Method 1: Try Monaco Editor (most common)
                const monacoEditor = document.querySelector('.monaco-editor');
                if (monacoEditor) {
                    // Try to insert at cursor position
                    if (insertCodeAtCursor(monacoEditor, cleanCode)) {
                        showImportSuccess();
                        return;
                    }
                }

                // Method 2: Try CodeMirror (fallback)
                const codeMirror = document.querySelector('.CodeMirror');
                if (codeMirror && codeMirror.CodeMirror) {
                    // Insert at cursor or append
                    const cursor = codeMirror.CodeMirror.getCursor();
                    codeMirror.CodeMirror.replaceRange(cleanCode, cursor);
                    showImportSuccess();
                    return;
                }

                // Method 3: Alternative approach using clipboard
                navigator.clipboard.writeText(cleanCode).then(() => {
                    importBtn.textContent = 'Copied to clipboard';
                    setTimeout(() => {
                        importBtn.textContent = 'Import';
                    }, 2000);
                });

            } catch (error) {
                console.error('Failed to insert code into editor:', error);
                importBtn.textContent = 'Import failed';
                setTimeout(() => {
                    importBtn.textContent = 'Import';
                }, 2000);
            }
        }



        // Insert code at cursor position in Monaco editor
        function insertCodeAtCursor(monacoEditor, code) {
            try {
                const textarea = monacoEditor.querySelector('textarea');
                if (textarea) {
                    textarea.focus();
                    
                    // Get cursor position
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const currentValue = textarea.value;
                    
                    // Insert at cursor position with a newline
                    const newValue = currentValue.slice(0, start) + '\n' + code + currentValue.slice(end);
                    
                    // Trigger input events to update Monaco
                    textarea.value = newValue;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    textarea.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Set cursor after inserted code
                    const newCursorPos = start + code.length + 1;
                    textarea.setSelectionRange(newCursorPos, newCursorPos);
                    
                    return true;
                }
            } catch (error) {
                console.error('Failed to insert at cursor:', error);
            }
            return false;
        }

        // Show import success feedback
        function showImportSuccess() {
            importBtn.textContent = 'Imported!';
            importBtn.style.backgroundColor = '#4CAF50';
            setTimeout(() => {
                importBtn.textContent = 'Import';
                importBtn.style.backgroundColor = '';
            }, 2000);
        }

        // Display code response with syntax highlighting
        function displayCodeResponse(container, code, type = 'code') {
            // Strip all leading indentation from the code
            const strippedCode = stripIndentation(code);
            
            // Clear existing content but preserve the original display text element
            const existingDisplayText = container.querySelector('.sensai-display-text');
            container.innerHTML = '';
            
            // Re-add the display text element (hidden when showing code block)
            if (existingDisplayText) {
                existingDisplayText.style.display = 'none';
                container.appendChild(existingDisplayText);
            }
            
            // Create code block structure
            const codeBlock = document.createElement('div');
            codeBlock.className = 'sensai-code-block';
            
            // Add metadata header
            const meta = document.createElement('div');
            meta.className = 'sensai-code-meta';
            const typeLabel = type === 'hint' ? 'Hint' : 'Code';
            meta.innerHTML = `
                <span class="sensai-code-time">${new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                <span class="sensai-code-type">${typeLabel}</span>
            `;
            
            // Add code content with icon
            const body = document.createElement('div');
            body.className = 'sensai-code-body';
            
            const icon = document.createElement('div');
            icon.className = 'sensai-code-icon';
            
            // Different icons for hints vs code
            if (type === 'hint') {
                icon.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFB84D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                `;
            } else {
                icon.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFB84D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="14" rx="2"/>
                        <path d="M8 20h8"/>
                    </svg>
                `;
            }
            
            const codeContent = document.createElement('pre');
            codeContent.className = 'sensai-code-content';
            const codeElement = document.createElement('code');
            codeElement.innerHTML = highlightPythonCode(strippedCode);
            codeContent.appendChild(codeElement);
            
            body.appendChild(icon);
            body.appendChild(codeContent);
            
            codeBlock.appendChild(meta);
            codeBlock.appendChild(body);
            container.appendChild(codeBlock);
            
            // Add CSS styles for code blocks
            addCodeBlockStyles();
        }

        // Strip all indentation from code
        function stripIndentation(code) {
            return code
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('\n');
        }

        // Simple Python syntax highlighting
        function highlightPythonCode(code) {
            // First escape HTML
            let highlighted = code
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            
            // Apply syntax highlighting
            highlighted = highlighted
                // Keywords
                .replace(/\b(def|class|if|else|elif|for|while|try|except|finally|with|import|from|return|yield|break|continue|pass|raise|lambda|and|or|not|in|is|True|False|None)\b/g, '<span class="kw">$1</span>')
                // Strings (handle escaped quotes)
                .replace(/(&#39;)(.*?)(&#39;)/g, '<span class="str">$1$2$3</span>')
                .replace(/(&quot;)(.*?)(&quot;)/g, '<span class="str">$1$2$3</span>')
                // Comments
                .replace(/(#.*$)/gm, '<span class="cm">$1</span>')
                // Numbers
                .replace(/\b(\d+\.?\d*)\b/g, '<span class="num">$1</span>')
                // Functions (word followed by parentheses)
                .replace(/(\w+)(\s*\()/g, '<span class="fn">$1</span>$2');
            
            return highlighted;
        }

        // Add CSS styles for code blocks
        function addCodeBlockStyles() {
            // Check if styles already added
            if (document.getElementById('sensai-code-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'sensai-code-styles';
            style.textContent = `
                .sensai-code-block {
                    background: #1e1e1e;
                    border: 1px solid #333;
                    border-radius: 8px;
                    margin: 8px 0;
                    overflow: hidden;
                    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
                    font-size: 12px;
                }

                .sensai-code-meta {
                    background: #2d2d2d;
                    padding: 6px 12px;
                    border-bottom: 1px solid #333;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 11px;
                    color: #888;
                }

                .sensai-code-type {
                    color: #FFB84D;
                    font-weight: 500;
                }

                .sensai-code-body {
                    display: flex;
                    align-items: flex-start;
                    padding: 8px;
                    gap: 8px;
                }

                .sensai-code-icon {
                    margin-top: 2px;
                    flex-shrink: 0;
                }

                .sensai-code-content {
                    flex: 1;
                    margin: 0;
                    background: none;
                    border: none;
                    padding: 0;
                    color: #d4d4d4;
                    line-height: 1.4;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                .sensai-code-content code {
                    background: none;
                    padding: 0;
                    font-family: inherit;
                }

                /* Syntax highlighting */
                .sensai-code-content .kw { color: #569cd6; } /* Keywords */
                .sensai-code-content .str { color: #ce9178; } /* Strings */
                .sensai-code-content .cm { color: #6a9955; font-style: italic; } /* Comments */
                .sensai-code-content .num { color: #b5cea8; } /* Numbers */
                .sensai-code-content .fn { color: #dcdcaa; } /* Functions */
            `;
            document.head.appendChild(style);
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