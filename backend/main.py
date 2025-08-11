from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import tarfile
import zipfile
import json
import os
import logging
import subprocess
from datetime import datetime
from pathlib import Path
import tempfile
import shutil
from typing import Dict, List, Any
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging to write to file
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

# Clear previous logs on startup
log_file = log_dir / "backend.log"
if log_file.exists():
    log_file.unlink()  # Delete the old log file
    print("Cleared previous log file")

# Configure logging with both file and console handlers
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / "backend.log"),
        logging.StreamHandler()  # Also log to console
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Aerospike Health Check Backend", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gemini configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY and GEMINI_API_KEY != 'your_gemini_api_key_here':
    genai.configure(api_key=GEMINI_API_KEY)
    logger.info("Gemini API key configured from environment")
else:
    logger.warning("Gemini API key not found in environment variables. Please set GEMINI_API_KEY in .env file")

# Check if asadm is available
try:
    result = subprocess.run(['asadm', '--version'], capture_output=True, text=True, timeout=5)
    if result.returncode == 0:
        logger.info(f"Asadm is available: {result.stdout.strip()}")
    else:
        logger.warning(f"Asadm version check failed: {result.stderr}")
except Exception as e:
    logger.error(f"Asadm not available: {e}")
    logger.error("Please install asadm to use the health check functionality")

# List of asadm commands to run - reduced to major ones to avoid large prompts
ASADM_COMMANDS = [
    "info",
    "show stat like client_write",
    "summary"
]

