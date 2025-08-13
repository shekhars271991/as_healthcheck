#!/bin/bash

# Aerospike Restore Script
# This script restores a backup of the Aerospike database

set -e  # Exit on any error

# Configuration
BACKUP_DIR="./backups"
NAMESPACE="healthcheck"
AEROSPIKE_HOST="127.0.0.1"
AEROSPIKE_PORT="3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo "Usage: $0 [backup_file]"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Interactive mode - choose from available backups"
    echo "  $0 aerospike_backup_20240101_120000.asb  # Restore specific backup file"
    echo ""
    echo "Available backups:"
    if ls "${BACKUP_DIR}"/*.asb 1> /dev/null 2>&1; then
        ls -lah "${BACKUP_DIR}"/*.asb
    else
        echo "  No backup files found in ${BACKUP_DIR}"
    fi
}

# Function to select backup interactively
select_backup() {
    echo -e "${BLUE}Available backups:${NC}"
    
    # Check if backup directory exists and has .asb files
    if [[ ! -d "${BACKUP_DIR}" ]] || [[ ! $(ls "${BACKUP_DIR}"/*.asb 2>/dev/null) ]]; then
        echo -e "${RED}No backup files found in ${BACKUP_DIR}${NC}"
        echo "Please run ./backup_aerospike.sh first to create a backup"
        exit 1
    fi
    
    # List backups with numbers
    backups=($(ls "${BACKUP_DIR}"/*.asb 2>/dev/null))
    for i in "${!backups[@]}"; do
        backup_file=$(basename "${backups[$i]}")
        backup_size=$(du -h "${backups[$i]}" | cut -f1)
        backup_date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "${backups[$i]}" 2>/dev/null || date -r "${backups[$i]}" "+%Y-%m-%d %H:%M:%S")
        echo "  $((i+1))) ${backup_file} (${backup_size}, ${backup_date})"
    done
    
    echo ""
    read -p "Select backup number (1-${#backups[@]}): " selection
    
    # Validate selection
    if [[ ! "$selection" =~ ^[0-9]+$ ]] || [[ $selection -lt 1 ]] || [[ $selection -gt ${#backups[@]} ]]; then
        echo -e "${RED}Invalid selection${NC}"
        exit 1
    fi
    
    # Return selected backup file (basename only)
    echo $(basename "${backups[$((selection-1))]}")
}

echo -e "${YELLOW}Aerospike Restore Script${NC}"
echo ""

# Determine backup file to restore
if [[ $# -eq 0 ]]; then
    # Interactive mode
    BACKUP_FILE=$(select_backup)
elif [[ $# -eq 1 ]]; then
    # Command line argument
    BACKUP_FILE="$1"
    # Remove path if provided
    BACKUP_FILE=$(basename "$BACKUP_FILE")
else
    show_usage
    exit 1
fi

FULL_BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

echo "Configuration:"
echo "  Host: ${AEROSPIKE_HOST}:${AEROSPIKE_PORT}"
echo "  Namespace: ${NAMESPACE}"
echo "  Backup File: ${FULL_BACKUP_PATH}"
echo ""

# Check if backup file exists
if [[ ! -f "${FULL_BACKUP_PATH}" ]]; then
    echo -e "${RED}Error: Backup file not found: ${FULL_BACKUP_PATH}${NC}"
    echo ""
    show_usage
    exit 1
fi

# Check if asrestore is available
if ! command -v asrestore &> /dev/null; then
    echo -e "${RED}Error: asrestore command not found${NC}"
    echo "Please install Aerospike tools: https://docs.aerospike.com/tools/backup/asrestore"
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

# Warning about data loss
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will replace all data in namespace '${NAMESPACE}'${NC}"
read -p "Are you sure you want to continue? (y/N): " confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Restore cancelled"
    exit 0
fi

# Perform restore
echo ""
echo "Starting restore process..."
echo "Command: asrestore --host ${AEROSPIKE_HOST} --port ${AEROSPIKE_PORT} --input-file ${FULL_BACKUP_PATH}"

if asrestore \
    --host ${AEROSPIKE_HOST} \
    --port ${AEROSPIKE_PORT} \
    --input-file "${FULL_BACKUP_PATH}" \
    --verbose; then
    
    echo ""
    echo -e "${GREEN}✓ Restore completed successfully!${NC}"
    echo "Restored from: ${FULL_BACKUP_PATH}"
    
    # Show namespace statistics
    echo ""
    echo "Namespace statistics after restore:"
    asinfo -h ${AEROSPIKE_HOST} -p ${AEROSPIKE_PORT} -v "namespace/${NAMESPACE}" | tr ';' '\n' | grep -E "objects|memory-size|device-size" || true
    
else
    echo -e "${RED}✗ Restore failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Restore process completed.${NC}" 