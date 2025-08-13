#!/bin/bash

# Auto Restore on Startup Script
# This script automatically restores the latest Aerospike backup when the system starts

set -e  # Exit on any error

# Configuration
BACKUP_DIR="./backups"
NAMESPACE="healthcheck"
AEROSPIKE_HOST="127.0.0.1"
AEROSPIKE_PORT="3000"
MAX_WAIT_TIME=60  # Maximum time to wait for Aerospike to start (seconds)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Auto Restore on Startup${NC}"
echo "Waiting for Aerospike to be available..."

# Function to check if Aerospike is running
check_aerospike() {
    asinfo -h ${AEROSPIKE_HOST} -p ${AEROSPIKE_PORT} -v "build" &> /dev/null
}

# Function to find the latest backup
find_latest_backup() {
    if [[ ! -d "${BACKUP_DIR}" ]]; then
        echo ""
        return 1
    fi
    
    # Find the most recent .asb file
    local latest_backup=$(ls -t "${BACKUP_DIR}"/*.asb 2>/dev/null | head -n1)
    
    if [[ -z "$latest_backup" ]]; then
        echo ""
        return 1
    fi
    
    echo "$latest_backup"
    return 0
}

# Wait for Aerospike to start
echo "Checking Aerospike availability..."
wait_time=0
while [ $wait_time -lt $MAX_WAIT_TIME ]; do
    if check_aerospike; then
        echo -e "${GREEN}✓ Aerospike is running${NC}"
        break
    fi
    
    echo -n "."
    sleep 2
    wait_time=$((wait_time + 2))
done

# Check if we timed out
if [ $wait_time -ge $MAX_WAIT_TIME ]; then
    echo -e "\n${RED}✗ Timeout: Aerospike not available after ${MAX_WAIT_TIME} seconds${NC}"
    echo "Please start Aerospike manually and run this script again"
    exit 1
fi

# Find the latest backup
echo ""
echo "Looking for latest backup..."
latest_backup=$(find_latest_backup)

if [[ -z "$latest_backup" ]]; then
    echo -e "${YELLOW}⚠️  No backup files found in ${BACKUP_DIR}${NC}"
    echo "Skipping auto-restore. The database will start empty."
    echo "To create a backup, run: ./backup_aerospike.sh"
    exit 0
fi

backup_file=$(basename "$latest_backup")
backup_size=$(du -h "$latest_backup" | cut -f1)
backup_date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$latest_backup" 2>/dev/null || date -r "$latest_backup" "+%Y-%m-%d %H:%M:%S")

echo -e "${GREEN}✓ Found latest backup:${NC}"
echo "  File: ${backup_file}"
echo "  Size: ${backup_size}"
echo "  Date: ${backup_date}"

# Check if database is empty (skip restore if it has data)
echo ""
echo "Checking if database has existing data..."
object_count=$(asinfo -h ${AEROSPIKE_HOST} -p ${AEROSPIKE_PORT} -v "namespace/${NAMESPACE}" 2>/dev/null | grep -o "objects=[0-9]*" | cut -d= -f2 || echo "0")

if [[ "$object_count" != "0" ]]; then
    echo -e "${YELLOW}⚠️  Database already contains ${object_count} objects${NC}"
    echo "Skipping auto-restore to preserve existing data."
    echo "To force restore, run: ./restore_aerospike.sh ${backup_file}"
    exit 0
fi

echo -e "${GREEN}✓ Database is empty, proceeding with restore${NC}"

# Perform automatic restore
echo ""
echo -e "${BLUE}🔄 Starting automatic restore...${NC}"
echo "Restoring from: ${latest_backup}"

if asrestore \
    --host ${AEROSPIKE_HOST} \
    --port ${AEROSPIKE_PORT} \
    --input-file "$latest_backup" \
    --verbose; then
    
    echo ""
    echo -e "${GREEN}✅ Auto-restore completed successfully!${NC}"
    echo "Restored from: ${backup_file}"
    
    # Show final statistics
    echo ""
    echo "Database statistics after restore:"
    asinfo -h ${AEROSPIKE_HOST} -p ${AEROSPIKE_PORT} -v "namespace/${NAMESPACE}" | tr ';' '\n' | grep -E "objects|memory-size" | head -2 || true
    
else
    echo -e "${RED}✗ Auto-restore failed${NC}"
    echo "The database will start empty. You can manually restore using:"
    echo "./restore_aerospike.sh ${backup_file}"
    exit 1
fi

echo ""
echo -e "${BLUE}🎉 Startup restore process completed!${NC}" 