class HealthDataProcessor:
    def __init__(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        logger.info(f"Created temp directory: {self.temp_dir}")
    
    def extract_collectinfo(self, file_path: Path) -> Path:
        """Extract collectinfo tar/zip file"""
        extract_path = self.temp_dir / "extracted"
        extract_path.mkdir(exist_ok=True)
        
        logger.info(f"Attempting to extract file: {file_path}")
        logger.info(f"File suffix: '{file_path.suffix}'")
        logger.info(f"File name: {file_path.name}")
        
        # Try different extraction methods
        extraction_successful = False
        
        # Method 1: Try as tar file (handles .tar, .tar.gz, .tgz, and files without extension)
        try:
            logger.info("Attempting tar extraction...")
            with tarfile.open(file_path, 'r:*') as tar:
                tar.extractall(extract_path)
            logger.info("Tar extraction successful")
            extraction_successful = True
        except Exception as e:
            logger.info(f"Tar extraction failed: {e}")
        
        # Method 2: Try as zip file
        if not extraction_successful:
            try:
                logger.info("Attempting zip extraction...")
                with zipfile.ZipFile(file_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_path)
                logger.info("Zip extraction successful")
                extraction_successful = True
            except Exception as e:
                logger.info(f"Zip extraction failed: {e}")
        
        # Method 3: If no extension, try to detect file type by content
        if not extraction_successful and not file_path.suffix:
            logger.info("No file extension detected, trying to detect file type by content...")
            try:
                with open(file_path, 'rb') as f:
                    magic_bytes = f.read(4)
                
                # Check for tar magic bytes
                if magic_bytes.startswith(b'\x1f\x8b') or magic_bytes.startswith(b'ustar'):
                    logger.info("Detected tar format by magic bytes")
                    with tarfile.open(file_path, 'r:*') as tar:
                        tar.extractall(extract_path)
                    extraction_successful = True
                elif magic_bytes.startswith(b'PK'):
                    logger.info("Detected zip format by magic bytes")
                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                        zip_ref.extractall(extract_path)
                    extraction_successful = True
                else:
                    logger.info(f"Unknown file format, magic bytes: {magic_bytes.hex()}")
            except Exception as e:
                logger.error(f"Error detecting file type: {e}")
        
        if not extraction_successful:
            raise ValueError(f"Could not extract file: {file_path.name}. Tried tar, zip, and content detection.")
        
        logger.info(f"Extracted files to: {extract_path}")
        return extract_path
    
    def parse_health_report(self, report_path: Path) -> Dict[str, Any]:
        """Parse health report and extract structured data"""
        try:
            with open(report_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            lines = content.split('\n')
            data = {
                'cluster_info': {
                    'name': '',
                    'server_version': '',
                    'os_version': '',
                    'cluster_size': 0,
                    'devices': {'total': 0, 'per_node': 0},
                    'shmem_index': {'used': 0, 'unit': 'GB'},
                    'memory': {'total': 0, 'used': 0, 'used_percent': 0, 'available': 0, 'unit': 'GB'},
                    'license_usage': {'latest': 0, 'unit': 'GB'},
                    'active_namespaces': {'count': 0, 'total': 0},
                    'active_features': []
                },
                'namespaces': [],
                'raw_content': content,
                'parsed_at': datetime.now().isoformat()
            }
            
            in_cluster_section = False
            in_namespace_section = False
            current_namespace = None
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Detect sections
                if 'cluster' in line.lower() and '===' in line:
                    in_cluster_section = True
                    in_namespace_section = False
                    continue
                elif 'namespaces' in line.lower() and '===' in line:
                    in_cluster_section = False
                    in_namespace_section = True
                    continue
                
                # Parse cluster information
                if in_cluster_section and line.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.')):
                    if ':' in line:
                        key_part = line.split(':', 1)[0]
                        value = line.split(':', 1)[1].strip()
                        key = key_part.split('.', 1)[1].strip()
                        
                        if 'cluster name' in key.lower():
                            data['cluster_info']['name'] = value
                        elif 'server version' in key.lower():
                            data['cluster_info']['server_version'] = value
                        elif 'os version' in key.lower():
                            data['cluster_info']['os_version'] = value
                        elif 'cluster size' in key.lower():
                            data['cluster_info']['cluster_size'] = int(value) if value.isdigit() else 0
                        elif 'devices' in key.lower():
                            if 'total' in value.lower() and 'per-node' in value.lower():
                                import re
                                match = re.search(r'Total (\d+), per-node (\d+)', value)
                                if match:
                                    data['cluster_info']['devices'] = {
                                        'total': int(match.group(1)),
                                        'per_node': int(match.group(2))
                                    }
                        elif 'shmem index' in key.lower():
                            import re
                            match = re.search(r'(\d+(?:\.\d+)?)\s*(\w+)', value)
                            if match:
                                data['cluster_info']['shmem_index'] = {
                                    'used': float(match.group(1)),
                                    'unit': match.group(2)
                                }
                        elif 'memory' in key.lower():
                            import re
                            pattern = r'Total\s+(\d+(?:\.\d+)?)\s*(\w+),\s*(\d+(?:\.\d+)?)%\s*used\s*\(([^)]+)\),\s*(\d+(?:\.\d+)?)%\s*available'
                            match = re.search(pattern, value)
                            if match:
                                data['cluster_info']['memory'] = {
                                    'total': float(match.group(1)),
                                    'used_percent': float(match.group(3)),
                                    'used': float(match.group(4)),
                                    'available_percent': float(match.group(5)),
                                    'unit': match.group(2)
                                }
                        elif 'active namespaces' in key.lower():
                            import re
                            match = re.search(r'(\d+)\s+of\s+(\d+)', value)
                            if match:
                                data['cluster_info']['active_namespaces'] = {
                                    'count': int(match.group(1)),
                                    'total': int(match.group(2))
                                }
                        elif 'active features' in key.lower():
                            data['cluster_info']['active_features'] = [f.strip() for f in value.split(',')]
                
                # Parse namespace information
                if in_namespace_section:
                    if '===' in line and not 'namespaces' in line.lower():
                        namespace_name = line.replace('=', '').strip()
                        current_namespace = {
                            'name': namespace_name,
                            'devices': {'total': 0, 'per_node': 0},
                            'shmem_index': {'used': 0, 'unit': 'GB'},
                            'memory': {'total': 0, 'used': 0, 'used_percent': 0, 'available': 0, 'unit': 'GB'},
                            'license_usage': {'latest': 0, 'unit': 'GB'},
                            'replication_factor': 0,
                            'rack_aware': False,
                            'master_objects': {'count': 0, 'unit': 'M'},
                            'compression_ratio': 0
                        }
                        data['namespaces'].append(current_namespace)
                    elif current_namespace and line.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.')):
                        if ':' in line:
                            key_part = line.split(':', 1)[0]
                            value = line.split(':', 1)[1].strip()
                            key = key_part.split('.', 1)[1].strip()
                            
                            if 'replication factor' in key.lower():
                                current_namespace['replication_factor'] = int(value) if value.isdigit() else 0
                            elif 'rack-aware' in key.lower():
                                current_namespace['rack_aware'] = value.lower() == 'true'
                            elif 'master objects' in key.lower():
                                import re
                                match = re.search(r'(\d+(?:\.\d+)?)\s*(\w+)', value)
                                if match:
                                    current_namespace['master_objects'] = {
                                        'count': float(match.group(1)),
                                        'unit': match.group(2)
                                    }
                            elif 'compression-ratio' in key.lower():
                                current_namespace['compression_ratio'] = float(value) if value.replace('.', '').isdigit() else 0
            
            logger.info(f"Parsed health report: {len(data['namespaces'])} namespaces found")
            return data
            
        except Exception as e:
            logger.error(f"Error parsing health report: {e}")
            raise
    
    def find_health_report(self, extract_path: Path) -> Path:
        """Find the health report file in extracted directory"""
        logger.info(f"Searching for health report files in: {extract_path}")
        
        # List all files in the extracted directory for debugging
        all_files = list(extract_path.rglob('*'))
        logger.info(f"Total files found: {len(all_files)}")
        for file_path in all_files:
            if file_path.is_file():
                logger.info(f"  File: {file_path.name} ({file_path.stat().st_size} bytes)")
            else:
                logger.info(f"  Directory: {file_path.name}")
        
        # Method 1: Look for files with 'health' or 'report' in the name
        for file_path in extract_path.rglob('*'):
            if file_path.is_file() and ('health' in file_path.name.lower() or 'report' in file_path.name.lower()):
                logger.info(f"Found health report by name: {file_path}")
                return file_path
        
        # Method 2: Look for .txt files
        txt_files = [f for f in extract_path.rglob('*.txt') if f.is_file()]
        if txt_files:
            logger.info(f"Found {len(txt_files)} .txt files:")
            for txt_file in txt_files:
                logger.info(f"  - {txt_file}")
            logger.info(f"Using first .txt file: {txt_files[0]}")
            return txt_files[0]
        
        # Method 3: Look for any text-like files (no extension or other extensions)
        text_files = []
        for file_path in extract_path.rglob('*'):
            if file_path.is_file() and file_path.stat().st_size > 0:
                # Try to read first few bytes to check if it's text
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        first_line = f.readline().strip()
                        if first_line and len(first_line) > 10:  # Likely a text file
                            text_files.append(file_path)
                            logger.info(f"Potential text file: {file_path.name} (first line: {first_line[:50]}...)")
                except Exception as e:
                    logger.info(f"Could not read {file_path.name}: {e}")
        
        if text_files:
            logger.info(f"Found {len(text_files)} potential text files, using first: {text_files[0]}")
            return text_files[0]
        
        # Method 4: Look for files with specific content patterns
        for file_path in extract_path.rglob('*'):
            if file_path.is_file() and file_path.stat().st_size > 100:  # Reasonable size for a report
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read(1000)  # Read first 1000 chars
                        if any(keyword in content.lower() for keyword in ['cluster', 'namespace', 'aerospike', 'summary']):
                            logger.info(f"Found potential report by content: {file_path}")
                            return file_path
                except Exception as e:
                    logger.info(f"Could not read content of {file_path.name}: {e}")
        
        raise FileNotFoundError(f"No health report file found in collectinfo archive. Searched in: {extract_path}")
    
    def run_asadm_commands(self, file_path: Path) -> Dict[str, Any]:
        """Run asadm commands and capture output"""
        logger.info("Starting asadm command execution...")
        logger.info(f"Using file: {file_path}")
        
        results = {}
        total_commands = len(ASADM_COMMANDS)
        
        for i, command in enumerate(ASADM_COMMANDS, 1):
            logger.info(f"Running command {i}/{total_commands}: {command}")
            
            try:
                # Run asadm command directly on the file
                cmd = ['asadm', '-c', '-f', str(file_path), '-e', command]
                logger.info(f"Running command: {' '.join(cmd)}")
                
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.PIPE, 
                    text=True
                )
                
                stdout, stderr = process.communicate()
                
                # Store results
                results[command] = {
                    'stdout': stdout,
                    'stderr': stderr,
                    'return_code': process.returncode,
                    'success': process.returncode == 0
                }
                
                if process.returncode == 0:
                    logger.info(f"Command '{command}' completed successfully")
                else:
                    logger.warning(f"Command '{command}' failed with return code {process.returncode}")
                    if stderr:
                        logger.warning(f"Error output: {stderr}")
                        
            except Exception as e:
                logger.error(f"Error running command '{command}': {e}")
                results[command] = {
                    'stdout': '',
                    'stderr': str(e),
                    'return_code': -1,
                    'success': False
                }
        
        logger.info(f"Completed {len(results)} asadm commands")
        return results
    
    def generate_health_reports(self, asadm_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate structured health reports from asadm results"""
        logger.info("Generating health reports...")
        
        reports = {
            'dc_report': '',
            'timestamp': datetime.now().isoformat()
        }
        
        # Generate dc report
        if 'info dc' in asadm_results and asadm_results['info dc']['success']:
            reports['dc_report'] = asadm_results['info dc']['stdout']
            logger.info("DC report generated successfully")
        else:
            reports['dc_report'] = f"ERROR: {asadm_results.get('info dc', {}).get('stderr', 'Unknown error')}"
            logger.warning("Info dc command failed")
        
        logger.info("Health reports generated successfully")
        return reports
    
    def find_collectinfo_path(self, extract_path: Path) -> Path:
        """Find the collectinfo directory or file"""
        logger.info(f"Searching for collectinfo in: {extract_path}")
        
        # Look for directories with 'collectinfo' in the name
        for item in extract_path.iterdir():
            if item.is_dir() and 'collectinfo' in item.name.lower():
                logger.info(f"Found collectinfo directory: {item}")
                return item
        
        # Look for files with 'collectinfo' in the name
        for item in extract_path.rglob('*'):
            if item.is_file() and 'collectinfo' in item.name.lower():
                logger.info(f"Found collectinfo file: {item}")
                return item
        
        # If no collectinfo found, return the extract path itself
        logger.info(f"No collectinfo directory/file found, using extract path: {extract_path}")
        return extract_path
    
    def find_collectinfo_file(self, collectinfo_path: Path) -> Path:
        """Find the actual collectinfo file within a directory"""
        logger.info(f"Searching for collectinfo file in: {collectinfo_path}")
        
        if collectinfo_path.is_file():
            logger.info(f"Path is already a file: {collectinfo_path}")
            return collectinfo_path
        
        # Look for files with specific patterns
        patterns = [
            '*collectinfo*',
            '*aerospike*',
            '*.asadm',
            '*.txt',
            '*.log'
        ]
        
        for pattern in patterns:
            for file_path in collectinfo_path.rglob(pattern):
                if file_path.is_file() and file_path.stat().st_size > 1000:  # Reasonable size
                    logger.info(f"Found potential collectinfo file: {file_path} ({file_path.stat().st_size} bytes)")
                    return file_path
        
        # If no specific file found, look for any large text file
        for file_path in collectinfo_path.rglob('*'):
            if file_path.is_file() and file_path.stat().st_size > 10000:  # Large file
                try:
                    # Try to read first few bytes to check if it's text
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        first_line = f.readline().strip()
                        if first_line and len(first_line) > 10:
                            logger.info(f"Found large text file: {file_path} ({file_path.stat().st_size} bytes)")
                            return file_path
                except Exception as e:
                    logger.info(f"Could not read {file_path.name}: {e}")
        
        logger.info(f"No collectinfo file found in: {collectinfo_path}")
        return None
    
    def parse_with_gemini(self, combined_output: str) -> Dict[str, Any]:
        """Parse all asadm command outputs using Gemini API"""
        try:
            if not GEMINI_API_KEY or GEMINI_API_KEY == 'your_gemini_api_key_here':
                logger.error("Gemini API key not configured")
                return {
                    'error': 'Gemini API key not configured',
                    'raw_content': combined_output,
                    'parsed_at': datetime.now().isoformat()
                }
            
            logger.info("Sending data to Gemini for parsing...")
            
            # Create a concise prompt for parsing
            prompt = f"""Parse this Aerospike cluster data and return ONLY valid JSON (no markdown formatting, no code blocks, just pure JSON) with these fields.

IMPORTANT: For clientWrites data, look for the 'show stat like client_write' section which contains node-by-node statistics:
1. Find the rows for 'client_write_success' and 'xdr_client_write_success'
2. Extract the individual values for each node as arrays (do NOT sum them)
3. Also extract the corresponding node names/addresses
4. The backend will handle the aggregation

Example:
- If you see: client_write_success |23095|32213|215400|69448|249390
- Extract as: clientWriteSuccessPerNode: [23095, 32213, 215400, 69448, 249390]
- Extract nodeNames: ["node1_address", "node2_address", "node3_address", "node4_address", "node5_address"]

Fields to extract:

{{
  "clusterInfo": {{
    "name": "cluster name",
    "version": "server version", 
    "size": "number of nodes",
    "namespaces": "number of namespaces",
    "memory": {{
      "total": "total memory",
      "used": "used memory",
      "usedPercent": "usage percentage"
    }},
    "license": {{
      "usage": "license usage amount",
      "usagePercent": "license usage percentage",
      "total": "total license capacity"
    }}
  }},
  "nodes": [
    {{
      "node": "node address",
      "status": "node status",
      "uptime": "uptime",
      "connections": "client connections"
    }}
  ],

  "namespaces": [
    {{
      "name": "namespace name",
      "objects": "total objects",
      "memoryUsed": "memory used",
      "memoryUsedPercent": "memory usage %",
      "replicationFactor": "replication factor",
      "usageInfo": {{
        "evictions": "eviction count",
        "stopWrites": "stop writes status",
        "systemMemory": "system memory available %",
        "primaryIndex": {{
          "type": "index type",
          "used": "index memory used"
        }},
        "secondaryIndex": {{
          "type": "secondary index type",
          "used": "secondary index memory used"
        }},
        "storageEngine": {{
          "used": "storage engine memory used",
          "availablePercent": "available percentage",
          "evictPercent": "eviction percentage"
        }}
      }},
      "objectInfo": {{
        "totalRecords": "total records",
        "masterObjects": "master objects count",
        "proleObjects": "prole objects count",
        "nonReplicaObjects": "non-replica objects count",
        "expirations": "expiration count",
        "tombstones": {{
          "master": "master tombstones",
          "prole": "prole tombstones",
          "nonReplica": "non-replica tombstones"
        }},
        "pendingMigrates": {{
          "tx": "transmit count",
          "rx": "receive count"
        }}
      }},
      "license": {{
        "usage": "namespace license usage",
        "usagePercent": "namespace license usage percentage"
      }},
      "clientWrites": {{
        "clientWriteSuccessPerNode": "array of client_write_success values for each node from 'show stat like client_write' output",
        "xdrClientWriteSuccessPerNode": "array of xdr_client_write_success values for each node from 'show stat like client_write' output",
        "nodeNames": "array of node names/addresses corresponding to the values"
      }}
    }}
  ],
  "networkInfo": {{
    "nodes": [
      {{
        "node": "node address",
        "nodeId": "node ID",
        "ip": "IP address",
        "build": "build version",
        "migrations": "migration count",
        "cluster": {{
          "size": "cluster size",
          "key": "cluster key",
          "integrity": "integrity status",
          "principal": "principal node"
        }},
        "clientConnections": "client connections",
        "uptime": "uptime"
      }}
    ]
  }},
  "health": {{
    "overall": "overall health status",
    "passed": "number of passed checks",
    "failed": "number of failed checks",
    "skipped": "number of skipped checks",
    "issues": ["list of issues"]
  }},
  "lastUpdated": "{datetime.now().isoformat()}"
}}

Data to parse:
{combined_output}"""
            
            # Call Gemini API
            model = genai.GenerativeModel('gemini-2.0-flash')
            response = model.generate_content(prompt)
            
            # Extract the response
            ai_response = response.text.strip()
            logger.info(f"Received response from Gemini (length: {len(ai_response)})")
            
            # Check if response is empty or too short
            if not ai_response or len(ai_response) < 10:
                logger.error("Gemini returned empty or very short response")
                raise Exception("Gemini API returned empty response")
            
            # Clean the response - remove markdown code blocks if present
            cleaned_response = ai_response
            if ai_response.startswith('```json'):
                # Remove ```json and ``` from the response
                cleaned_response = ai_response.replace('```json', '').replace('```', '').strip()
            elif ai_response.startswith('```'):
                # Remove ``` from the response
                cleaned_response = ai_response.replace('```', '').strip()
            
            logger.info(f"Cleaned response length: {len(cleaned_response)}")
            
            # Parse the JSON response
            try:
                parsed_data = json.loads(cleaned_response)
                parsed_data['raw_content'] = combined_output
                parsed_data['parsed_at'] = datetime.now().isoformat()
                parsed_data['ai_parsed'] = True
                
                # Calculate derived metrics for each namespace
                self.calculate_derived_metrics(parsed_data)
                
                # Log the complete flow for debugging
                logger.info("=== GEMINI PROMPT ===")
                logger.info(prompt)
                logger.info("=== GEMINI RAW RESPONSE ===")
                logger.info(ai_response)
                logger.info("=== GEMINI CLEANED RESPONSE ===")
                logger.info(cleaned_response)
                logger.info("=== FINAL PARSED DATA ===")
                logger.info(json.dumps(parsed_data, indent=2))
                
                logger.info("Successfully parsed data with Gemini")
                return parsed_data
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini response as JSON: {e}")
                logger.error(f"AI Response: {ai_response}")
                logger.error(f"Cleaned Response: {cleaned_response}")
                
                # Fallback to basic structure with extracted data
                return self.create_fallback_structure(combined_output, ai_response)
                
        except Exception as e:
            logger.error(f"Error calling Gemini API: {e}")
            return self.create_fallback_structure(combined_output, f"Gemini API error: {e}")

    def calculate_derived_metrics(self, parsed_data: Dict[str, Any]) -> None:
        """Calculate derived metrics for namespaces"""
        try:
            if 'namespaces' not in parsed_data or not parsed_data['namespaces']:
                return
            
            for namespace in parsed_data['namespaces']:
                if 'clientWrites' in namespace and 'license' in namespace:
                    client_writes = namespace['clientWrites']
                    license_info = namespace['license']
                    
                    # Extract and aggregate node values
                    try:
                        # Get per-node arrays
                        client_write_per_node = client_writes.get('clientWriteSuccessPerNode', [])
                        xdr_client_write_per_node = client_writes.get('xdrClientWriteSuccessPerNode', [])
                        
                        # Convert to numbers and sum across all nodes
                        client_write_success = 0
                        if client_write_per_node:
                            for value in client_write_per_node:
                                numeric_value = float(''.join(c for c in str(value).replace(',', '') if c.isdigit() or c == '.'))
                                client_write_success += numeric_value
                        
                        xdr_client_write_success = 0
                        if xdr_client_write_per_node:
                            for value in xdr_client_write_per_node:
                                numeric_value = float(''.join(c for c in str(value).replace(',', '') if c.isdigit() or c == '.'))
                                xdr_client_write_success += numeric_value
                        
                        # Extract license usage (remove units like GB, MB, etc.)
                        license_usage_str = str(license_info.get('usage', '0'))
                        license_usage = float(''.join(c for c in license_usage_str.replace(',', '') if c.isdigit() or c == '.'))
                        
                        # Calculate unique writes percentage
                        # Formula: (Client Write Success - XDR Client Write Success) * 100 / Client Write Success
                        if client_write_success > 0:
                            unique_writes_percent = ((client_write_success - xdr_client_write_success) * 100) / client_write_success
                            unique_writes_percent = max(0, min(100, unique_writes_percent))  # Clamp between 0-100
                        else:
                            unique_writes_percent = 0
                        
                        # Calculate unique data
                        # Formula: license usage * % of unique writes
                        unique_data = license_usage * (unique_writes_percent / 100)
                        
                        # Add aggregated and calculated values to the namespace
                        client_writes['clientWriteSuccess'] = int(client_write_success)
                        client_writes['xdrClientWriteSuccess'] = int(xdr_client_write_success)
                        client_writes['uniqueWritesPercent'] = f"{unique_writes_percent:.2f}%"
                        client_writes['uniqueData'] = f"{unique_data:.2f}"
                        
                        logger.info(f"Calculated metrics for namespace {namespace.get('name', 'Unknown')}: "
                                   f"clientWriteSuccess={int(client_write_success)} (aggregated from {len(client_write_per_node)} nodes), "
                                   f"xdrClientWriteSuccess={int(xdr_client_write_success)} (aggregated from {len(xdr_client_write_per_node)} nodes), "
                                   f"uniqueWritesPercent={unique_writes_percent:.2f}%, "
                                   f"uniqueData={unique_data:.2f}")
                        
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Failed to calculate derived metrics for namespace {namespace.get('name', 'Unknown')}: {e}")
                        # Set default values if calculation fails
                        client_writes['uniqueWritesPercent'] = 'N/A'
                        client_writes['uniqueData'] = 'N/A'
                        
        except Exception as e:
            logger.error(f"Error calculating derived metrics: {e}")

    def create_fallback_structure(self, combined_output: str, error_msg: str = "") -> Dict[str, Any]:
        """Create a basic fallback structure when Gemini fails"""
        try:
            # Extract basic info from the combined output
            lines = combined_output.split('\n')
            
            # Basic structure
            fallback_data = {
                'clusterInfo': {
                    'name': 'Unknown',
                    'version': 'Unknown',
                    'size': 0,
                    'namespaces': 0,
                    'memory': {
                        'total': 'Unknown',
                        'used': 'Unknown',
                        'usedPercent': 'Unknown'
                    },
                    'license': {
                        'usage': 'Unknown',
                        'usagePercent': 'Unknown',
                        'total': 'Unknown'
                    }
                },
                'nodes': [],
                'namespaces': [],
                'networkInfo': {
                    'nodes': []
                },
                'health': {
                    'overall': 'Unknown',
                    'passed': 0,
                    'failed': 0,
                    'skipped': 0,
                    'issues': []
                },
                'lastUpdated': datetime.now().isoformat(),
                'error': error_msg,
                'raw_content': combined_output
            }
            
            # Try to extract basic info from the output
            for line in lines:
                line = line.strip()
                if 'Cluster Name' in line:
                    fallback_data['clusterInfo']['name'] = line.split('|')[-1].strip()
                elif 'Server Version' in line:
                    fallback_data['clusterInfo']['version'] = line.split('|')[-1].strip()
                elif 'Cluster Size' in line:
                    try:
                        fallback_data['clusterInfo']['size'] = int(line.split('|')[-1].strip())
                    except:
                        pass
                elif 'Namespaces Active' in line:
                    try:
                        fallback_data['clusterInfo']['namespaces'] = int(line.split('|')[-1].strip())
                    except:
                        pass
                elif 'Total:' in line and 'Passed:' in line and 'Failed:' in line:
                    parts = line.split()
                    try:
                        fallback_data['health']['passed'] = int(parts[parts.index('Passed:') + 1])
                        fallback_data['health']['failed'] = int(parts[parts.index('Failed:') + 1])
                    except:
                        pass
            
            logger.info("Created fallback structure due to Gemini failure")
            return fallback_data
            
        except Exception as e:
            logger.error(f"Error creating fallback structure: {e}")
            return {
                'clusterInfo': {'name': 'Error', 'version': 'Error', 'size': 0, 'namespaces': 0, 'memory': {'total': 'Error', 'used': 'Error', 'usedPercent': 'Error'}},
                'nodes': [],
                'namespaces': [],
                'health': {'overall': 'Error', 'passed': 0, 'failed': 0, 'issues': []},
                'lastUpdated': datetime.now().isoformat(),
                'error': f'Fallback error: {e}',
                'raw_content': combined_output
            }

    def parse_info_data(self, text: str) -> Dict[str, Any]:
        """Parse info dc command output and extract structured data"""
        try:
            logger.info("Parsing info dc command output...")
            lines = text.split('\n')
            
            data = {
                'dc_info': {
                    'timestamp': '',
                    'nodes': []
                },
                'raw_content': text,
                'parsed_at': datetime.now().isoformat()
            }
            
            # Parse DC information
            in_header = False
            header_passed = False
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                logger.info(f"Processing line: {line}")
                
                # Extract timestamp from header
                if 'DC Information' in line and '(' in line and ')' in line:
                    import re
                    match = re.search(r'\(([^)]+)\)', line)
                    if match:
                        data['dc_info']['timestamp'] = match.group(1)
                        logger.info(f"Found timestamp: {data['dc_info']['timestamp']}")
                
                # Detect header section
                if 'Node|' in line and 'DC|' in line and 'DC Type|' in line:
                    in_header = True
                    header_passed = False
                    logger.info("Found header line")
                    continue
                
                # Skip separator lines
                if line.startswith('~') or line.startswith('-'):
                    continue
                
                # Skip empty lines
                if not line:
                    continue
                
                # Skip header separator lines (lines with just | characters)
                if in_header and line.count('|') >= 2 and all(part.strip() == '' for part in line.split('|')):
                    logger.info("Skipping header separator line")
                    continue
                
                # Skip lines that are part of the header (column labels)
                if in_header and ('Shipped' in line or 'Latency' in line or '(ms)' in line):
                    logger.info("Skipping header label line")
                    continue
                
                # Parse data rows (only after header is completely passed)
                if in_header and '|' in line and line.count('|') >= 7:
                    # Check if this looks like a data row (has node address)
                    if any(part.strip() and '.' in part.strip() for part in line.split('|')):
                        header_passed = True
                        
                        # Split by | and clean up
                        parts = [part.strip() for part in line.split('|')]
                        
                        if len(parts) >= 8:  # Ensure we have enough columns
                            node_info = {
                                'node': parts[0],
                                'dc': parts[1],
                                'dc_type': parts[2],
                                'namespaces': parts[3],
                                'lag': parts[4],
                                'records_shipped': parts[5],
                                'avg_latency_ms': parts[6],
                                'status': parts[7]
                            }
                            
                            # Try to convert numeric values
                            try:
                                if node_info['records_shipped'].isdigit():
                                    node_info['records_shipped'] = int(node_info['records_shipped'])
                            except (ValueError, AttributeError):
                                pass
                            
                            try:
                                if node_info['avg_latency_ms'].isdigit():
                                    node_info['avg_latency_ms'] = int(node_info['avg_latency_ms'])
                            except (ValueError, AttributeError):
                                pass
                            
                            # Only add if it's a valid node (has a node address)
                            if node_info['node'] and '.' in node_info['node']:
                                data['dc_info']['nodes'].append(node_info)
                                logger.info(f"Parsed node: {node_info['node']} in DC {node_info['dc']}")
                            else:
                                logger.info(f"Skipping invalid node: {node_info['node']}")
            
            logger.info(f"Parsed {len(data['dc_info']['nodes'])} nodes")
            return data
            
        except Exception as e:
            logger.error(f"Error parsing health report: {e}")
            return {
                'cluster_info': {},
                'namespaces': [],
                'raw_content': text,
                'parsed_at': datetime.now().isoformat(),
                'parse_error': str(e)
            }
    
    def cleanup(self):
        """Clean up temporary files"""
        try:
            shutil.rmtree(self.temp_dir)
            logger.info("Cleaned up temporary files")
        except Exception as e:
            logger.error(f"Error cleaning up: {e}")

# Global processor instance
processor = HealthDataProcessor()

@app.post("/upload")
async def upload_collectinfo(file: UploadFile = File(...)):
    """Upload and process collectinfo file"""
    logger.info(f"=== Starting file upload process ===")
    logger.info(f"File received: {file.filename}")
    logger.info(f"File size: {file.size} bytes")
    logger.info(f"Content type: {file.content_type}")
    
    try:
        if not file.filename:
            logger.error("No filename provided in upload")
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Save uploaded file
        file_path = processor.temp_dir / file.filename
        logger.info(f"Saving file to: {file_path}")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"File saved successfully. File size on disk: {file_path.stat().st_size} bytes")
        
        # Run asadm commands directly on the uploaded file
        logger.info("Running asadm commands on uploaded file...")
        asadm_results = processor.run_asadm_commands(file_path)
        logger.info(f"Asadm commands completed. {len(asadm_results)} commands executed")
        
        # Combine all asadm outputs
        logger.info("Combining asadm command outputs...")
        combined_output = ""
        for command, result in asadm_results.items():
            if result['success']:
                combined_output += f"\n=== {command.upper()} ===\n"
                combined_output += result['stdout']
                combined_output += "\n"
            else:
                combined_output += f"\n=== {command.upper()} (FAILED) ===\n"
                combined_output += f"Error: {result['stderr']}\n"
        
        logger.info(f"Combined output length: {len(combined_output)} characters")
        
        # Parse with Gemini
        logger.info("Parsing data with Gemini...")
        parsed_data = processor.parse_with_gemini(combined_output)
        logger.info("Gemini parsing completed")
        
        # Cleanup
        logger.info("Cleaning up temporary files...")
        processor.cleanup()
        
        logger.info("=== File upload process completed successfully ===")
        
        return JSONResponse({
            "success": True,
            "filename": file.filename,
            "data": parsed_data,
            "message": "File processed successfully"
        })
        
    except Exception as e:
        logger.error(f"=== File upload process failed ===")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        logger.error(f"Error details: {e}")
        
        # Log the full traceback for debugging
        import traceback
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        
        processor.cleanup()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "gemini_configured": GEMINI_API_KEY != 'your_gemini_api_key_here'}

@app.get("/debug/files")
async def debug_files():
    """Debug endpoint to show extracted files"""
    try:
        if not processor.temp_dir.exists():
            return {"message": "No temp directory found"}
        
        files_info = []
        for file_path in processor.temp_dir.rglob('*'):
            if file_path.is_file():
                files_info.append({
                    "name": file_path.name,
                    "path": str(file_path.relative_to(processor.temp_dir)),
                    "size": file_path.stat().st_size,
                    "type": "file"
                })
            else:
                files_info.append({
                    "name": file_path.name,
                    "path": str(file_path.relative_to(processor.temp_dir)),
                    "type": "directory"
                })
        
        return {
            "temp_dir": str(processor.temp_dir),
            "files": files_info
        }
    except Exception as e:
        logger.error(f"Error in debug endpoint: {e}")
        return {"error": str(e)}





@app.delete("/clear-logs")
async def clear_logs():
    """Clear all log files"""
    try:
        log_dir = Path("logs")
        if log_dir.exists():
            for log_file in log_dir.glob("*.log"):
                log_file.unlink()
                logger.info(f"Deleted log file: {log_file}")
        
        return JSONResponse({"success": True, "message": "Log files cleared successfully"})
        
    except Exception as e:
        logger.error(f"Error clearing logs: {e}")
        return JSONResponse({"success": False, "message": f"Error clearing logs: {str(e)}"})

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 