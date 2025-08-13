# 📦 Aerospike Backup & Restore System

This directory contains scripts to backup and restore your Aerospike health check data.

## 🚀 Quick Start

### Create a Backup
```bash
./backup_aerospike.sh
```

### Restore from Backup (Interactive)
```bash
./restore_aerospike.sh
```

### Restore Specific Backup
```bash
./restore_aerospike.sh aerospike_backup_20240112_143022.asb
```

### Auto-Restore on Startup
```bash
./auto_restore_on_startup.sh
```

## 📋 Scripts Overview

### 1. `backup_aerospike.sh`
**Purpose**: Creates a timestamped backup of your Aerospike database

**Features**:
- ✅ Automatic timestamp naming (`aerospike_backup_YYYYMMDD_HHMMSS.asb`)
- ✅ Connection validation before backup
- ✅ Backup size reporting
- ✅ Lists all available backups after completion
- ✅ Error handling and validation

**Usage**:
```bash
./backup_aerospike.sh
```

**Output Example**:
```
Starting Aerospike Backup...
Configuration:
  Host: 127.0.0.1:3000
  Namespace: test
  Backup Directory: ./backups
  Backup File: aerospike_backup_20240112_143022.asb

✓ Aerospike connection successful
✓ Backup completed successfully!
Backup file: ./backups/aerospike_backup_20240112_143022.asb
Backup size: 2.3M
```

### 2. `restore_aerospike.sh`
**Purpose**: Restores data from a backup file

**Features**:
- ✅ Interactive backup selection
- ✅ Command-line backup specification
- ✅ Data loss warning with confirmation
- ✅ Post-restore statistics
- ✅ Backup file validation

**Usage**:
```bash
# Interactive mode - choose from available backups
./restore_aerospike.sh

# Specify backup file directly
./restore_aerospike.sh aerospike_backup_20240112_143022.asb
```

**Safety Features**:
- ⚠️ Warns about data replacement
- ⚠️ Requires explicit confirmation (y/N)
- ⚠️ Validates backup file existence

### 3. `auto_restore_on_startup.sh`
**Purpose**: Automatically restores the latest backup when Aerospike starts

**Features**:
- ✅ Waits for Aerospike to be available (up to 60 seconds)
- ✅ Finds and restores the most recent backup
- ✅ Skips restore if database already has data
- ✅ Perfect for system startup automation

**Usage**:
```bash
./auto_restore_on_startup.sh
```

**Smart Behavior**:
- 🔍 **Empty Database**: Automatically restores latest backup
- 🛡️ **Existing Data**: Skips restore to preserve current data
- ⏱️ **Startup Integration**: Can be added to system startup scripts

## 📂 Configuration

All scripts use these default settings (easily configurable at the top of each script):

```bash
BACKUP_DIR="./backups"           # Where backups are stored
NAMESPACE="healthcheck"          # Aerospike namespace to backup/restore
AEROSPIKE_HOST="127.0.0.1"      # Aerospike server host
AEROSPIKE_PORT="3000"           # Aerospike server port
```

## 🔧 Prerequisites

### Required Tools
- **asbackup**: Aerospike backup utility
- **asrestore**: Aerospike restore utility
- **asinfo**: Aerospike info utility

### Installation
```bash
# Install Aerospike tools (if not already installed)
# Download from: https://docs.aerospike.com/tools/backup/asbackup
```

### Verify Installation
```bash
asbackup --version
asrestore --version
asinfo --version
```

## 📅 Backup Strategy Recommendations

### Development Environment
```bash
# Create backup before major changes
./backup_aerospike.sh

# Work on your changes...

# Restore if needed
./restore_aerospike.sh
```

### Production Environment
```bash
# Schedule daily backups (add to crontab)
0 2 * * * /path/to/backup_aerospike.sh

# Keep auto-restore for disaster recovery
# Add to system startup scripts
```

### System Integration
```bash
# Add to your system startup script (systemd, init.d, etc.)
# Example for systemd:

# 1. Create service file: /etc/systemd/system/aerospike-auto-restore.service
[Unit]
Description=Aerospike Auto Restore
After=aerospike.service
Requires=aerospike.service

[Service]
Type=oneshot
ExecStart=/path/to/auto_restore_on_startup.sh
WorkingDirectory=/path/to/automateHealthcheck
User=aerospike

[Install]
WantedBy=multi-user.target

# 2. Enable the service
sudo systemctl enable aerospike-auto-restore.service
```

## 🗂️ File Structure

```
automateHealthcheck/
├── backup_aerospike.sh         # Manual backup script
├── restore_aerospike.sh        # Manual restore script  
├── auto_restore_on_startup.sh  # Startup restore script
├── BACKUP_README.md           # This documentation
└── backups/                   # Backup storage directory
    ├── aerospike_backup_20240112_143022.asb
    ├── aerospike_backup_20240112_153045.asb
    └── aerospike_backup_20240112_163108.asb
```

## 🔍 Troubleshooting

### Error: "asbackup command not found"
```bash
# Install Aerospike tools
wget -O aerospike-tools.tgz "https://download.aerospike.com/artifacts/aerospike-tools/[VERSION]/aerospike-tools-[VERSION]-linux.tgz"
tar -xzf aerospike-tools.tgz
sudo ./install.sh
```

### Error: "Cannot connect to Aerospike"
```bash
# Check if Aerospike is running
sudo systemctl status aerospike
# or
ps aux | grep aerospike

# Check port availability
netstat -ln | grep 3000
```

### Error: "No backup files found"
```bash
# Create your first backup
./backup_aerospike.sh

# Check backup directory
ls -la ./backups/
```

### Large Backup Files
```bash
# Monitor backup size during creation
du -h ./backups/

# Compress old backups if needed
gzip ./backups/aerospike_backup_*.asb
```

## 💡 Tips & Best Practices

1. **Regular Backups**: Create backups before major changes or deployments
2. **Test Restores**: Periodically test restore process in development
3. **Monitor Space**: Keep an eye on backup directory size
4. **Retention Policy**: Consider implementing backup rotation/cleanup
5. **Documentation**: Update this README if you modify configurations
6. **Automation**: Use auto-restore for seamless system recovery

## 🎯 Example Workflows

### Development Workflow
```bash
# Before making changes
./backup_aerospike.sh

# Make your changes, test...

# If something goes wrong
./restore_aerospike.sh

# Select the backup from before your changes
```

### Production Deployment
```bash
# 1. Create backup before deployment
./backup_aerospike.sh

# 2. Deploy your application

# 3. If rollback needed
./restore_aerospike.sh [backup-file]
```

### System Recovery
```bash
# After system restart, Aerospike will auto-restore
# if auto_restore_on_startup.sh is in your startup scripts

# Or manually trigger
./auto_restore_on_startup.sh
```

---

**📧 Questions?** Check the scripts' output messages for detailed guidance or modify the configuration variables at the top of each script to match your environment. 