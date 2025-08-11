# 🤖 SensAI Advanced AI Setup

Your SensAI extension now uses a **hybrid AI architecture** for maximum power and reliability:

## 🏗️ Architecture

```
Chrome Extension
       ↓
Node.js Backend (Port 8000)
   ↓ AI Request
Python Backend (Port 8001)
   ↓ Claude + GPT Pipeline
Advanced AI Response
```

## 🚀 Quick Start

### 1. **Setup Python Backend** (Advanced AI)

```bash
cd backend
cp env.example .env
```

Edit `backend/.env` and add your API keys:
```env
CLAUDE_API_KEY=sk-ant-api03-your_claude_api_key_here
OPENAI_API_KEY=sk-your_openai_api_key_here  # Optional
```

### 2. **Setup Node.js Backend** (Authentication)

```bash
cd backend-clerk
cp env.example .env
```

Edit `backend-clerk/.env` and configure:
```env
CLERK_SECRET_KEY=sk_test_your_secret_key
GOOGLE_API_KEY=AIzaSy_your_gemini_key
PYTHON_BACKEND_URL=http://localhost:8001
USE_AI_EVALUATION=true
```

### 3. **Start Everything**

```bash
./start-backends.sh
```

Or manually:
```bash
# Terminal 1: Python Backend
cd backend && python server.py

# Terminal 2: Node.js Backend  
cd backend-clerk && npm run dev

# Terminal 3: Website
cd Website && npm run dev
```

## 🔑 API Keys Required

### **Claude API Key** (Required)
- Get from: https://console.anthropic.com/
- Used for: Advanced hint generation and code suggestions
- Cost: ~$0.01-0.05 per request

### **OpenAI API Key** (Optional)
- Get from: https://platform.openai.com/api-keys
- Used for: Quality evaluation of Claude responses
- If not provided: Evaluation is skipped (faster, cheaper)

### **Google Gemini API Key** (Fallback)
- Get from: https://makersuite.google.com/app/apikey
- Used for: Fallback if Python backend fails
- Cost: Free tier available

## ⚙️ Configuration

### **AI Quality vs Speed**

**High Quality (Recommended)**:
```env
USE_AI_EVALUATION=true
AI_MAX_RETRIES=2
```

**Fast Mode**:
```env
USE_AI_EVALUATION=false
AI_MAX_RETRIES=0
```

## 🧪 Testing

### **Health Checks**
```bash
curl http://localhost:8000/health  # Node.js backend
curl http://localhost:8001/health  # Python backend
```

### **Test AI Pipeline**
```bash
curl -X POST http://localhost:8001/process \
  -H "Content-Type: application/json" \
  -d '{
    "problem": {
      "title": "Two Sum",
      "description": "Find two numbers that add up to target",
      "code": "def twoSum(nums, target):\n    pass"
    },
    "mode": "hint",
    "use_evaluation": true
  }'
```

## 🚨 Troubleshooting

### **Python Backend Issues**
```bash
cd backend
pip install -r requirements.txt
python server.py
```

### **API Key Issues**
- Ensure `.env` files are properly configured
- Check API key permissions and quotas
- View logs for specific error messages

### **Port Conflicts**
```bash
# Check what's using ports
lsof -i :8000
lsof -i :8001

# Kill processes if needed
kill $(lsof -t -i:8000)
```

## 📊 Pipeline Details

### **1. Hint Generation**
- **Input**: Problem title, description, current code
- **Claude**: Generates educational hint (under 25 words)
- **GPT** (optional): Evaluates hint quality (1-5 score)
- **Retry**: If score < 3.0, tries again with improvement advice

### **2. Code Generation**  
- **Input**: Problem context and user's current progress
- **Claude**: Generates next 1-3 lines of code
- **GPT** (optional): Evaluates code quality and appropriateness
- **Output**: Minimal, progressive code snippet

## 🎯 Benefits

✅ **Higher Quality**: Claude + GPT evaluation ensures better responses  
✅ **Reliability**: Automatic fallback to Gemini if Python backend fails  
✅ **Educational**: Responses designed for learning, not just solving  
✅ **Scalable**: Can handle multiple users with proper API quotas  
✅ **Authenticated**: Full Clerk integration for user tracking  

## 💰 Cost Estimates

- **Claude (per request)**: $0.01-0.05
- **GPT Evaluation (per request)**: $0.001-0.005  
- **Gemini Fallback (per request)**: Free tier → $0.001
- **Total per hint/code**: ~$0.01-0.06

---

Your extension now has **production-grade AI** with the sophistication of Claude's reasoning and GPT's quality control! 🎉