// Listen for extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
    // Only work on LeetCode problem pages
    if (tab.url?.includes('leetcode.com/problems/')) {
        try {
            // Inject the draggable panel
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: injectDraggablePanel
            });
        } catch (err) {
            console.error('Failed to inject draggable panel:', err);
        }
    } else {
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
function injectDraggablePanel() {
    // Check if panel already exists
    if (document.getElementById('sensai-draggable-panel')) {
        return;
    }

    // Create the draggable panel
    const panel = document.createElement('div');
    panel.id = 'sensai-draggable-panel';
    panel.innerHTML = `
        <div class="sensai-panel-header">
            <div class="sensai-panel-title">SensAI</div>
            <div class="sensai-panel-controls">
                <button class="sensai-minimize-btn" title="Minimize">−</button>
                <button class="sensai-close-btn" title="Close">×</button>
            </div>
        </div>
        <div class="sensai-panel-content">
            <div class="sensai-panel-section">
                <div class="sensai-panel-actions">
                    <button class="sensai-action-btn" title="Copy">Copy</button>
                    <button class="sensai-action-btn" title="Import">Import</button>
                </div>
                <div class="sensai-current-problem">[Current Problem]</div>
            </div>
            <div class="sensai-panel-display">
                <span class="sensai-display-text">Display</span>
            </div>
            <div class="sensai-panel-footer">
                <div class="sensai-footer-left">
                    <button class="sensai-code-btn selected">Code</button>
                    <button class="sensai-hint-btn">Hint</button>
                </div>
                <div class="sensai-footer-right">
                    <button class="sensai-send-btn" title="Send">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFB84D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        #sensai-draggable-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            background: #111111;
            border: 2px solid #524E4E;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #fff;
            cursor: move;
            user-select: none;
            transition: all 0.2s ease;
        }

        #sensai-draggable-panel.minimized {
            height: 50px;
            overflow: hidden;
        }

        .sensai-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: #222222;
            border-top-left-radius: 14px;
            border-top-right-radius: 14px;
            border-bottom: 1px solid #444;
            cursor: move;
        }

        .sensai-panel-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: #FFB84D;
        }

        .sensai-panel-controls {
            display: flex;
            gap: 8px;
        }

        .sensai-minimize-btn, .sensai-close-btn {
            background: transparent;
            border: none;
            color: #fff;
            font-size: 1.2rem;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background 0.2s;
        }

        .sensai-minimize-btn:hover, .sensai-close-btn:hover {
            background: #333;
        }

        .sensai-panel-content {
            padding: 16px;
            min-height: 200px;
        }

        .sensai-panel-section {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
        }

        .sensai-panel-actions {
            display: flex;
            gap: 8px;
        }

        .sensai-action-btn {
            background: #232323;
            border: 1px solid #888;
            border-radius: 4px;
            color: #fff;
            font-size: 0.8rem;
            padding: 4px 8px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .sensai-action-btn:hover {
            background: #333;
        }

        .sensai-current-problem {
            font-size: 0.8rem;
            color: #ccc;
        }

        .sensai-panel-display {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 80px;
            background: #222;
            border-radius: 8px;
            margin: 12px 0;
        }

        .sensai-display-text {
            color: #7A5230;
            font-size: 1.5rem;
            font-weight: 600;
        }

        .sensai-panel-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 16px;
        }

        .sensai-footer-left {
            display: flex;
            gap: 8px;
        }

        .sensai-code-btn, .sensai-hint-btn {
            background: #181818;
            border: 1px solid #444;
            border-radius: 6px;
            color: #fff;
            padding: 6px 12px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .sensai-code-btn.selected {
            background: #FFB84D;
            color: #000;
        }

        .sensai-code-btn:hover, .sensai-hint-btn:hover {
            background: #333;
        }

        .sensai-send-btn {
            background: #7A5230;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.2s;
        }

        .sensai-send-btn:hover {
            background: #8B5A3A;
        }

        .sensai-send-btn svg {
            display: block;
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(panel);

    // Dragging functionality
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    const header = panel.querySelector('.sensai-panel-header');

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === header || header.contains(e.target)) {
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, panel);
        }
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    // Minimize functionality
    const minimizeBtn = panel.querySelector('.sensai-minimize-btn');
    minimizeBtn.addEventListener('click', () => {
        panel.classList.toggle('minimized');
        minimizeBtn.textContent = panel.classList.contains('minimized') ? '+' : '−';
    });

    // Close functionality
    const closeBtn = panel.querySelector('.sensai-close-btn');
    closeBtn.addEventListener('click', () => {
        panel.remove();
    });
}

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