# SensAI Deployment Guide

## Production Deployment

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker (optional)
- Clerk account with production keys
- Google Cloud Platform account (for Gemini API)
- Anthropic API key (for Claude)
- OpenAI API key (for GPT evaluation)

### Environment Configuration

#### 1. Website (.env)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

#### 2. Node.js Backend (.env)
```bash
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
GOOGLE_API_KEY=your_gemini_api_key
PORT=8000
NODE_ENV=production
ALLOWED_ORIGINS=https://your-domain.com,chrome-extension://your-extension-id
PYTHON_BACKEND_URL=https://ai.your-domain.com
```

#### 3. Python Backend (.env)
```bash
CLAUDE_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
```

### Deployment Options

#### Platform-Specific Deployments

##### Website (Vercel/Netlify)
```bash
cd Website
npm install
npm run build
npm run start
```

##### Node.js Backend (Railway/Heroku)
```bash
cd backend-clerk
npm install
npm run build
npm run production
```

##### Python Backend (Railway/Google Cloud Run)
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```

#### Vercel (Website)
1. Connect GitHub repository
2. Set build command: `cd Website && npm run build`
3. Set output directory: `Website/.next`
4. Add environment variables in dashboard

#### Railway (Backends)
1. Create new project
2. Connect GitHub repository
3. Set root directory for each service
4. Add environment variables
5. Deploy

#### Chrome Web Store (Extension)
1. Update `extension/manifest.json` with production URLs
2. Create ZIP file of extension directory
3. Upload to Chrome Web Store Developer Dashboard
4. Submit for review

### Security Checklist

- [ ] All API keys are in environment variables
- [ ] CORS is properly configured
- [ ] HTTPS is enabled for all services
- [ ] Security headers are set
- [ ] Database connections are encrypted
- [ ] Rate limiting is implemented
- [ ] Input validation is in place

### Monitoring

#### Health Checks
```bash
# Website
curl https://your-domain.com

# Node.js Backend
curl https://api.your-domain.com/health

# Python Backend
curl https://ai.your-domain.com/health
```

#### Logs
```bash
# Local development
./start-backends.sh  # Check terminal output

# Production deployment
pm2 logs  # if using PM2
journalctl -f  # systemd logs
```

### Scaling

#### Horizontal Scaling
- Use load balancers (AWS ALB, Cloudflare)
- Run multiple instances of each service
- Use Redis for session storage

#### Vertical Scaling
- Increase CPU/RAM allocation
- Optimize database queries
- Implement caching strategies

### Backup Strategy

#### Database Backup
```bash
# If using PostgreSQL
pg_dump sensai_db > backup.sql

# If using MongoDB
mongodump --db sensai_db
```

#### Configuration Backup
- Store environment variables in secure vault
- Backup Clerk configuration
- Document API key sources

### Troubleshooting

#### Common Issues

1. **CORS Errors**
   - Check ALLOWED_ORIGINS in backend
   - Verify Clerk dashboard settings

2. **API Key Issues**
   - Verify all keys are production keys
   - Check key permissions and limits

3. **Authentication Failures**
   - Ensure Clerk URLs match deployment URLs
   - Check environment variable names

4. **Build Failures**
   - Clear node_modules and reinstall
   - Check Node.js version compatibility
   - Verify TypeScript compilation

#### Performance Issues

1. **Slow API Responses**
   - Check Python backend logs
   - Monitor AI API usage limits
   - Implement request caching

2. **Memory Leaks**
   - Monitor process memory usage
   - Restart services periodically
   - Optimize image sizes

### Maintenance

#### Regular Tasks
- Update dependencies monthly
- Rotate API keys quarterly
- Review access logs weekly
- Monitor error rates daily

#### Updates
```bash
# Update dependencies
npm update
pip install -r requirements.txt --upgrade

# Restart services
./stop-backends.sh
./start-backends.sh
```