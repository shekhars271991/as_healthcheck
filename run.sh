#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}[INFO] Starting Aerospike Health Check Application${NC}"

# Check if required directories exist
if [ ! -d "frontend" ]; then
    echo -e "${RED}[ERROR] Frontend directory not found${NC}"
    exit 1
fi

if [ ! -d "backend" ]; then
    echo -e "${RED}[ERROR] Backend directory not found${NC}"
    exit 1
fi

# Start backend API
echo -e "${BLUE}[INFO] Starting Python backend API...${NC}"
cd backend

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}[INFO] Creating .env file from example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}[INFO] .env file created. Gemini API key is already configured.${NC}"
    else
        echo -e "${RED}[ERROR] .env.example file not found${NC}"
        exit 1
    fi
fi

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}[INFO] Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
echo -e "${YELLOW}[INFO] Installing backend dependencies...${NC}"
source venv/bin/activate
pip install -r requirements.txt

# Start backend in background
echo -e "${GREEN}[INFO] Starting backend API on http://localhost:8000${NC}"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Go back to root directory
cd ..

# Start frontend
echo -e "${BLUE}[INFO] Starting React frontend...${NC}"
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[INFO] Installing frontend dependencies...${NC}"
    npm install
fi

# Check for security vulnerabilities
echo -e "${YELLOW}[INFO] Checking for security vulnerabilities...${NC}"
npm audit --audit-level=moderate || true

# Start frontend development server
echo -e "${GREEN}[INFO] Starting frontend on http://localhost:3001${NC}"
echo -e "${GREEN}[INFO] Backend API is running on http://localhost:8000${NC}"
echo -e "${YELLOW}[INFO] Press Ctrl+C to stop all services${NC}"

# Start frontend
npm run dev &
FRONTEND_PID=$!

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}[INFO] Stopping services...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}[INFO] All services stopped${NC}"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait 