# SensAI - Centralized Authentication Setup

Complete setup guide for SensAI with Clerk authentication shared between website and Chrome extension.

## 🏗️ Architecture Overview

```
Website (Next.js) ←→ Backend (Express + Clerk) ←→ Chrome Extension
                            ↓
                      Google Gemini AI
```

## 📦 Components

1. **Backend**: Centralized Node.js + Express server with Clerk authentication
2. **Website**: Next.js website with Clerk SDK
3. **Extension**: Chrome extension that authenticates through the centralized backend

## 🚀 Setup Instructions

### 1. Backend Setup

```bash
cd backend-clerk
npm install
```

Create `.env` file:
```bash
# Clerk Configuration
CLERK_SECRET_KEY=sk_test_1pTR0fmf6jQ4tGi3fDJXKBIGCOuysqVbwlBijDGxFv
CLERK_PUBLISHABLE_KEY=pk_test_dmFsdWVkLWFtb2ViYS01My5jbGVyay5hY2NvdW50cy5kZXYk

# Google AI
GOOGLE_API_KEY=your_google_gemini_api_key

# Server Configuration
PORT=8000
NODE_ENV=development

# CORS Origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:9002
```

Start the backend:
```bash
npm run dev
```

### 2. Website Setup

```bash
cd Website
npm install
```

Create `.env.local` file:
```bash
# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_dmFsdWVkLWFtb2ViYS01My5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_1pTR0fmf6jQ4tGi3fDJXKBIGCOuysqVbwlBijDGxFv

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the website:
```bash
npm run dev
```

### 3. Chrome Extension Setup

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension` folder
4. Note the extension ID for CORS configuration

## 🔐 Authentication Flow

### Website Authentication
1. User clicks "Sign In" on website
2. Clerk handles OAuth flow (Google, email/password, etc.)
3. Clerk issues JWT token
4. Website makes authenticated API calls to backend

### Extension Authentication
1. User clicks "Sign in with Google" in extension
2. Extension opens website in new tab for authentication
3. After successful auth, extension extracts token from website
4. Extension uses token for API calls to backend

## 🛡️ Security Features

- **JWT Tokens**: Secure token-based authentication
- **CORS Protection**: Configured for specific origins
- **Session Verification**: Backend validates all requests with Clerk
- **Token Expiration**: Automatic token refresh and validation

## 📡 API Endpoints

### Authentication Endpoints
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/extension` - Validate extension authentication  
- `POST /api/auth/logout` - Sign out user
- `GET /api/auth/session` - Check session validity

### AI Endpoints
- `POST /api/ai/assist` - Get AI assistance (requires auth)
- `GET /api/ai/usage` - Get usage statistics (requires auth)

### Test Endpoints
- `GET /health` - Health check
- `GET /api/protected` - Test protected route

## 🧪 Testing

### 1. Test Backend
```bash
# Health check
curl http://localhost:8000/health

# Test protected route (should return 401)
curl http://localhost:8000/api/protected
```

### 2. Test Website Authentication
1. Go to `http://localhost:9002`
2. Click "Sign In" 
3. Complete Clerk authentication
4. Check browser developer tools for successful API calls

### 3. Test Extension Authentication
1. Load extension in Chrome
2. Go to a LeetCode problem page
3. Click extension icon
4. Click "Sign in with Google"
5. Complete authentication on website tab
6. Extension should recognize authenticated state

## 🔧 Configuration

### Clerk Dashboard Setup
1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create new application
3. Configure OAuth providers (Google, etc.)
4. Add your domain to allowed origins
5. Copy API keys to environment files

### CORS Configuration
Update `ALLOWED_ORIGINS` in backend `.env` to include:
- Website URL: `http://localhost:9002`
- Extension origin: `chrome-extension://your-extension-id`

## 🐛 Troubleshooting

### Common Issues

**Backend won't start:**
- Check that all environment variables are set
- Verify Clerk keys are valid
- Ensure port 8000 is available

**Website authentication fails:**
- Verify Clerk keys match dashboard
- Check browser console for errors
- Ensure backend is running

**Extension can't authenticate:**
- Check extension ID in CORS origins
- Verify website authentication works first
- Check extension console for errors

**AI requests fail:**
- Verify Google API key is set
- Check user is authenticated
- Ensure backend can reach Google AI

### Debug Mode
Set `NODE_ENV=development` in backend for detailed error logs.

## 📁 Folder Structure

```
SensAI/
├── backend-clerk/           # Centralized backend
│   ├── src/
│   │   ├── middleware/      # Clerk auth middleware
│   │   ├── routes/          # API routes
│   │   └── server.ts        # Express server
│   └── package.json
├── Website/                 # Next.js website
│   ├── src/
│   │   ├── app/            # App router pages
│   │   ├── components/     # React components
│   │   └── lib/            # API utilities
│   ├── middleware.ts       # Clerk middleware
│   └── package.json
├── extension/              # Chrome extension
│   ├── background.js       # Service worker
│   ├── content/           # Content scripts
│   ├── ui/               # Extension UI
│   └── manifest.json
└── README.md
```

## 🎯 Next Steps

1. **Production Deployment**: Configure production URLs and HTTPS
2. **Database Integration**: Add persistent user data storage
3. **Analytics**: Implement usage tracking and analytics
4. **Rate Limiting**: Add API rate limiting for production
5. **Error Monitoring**: Set up error tracking and monitoring

## 📚 Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Express.js Documentation](https://expressjs.com/)