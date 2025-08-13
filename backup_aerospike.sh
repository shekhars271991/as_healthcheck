#!/bin/bash

# Aerospike Backup Script
# This script creates a backup of the Aerospike database

set -e  # Exit on any error

# Configuration
BACKUP_DIR="./backups"
NAMESPACE="healthcheck"
AEROSPIKE_HOST="127.0.0.1"
AEROSPIKE_PORT="3000"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="aerospike_backup_${TIMESTAMP}.asb"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Aerospike Backup...${NC}"
echo "Configuration:"
echo "  Host: ${AEROSPIKE_HOST}:${AEROSPIKE_PORT}"
echo "  Namespace: ${NAMESPACE}"
echo "  Backup Directory: ${BACKUP_DIR}"
echo "  Backup File: ${BACKUP_FILE}"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Check if asbackup is available
if ! command -v asbackup &> /dev/null; then
    echo -e "${RED}Error: asbackup command not found${NC}"
    echo "Please install Aerospike tools: https://docs.aerospike.com/tools/backup/asbackup"
    exit 1
fi

# Check if Aerospike is running
echo "Checking Aerospike connection..."
if ! asinfo -h ${AEROSPIKE_HOST} -p ${AEROSPIKE_PORT} -v "build" &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Aerospike at ${AEROSPIKE_HOST}:${AEROSPIKE_PORT}${NC}"
    echo "Please ensure Aerospike is running"
    exit 1
fi

echo -e "${GREEN}✓ Aerospike connection successful${NC}"

# Perform backup
echo ""
echo "Starting backup process..."
echo "Command: asbackup --host ${AEROSPIKE_HOST} --port ${AEROSPIKE_PORT} --namespace ${NAMESPACE} --output-file ${BACKUP_DIR}/${BACKUP_FILE}"

if asbackup \
    --host ${AEROSPIKE_HOST} \
    --port ${AEROSPIKE_PORT} \
    --namespace ${NAMESPACE} \
    --output-file "${BACKUP_DIR}/${BACKUP_FILE}" \
    --verbose 2>&1; then
    
    echo ""
    echo -e "${GREEN}✓ Backup completed successfully!${NC}"
    echo "Backup file: ${BACKUP_DIR}/${BACKUP_FILE}"
    
    # Show backup file size
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    echo "Backup size: ${BACKUP_SIZE}"
    
    # List all backups
    echo ""
    echo "Available backups:"
    ls -lah "${BACKUP_DIR}"/*.asb 2>/dev/null || echo "No previous backups found"
    
else
    echo -e "${RED}✗ Backup failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Backup process completed.${NC}"
echo "To restore this backup, run: ./restore_aerospike.sh ${BACKUP_FILE}" 