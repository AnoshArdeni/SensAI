#!/bin/bash

# SensAI - Stop All Services Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log "Stopping SensAI services..."

# Stop services by port
PORTS=(8000 8001 9002)

for port in "${PORTS[@]}"; do
    log "Checking port $port..."
    PIDS=$(lsof -ti:$port 2>/dev/null || true)
    
    if [[ -n "$PIDS" ]]; then
        log "Stopping processes on port $port..."
        echo $PIDS | xargs kill -TERM 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        REMAINING=$(lsof -ti:$port 2>/dev/null || true)
        if [[ -n "$REMAINING" ]]; then
            warn "Force killing processes on port $port..."
            echo $REMAINING | xargs kill -9 2>/dev/null || true
        fi
        
        success "Port $port cleared"
    else
        log "No processes found on port $port"
    fi
done

# Clean up PID files
PID_FILES=(.node-backend.pid .python-backend.pid .website.pid)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for pid_file in "${PID_FILES[@]}"; do
    if [[ -f "$SCRIPT_DIR/$pid_file" ]]; then
        rm "$SCRIPT_DIR/$pid_file"
        log "Removed $pid_file"
    fi
done

success "All SensAI services stopped!"