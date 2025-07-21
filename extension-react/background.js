// Background service worker for SensAI Chrome Extension
console.log('SensAI: Background service worker loaded');

// Handle extension lifecycle events
chrome.runtime.onInstalled.addListener((details) => {
    console.log('SensAI: Extension installed/updated', details);
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('SensAI: Background received message', request);
    return true; // Keep message channel open for async responses
}); 