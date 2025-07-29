git #!/bin/bash

# Aerospike Health Dashboard Runner Script
# This script sets up and runs the React dashboard application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "auto-health-check.py" ]; then
    print_error "This script must be run from the automateHealthcheck directory"
    print_error "Current directory: $(pwd)"
    exit 1
fi

# Check if aerospike-health-dashboard directory exists
if [ ! -d "aerospike-health-dashboard" ]; then
    print_error "aerospike-health-dashboard directory not found"
    print_error "Please ensure the dashboard has been set up"
    exit 1
fi

# Navigate to the dashboard directory
print_status "Navigating to aerospike-health-dashboard directory..."
cd aerospike-health-dashboard

# Check if package.json exists
if [ ! -f "package.json" ]; then
    print_error "package.json not found in aerospike-health-dashboard directory"
    exit 1
fi

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
else
    print_status "Dependencies already installed"
fi

# Check for any security vulnerabilities
print_status "Checking for security vulnerabilities..."
npm audit --audit-level=moderate || {
    print_warning "Security vulnerabilities found. Consider running 'npm audit fix'"
}

# Start the development server
print_status "Starting Aerospike Health Dashboard..."
print_status "The application will be available at: http://localhost:3000 (or next available port)"
print_status "Press Ctrl+C to stop the server"
echo ""

# Run the development server
npm run dev 