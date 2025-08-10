// Centralized authentication for Chrome extension
const API_BASE = 'http://localhost:8000';

class ExtensionAuth {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.authToken = null;
    }

    /**
     * Initialize authentication by checking existing session
     */
    async initialize() {
        try {
            console.log('Initializing extension authentication...');
            
            // Check if user has stored auth data
            const stored = await chrome.storage.local.get(['authToken', 'currentUser']);
            
            if (stored.authToken) {
                this.authToken = stored.authToken;
                
                // Verify token with backend
                const isValid = await this.verifySession();
                if (isValid) {
                    this.currentUser = stored.currentUser;
                    this.isAuthenticated = true;
                    console.log('Restored existing session for:', this.currentUser?.email);
                    return true;
                }
            }
            
            // No valid session found
            console.log('No valid session found');
            return false;
        } catch (error) {
            console.error('Auth initialization error:', error);
            return false;
        }
    }

    /**
     * Sign in by opening website authentication flow
     */
    async signIn() {
        try {
            console.log('Starting authentication flow...');
            
            // Open website auth page in new tab
            const authUrl = 'http://localhost:9002/auth'; // Your website auth page
            const tab = await chrome.tabs.create({ url: authUrl });
            
            return new Promise((resolve, reject) => {
                // Listen for tab updates to detect successful auth
                const listener = (tabId, changeInfo, updatedTab) => {
                    if (tabId === tab.id && changeInfo.url) {
                        // Check if redirected to success page or contains auth token
                        if (changeInfo.url.includes('/dashboard') || changeInfo.url.includes('auth-success')) {
                            chrome.tabs.onUpdated.removeListener(listener);
                            
                            // Extract auth token from the page
                            this.extractAuthFromTab(tab.id)
                                .then(resolve)
                                .catch(reject);
                        }
                    }
                };
                
                chrome.tabs.onUpdated.addListener(listener);
                
                // Also listen for tab closure (user cancelled)
                const closeListener = (tabId) => {
                    if (tabId === tab.id) {
                        chrome.tabs.onRemoved.removeListener(closeListener);
                        chrome.tabs.onUpdated.removeListener(listener);
                        reject(new Error('Authentication cancelled'));
                    }
                };
                
                chrome.tabs.onRemoved.addListener(closeListener);
                
                // Timeout after 5 minutes
                setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    chrome.tabs.onRemoved.removeListener(closeListener);
                    reject(new Error('Authentication timeout'));
                }, 300000);
            });
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    }

    /**
     * Extract authentication data from authenticated tab
     */
    async extractAuthFromTab(tabId) {
        try {
            // Execute script in the tab to get auth token from Clerk
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                function: () => {
                    // This function runs in the website context
                    return new Promise((resolve) => {
                        // Try to get Clerk session token
                        if (window.Clerk && window.Clerk.session) {
                            window.Clerk.session.getToken().then(token => {
                                resolve({
                                    token,
                                    user: {
                                        id: window.Clerk.user.id,
                                        email: window.Clerk.user.primaryEmailAddress?.emailAddress,
                                        firstName: window.Clerk.user.firstName,
                                        lastName: window.Clerk.user.lastName,
                                        imageUrl: window.Clerk.user.imageUrl
                                    }
                                });
                            }).catch(() => resolve(null));
                        } else {
                            resolve(null);
                        }
                    });
                }
            });

            const authData = results[0]?.result;
            if (authData && authData.token) {
                await this.setAuthData(authData.token, authData.user);
                chrome.tabs.remove(tabId); // Close auth tab
                return { success: true, user: authData.user };
            }

            throw new Error('Failed to extract authentication data');
        } catch (error) {
            console.error('Error extracting auth from tab:', error);
            throw error;
        }
    }

    /**
     * Verify session with backend
     */
    async verifySession() {
        try {
            if (!this.authToken) return false;

            const response = await fetch(`${API_BASE}/api/auth/session`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.ok;
        } catch (error) {
            console.error('Session verification error:', error);
            return false;
        }
    }

    /**
     * Make authenticated API request
     */
    async makeAuthenticatedRequest(endpoint, options = {}) {
        if (!this.authToken) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (response.status === 401) {
            // Token expired, clear auth
            await this.signOut();
            throw new Error('Authentication expired');
        }

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Get AI assistance
     */
    async getAIAssistance(data) {
        return this.makeAuthenticatedRequest('/api/ai/assist', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Store authentication data
     */
    async setAuthData(token, user) {
        this.authToken = token;
        this.currentUser = user;
        this.isAuthenticated = true;

        await chrome.storage.local.set({
            authToken: token,
            currentUser: user
        });

        console.log('Authentication data stored for:', user.email);
    }

    /**
     * Sign out
     */
    async signOut() {
        try {
            if (this.authToken) {
                // Notify backend of logout
                await this.makeAuthenticatedRequest('/api/auth/logout', { method: 'POST' });
            }
        } catch (error) {
            console.error('Logout error:', error);
        }

        // Clear local data
        this.authToken = null;
        this.currentUser = null;
        this.isAuthenticated = false;

        await chrome.storage.local.remove(['authToken', 'currentUser']);
        console.log('Signed out successfully');
    }

    /**
     * Get current user
     */
    getUser() {
        return this.currentUser;
    }

    /**
     * Check if authenticated
     */
    isSignedIn() {
        return this.isAuthenticated && this.authToken && this.currentUser;
    }
}

// Export singleton instance
const extensionAuth = new ExtensionAuth();
window.extensionAuth = extensionAuth;