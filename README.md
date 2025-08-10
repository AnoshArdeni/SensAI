# SensAI - Code Learning Assistant

An AI-powered Chrome extension that provides intelligent coding hints and solutions for LeetCode problems using Google Gemini.

## Features

### 🤖 AI-Powered Assistance
- **Smart Hints**: Get contextual hints to guide your problem-solving approach
- **Code Generation**: Receive code snippets to advance your solution
- **Intelligent Responses**: Powered by Google Gemini for accurate and helpful assistance

### 🔐 User Authentication
- **Google Sign-In**: Secure authentication using Chrome Identity API
- **User Profiles**: Personalized experience with your Google account
- **Session Persistence**: Stay logged in across browser sessions

### 🎯 LeetCode Integration
- **Seamless Integration**: Works directly on LeetCode problem pages
- **Code Extraction**: Automatically extracts your current code
- **Problem Detection**: Identifies the current problem you're working on
- **Draggable Panel**: Convenient floating interface that doesn't interfere with your coding

## Installation

### Prerequisites
- Google Chrome browser
- Google Cloud Project with OAuth 2.0 configured for Chrome extensions

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SensAI
   ```

2. **Set up Google OAuth**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create or select a project
   - Enable the Google+ API
   - Create OAuth 2.0 Client ID for Chrome extension
   - Add your extension ID to authorized JavaScript origins
   - Update `extension/manifest.json` with your client ID

3. **Set up the backend**
   ```bash
   cd backend
   pip install -r requirements.txt
   export GOOGLE_API_KEY="your-gemini-api-key"
   python server.py
   ```

4. **Install the Chrome extension**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `extension` folder
   - The SensAI icon should appear in your Chrome toolbar

## Usage

### Getting Started
1. **Navigate to LeetCode**: Go to any LeetCode problem page (e.g., https://leetcode.com/problems/two-sum/)
2. **Open SensAI**: Click the SensAI icon in your Chrome toolbar
3. **Sign In**: Click "Sign in with Google" to authenticate
4. **Get Assistance**: Use the "Get Hint" or "Get Code" buttons for AI-powered help

### Features Overview
- **Draggable Panel**: Move the panel anywhere on the page by dragging the header
- **Minimize/Close**: Use the minimize (▼) or close (×) buttons to manage the panel
- **AI Assistance**: Get contextual hints or code solutions based on your current problem
- **User Account**: Your authentication persists across browser sessions

## Architecture

### Frontend (Chrome Extension)
- **Manifest V3**: Modern Chrome extension architecture
- **Content Scripts**: Interact with LeetCode pages
- **Background Service Worker**: Handle authentication and API calls
- **Chrome Identity API**: Secure OAuth 2.0 authentication

### Backend (FastAPI)
- **Google Gemini Integration**: AI-powered responses
- **Problem Analysis**: Intelligent code and hint generation
- **RESTful API**: Clean endpoints for extension communication

### Authentication Flow
```
User clicks "Sign in" → Chrome Identity API → Google OAuth → Access Token → User Info API → Persistent Storage
```

## API Endpoints

### POST `/assist`
Generate AI assistance for coding problems.

**Request Body:**
```json
{
  "action": "hint" | "code",
  "problem_title": "Two Sum",
  "problem_description": "Given an array of integers...",
  "user_code": "def twoSum(self, nums, target):",
  "user_id": "google-user-id"
}
```

**Response:**
```json
{
  "response": "Try using a hash map to store the numbers you've seen..."
}
```

## Development

### Project Structure
```
SensAI/
├── extension/
│   ├── manifest.json          # Extension configuration
│   ├── background.js          # Service worker with auth logic
│   ├── content/
│   │   └── content.js         # LeetCode page integration
│   └── ui/
│       ├── panel.html         # Main UI template
│       └── panel.css          # Styling
├── backend/
│   ├── server.py              # FastAPI server
│   └── requirements.txt       # Python dependencies
└── README.md
```

### Authentication Implementation
- **Chrome Identity API**: Official Chrome extension OAuth
- **Message Passing**: Communication between content script and background
- **Token Management**: Automatic token refresh and storage
- **User Sessions**: Persistent login across browser restarts

## Configuration

### Environment Variables
```bash
# Backend
GOOGLE_API_KEY=your-gemini-api-key

# Chrome Extension (manifest.json)
CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
```

### OAuth Setup
1. Create OAuth 2.0 Client ID in Google Cloud Console
2. Set application type to "Chrome extension"
3. Add your extension ID to authorized origins
4. Update manifest.json with your client ID

## Security

- **No Client Secrets**: Chrome Identity API handles OAuth securely
- **Token Storage**: Uses Chrome's secure storage APIs
- **HTTPS Only**: All API communication over secure connections
- **Minimal Permissions**: Extension requests only necessary permissions

## Troubleshooting

### Extension Won't Load
- Check for JSON syntax errors in `manifest.json`
- Verify all required permissions are included
- Check Chrome Developer Tools for error messages

### Authentication Fails
- Verify OAuth client ID is correct in manifest
- Ensure extension ID is added to Google Cloud Console
- Check that Google+ API is enabled

### Backend Connection Issues
- Ensure FastAPI server is running on `http://localhost:8000`
- Check CORS settings if accessing from different domain
- Verify Google API key is set and valid

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Roadmap

- [ ] Dark mode support
- [ ] Multiple programming language support
- [ ] Advanced analytics dashboard
- [ ] Problem recommendation system
- [ ] Collaborative features