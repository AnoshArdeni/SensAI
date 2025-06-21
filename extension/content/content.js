// Content script for LeetCode integration
console.log('SensAI: Content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getProblemInfo') {
        const problemInfo = extractProblemInfo();
        sendResponse(problemInfo);
    }
    return true;
});

// Extract problem information from LeetCode page
function extractProblemInfo() {
    try {
        // Try to get problem title
        let title = '';
        const titleSelectors = [
            '[data-cy="question-title"]',
            '.mr-2.text-label-1',
            'h1',
            '[class*="title"]',
            '.text-title-large'
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
            '.description__24sA'
        ];
        
        for (const selector of descriptionSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                // Get text content and clean it up
                description = element.textContent.trim();
                // Remove extra whitespace and newlines
                description = description.replace(/\s+/g, ' ').substring(0, 500);
                break;
            }
        }
        
        // Fallback: extract from URL if title is not found
        if (!title) {
            const urlParts = window.location.pathname.split('/');
            const slug = urlParts[urlParts.length - 1];
            if (slug) {
                title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
        }
        
        // Fallback: get description from page text if not found
        if (!description) {
            const bodyText = document.body.textContent;
            const lines = bodyText.split('\n').filter(line => line.trim().length > 50);
            if (lines.length > 0) {
                description = lines[0].trim().substring(0, 500);
            }
        }
        
        return {
            success: true,
            title: title || 'Unknown Problem',
            description: description || 'Problem description not available',
            url: window.location.href
        };
        
    } catch (error) {
        console.error('Error extracting problem info:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Listen for page changes (for SPA navigation)
let currentUrl = window.location.href;
const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        // Wait a bit for the page to load
        setTimeout(() => {
            console.log('SensAI: Page changed, problem info updated');
        }, 1000);
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Log when content script is loaded
console.log('SensAI: Content script ready for LeetCode integration'); 