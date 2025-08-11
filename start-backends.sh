#!/bin/bash

# SensAI Backend Startup Script
# This script starts both the Node.js and Python backends

echo "🚀 Starting SensAI Backends..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if port is available
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}❌ Port $1 is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $1 is available${NC}"
        return 0
    fi
}

# Check required ports
echo "🔍 Checking ports..."
check_port 8000 || exit 1
check_port 8001 || exit 1

# Start Python Backend (Advanced AI)
echo -e "\n${BLUE}🐍 Starting Python Backend (Advanced AI) on port 8001...${NC}"
cd backend
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Please copy env.example to .env and configure API keys${NC}"
    echo "cp env.example .env"
    exit 1
fi

# Install Python dependencies if needed
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt > /dev/null 2>&1

# Start Python backend in background
python server.py &
PYTHON_PID=$!
echo -e "${GREEN}✅ Python backend started (PID: $PYTHON_PID)${NC}"

cd ..

# Start Node.js Backend (Authentication)
echo -e "\n${BLUE}🟢 Starting Node.js Backend (Authentication) on port 8000...${NC}"
cd backend-clerk
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Please copy env.example to .env and configure API keys${NC}"
    echo "cp env.example .env"
    kill $PYTHON_PID
    exit 1
fi

# Install Node.js dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install > /dev/null 2>&1
fi

# Start Node.js backend in background
npm run dev &
NODEJS_PID=$!
echo -e "${GREEN}✅ Node.js backend started (PID: $NODEJS_PID)${NC}"

cd ..

# Print status
echo -e "\n${GREEN}🎉 Both backends are running!${NC}"
echo -e "${BLUE}📊 Services:${NC}"
echo -e "  • Node.js Backend (Auth): http://localhost:8000"
echo -e "  • Python Backend (AI):   http://localhost:8001"
echo -e "  • Health Check:          http://localhost:8000/health"
echo -e "  • AI Health Check:       http://localhost:8001/health"

echo -e "\n${YELLOW}💡 Tips:${NC}"
echo -e "  • View logs in separate terminals:"
echo -e "    Node.js: cd backend-clerk && npm run dev"
echo -e "    Python:  cd backend && python server.py"
echo -e "  • Stop backends: kill $NODEJS_PID $PYTHON_PID"

# Wait for interrupt
echo -e "\n${BLUE}Press Ctrl+C to stop all backends...${NC}"
wait

# Cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping backends...${NC}"
    kill $PYTHON_PID $NODEJS_PID 2>/dev/null
    echo -e "${GREEN}✅ All backends stopped${NC}"
}

trap cleanup INT TERM