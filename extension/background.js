// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only proceed if the tab is completely loaded and is a LeetCode problem page
    if (changeInfo.status === 'complete' && tab.url?.includes('leetcode.com/problems/')) {
        // Inject the content script
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/content.js']
        }).catch(err => console.error('Failed to inject content script:', err));
    }
}); 