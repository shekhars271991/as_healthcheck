#!/bin/bash

echo "Starting Aerospike Health Check Backend in VERBOSE mode..."
echo "This will show detailed logs including data dumps and processing steps."
echo ""

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# Run with verbose flag
python main.py --verbose 