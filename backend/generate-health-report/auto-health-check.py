import os
import argparse
import sys
import subprocess
import time
import json
import re
from datetime import datetime

def parse_arguments():
    """Parse command line arguments with sensible defaults."""
    parser = argparse.ArgumentParser(
        description='Automated Aerospike Health Check using collectinfo',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python auto-health-check.py --collectinfo /path/to/collectinfo
  python auto-health-check.py --collectinfo /path/to/collectinfo --output /custom/report/path
  python auto-health-check.py -c /path/to/collectinfo -o ./reports
        """
    )
    
    parser.add_argument(
        '-c', '--collectinfo',
        required=True,
        help='Path to the collectinfo file or directory'
    )
    
    parser.add_argument(
        '-o', '--output',
        default='.',
        help='Target directory for the health report (default: current directory)'
    )
    
    parser.add_argument(
        '--web-output',
        action='store_true',
        help='Generate JSON output for web application'
    )
    
    return parser.parse_args()

def validate_paths(collectinfo_path, output_path):
    """Validate input and output paths."""
    # Check if collectinfo path exists
    if not os.path.exists(collectinfo_path):
        print(f"Error: Collectinfo path does not exist: {collectinfo_path}")
        sys.exit(1)
    
    # Check if output directory exists, create if it doesn't
    if not os.path.exists(output_path):
        try:
            os.makedirs(output_path)
            print(f"Created output directory: {output_path}")
        except OSError as e:
            print(f"Error: Cannot create output directory {output_path}: {e}")
            sys.exit(1)
    elif not os.path.isdir(output_path):
        print(f"Error: Output path is not a directory: {output_path}")
        sys.exit(1)

def show_progress_bar(current, total, width=50):
    """Display a progress bar."""
    progress = int(width * current / total)
    bar = '█' * progress + '░' * (width - progress)
    percentage = current / total * 100
    print(f'\rProgress: [{bar}] {percentage:.1f}% ({current}/{total})', end='', flush=True)

def show_processing_bar(width=50):
    """Display a processing bar that shows the script is working."""
    bar = '█' * width
    print(f'\rProcessing: [{bar}] Running health checks...', end='', flush=True)

# Define the list of commands to run via asadm on collectinfo
# Critical commands (important metrics)
critical_commands = [
    # Internal Health Check - Most Important
    "health",
    "health -v",
    
    # Cluster Summary
    "summary -l",
    "summary",
    
    # Critical Performance Metrics
    "show stat like client_write client_proxy busy sprig cache_read_pct compression client_read_timeout client_write_timeout evicted_objects stop_write -flip",
    "show stat like dead unav re_repl busy big lost -flip",
    "show stat like heap_efficiency_pct -flip",
    
    # Critical Configuration
    "show config like proto-fd-max -flip",
    "show config like min-cluster-size conflict-resolution-policy -flip",
    "show config like prefer-uniform-balance read-page-cache -flip",
    
    # Best Practices
    "show best-practices",
    
    # Latency
    "show latencies",
]

# Detailed commands (comprehensive information)
detailed_commands = [
    # General Information
    "info",
    "info network",
    "info namespace",
    "info set",
    "info sindex",
    "features",
    
    # Configuration Details
    "show config diff",
    "show config -flip",
    
    # Performance Statistics
    "show stat like batch_index_complete batch_sub_read_success batch_sub_read_not_found -flip",
    "show stat like expi master_tombstones client_delete_success -flip",
    "show stat like nsup_cycle nsup-period -flip",
    
    # Distribution Analysis
    "show distribution object_size -b",
    "show distribution time_to_live",
    
    # Namespace and Service Statistics
    "show statistics namespace like migrate_tx_partitions_initial -flip",
    "show statistics service like batch -t",
    
    # XDR Statistics
    "show statistics xdr dc",
    "show statistics xdr namespace",
    
    # System Information
    "show sindex",
    "show udfs",
    "show racks",
    "show roster",
    "show stop-writes",
    "show jobs",
    "show users",
    "show users stat"
]

def parse_health_check_output(output_text):
    """Parse health check output and extract structured data."""
    data = {
        'timestamp': datetime.now().isoformat(),
        'health_status': {},
        'cluster_summary': {},
        'performance_metrics': {},
        'configuration': {},
        'issues': [],
        'warnings': []
    }
    
    # Parse health status
    health_match = re.search(r'health\s*:\s*(.+)', output_text, re.IGNORECASE)
    if health_match:
        data['health_status']['overall'] = health_match.group(1).strip()
    
    # Parse cluster summary
    summary_match = re.search(r'Number of nodes\s*:\s*(\d+)', output_text)
    if summary_match:
        data['cluster_summary']['node_count'] = int(summary_match.group(1))
    
    # Parse performance metrics
    metrics_patterns = {
        'client_proxy': r'client_proxy\s+(\d+)',
        'cache_read_pct': r'cache_read_pct\s+([\d.]+)',
        'evicted_objects': r'evicted_objects\s+(\d+)',
        'stop_write': r'stop_write\s+(\d+)'
    }
    
    for metric, pattern in metrics_patterns.items():
        match = re.search(pattern, output_text)
        if match:
            data['performance_metrics'][metric] = match.group(1)
    
    # Parse issues and warnings
    lines = output_text.split('\n')
    for line in lines:
        if 'ERROR' in line.upper():
            data['issues'].append(line.strip())
        elif 'WARNING' in line.upper():
            data['warnings'].append(line.strip())
    
    return data

def execute_commands_and_generate_reports(collectinfo_path, output_path, timestamp, args):
    """Execute commands and generate both critical and detailed reports."""
    
    # Generate critical report
    critical_command_string = "; ".join(critical_commands)
    critical_asadm_command = ['asadm', '-c', '-f', collectinfo_path, '-e', critical_command_string]
    
    critical_filename = f"aerospike_critical_report_{timestamp}.txt"
    critical_path = os.path.join(output_path, critical_filename)
    
    print("Generating critical health report...")
    show_processing_bar()
    
    with open(critical_path, 'w') as critical_file:
        critical_file.write("=" * 80 + "\n")
        critical_file.write("AEROSPIKE CRITICAL HEALTH REPORT\n")
        critical_file.write("=" * 80 + "\n")
        critical_file.write(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        critical_file.write(f"Collectinfo path: {collectinfo_path}\n")
        critical_file.write("=" * 80 + "\n\n")
        
        process = subprocess.Popen(
            critical_asadm_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            universal_newlines=True
        )
        
        stdout, stderr = process.communicate()
        critical_file.write(stdout)
        if stderr:
            critical_file.write(f"\n\nWARNINGS/ERRORS:\n{stderr}")
    
    print()  # Clear progress bar
    
    # Generate detailed report
    detailed_command_string = "; ".join(detailed_commands)
    detailed_asadm_command = ['asadm', '-c', '-f', collectinfo_path, '-e', detailed_command_string]
    
    detailed_filename = f"aerospike_detailed_report_{timestamp}.txt"
    detailed_path = os.path.join(output_path, detailed_filename)
    
    print("Generating detailed health report...")
    show_processing_bar()
    
    with open(detailed_path, 'w') as detailed_file:
        detailed_file.write("=" * 80 + "\n")
        detailed_file.write("AEROSPIKE DETAILED HEALTH REPORT\n")
        detailed_file.write("=" * 80 + "\n")
        detailed_file.write(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        detailed_file.write(f"Collectinfo path: {collectinfo_path}\n")
        detailed_file.write("=" * 80 + "\n\n")
        
        process = subprocess.Popen(
            detailed_asadm_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            universal_newlines=True
        )
        
        stdout, stderr = process.communicate()
        detailed_file.write(stdout)
        if stderr:
            detailed_file.write(f"\n\nWARNINGS/ERRORS:\n{stderr}")
    
    print()  # Clear progress bar
    
    return critical_path, detailed_path, stdout + stderr

def main():
    """Main function to run the health check."""
    args = parse_arguments()
    
    # Validate paths
    validate_paths(args.collectinfo, args.output)
    
    # Generate timestamp for unique filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Print initial status
    print("=" * 60)
    print("AEROSPIKE HEALTH CHECK")
    print("=" * 60)
    print(f"Collectinfo path: {args.collectinfo}")
    print(f"Output directory: {args.output}")
    print("=" * 60)
    
    try:
        # Execute commands and generate reports
        critical_path, detailed_path, output_text = execute_commands_and_generate_reports(
            args.collectinfo, args.output, timestamp, args
        )
        
        # Generate JSON output for web application if requested
        if args.web_output:
            json_filename = f"aerospike_health_data_{timestamp}.json"
            json_path = os.path.join(args.output, json_filename)
            
            print("Generating JSON data for web application...")
            parsed_data = parse_health_check_output(output_text)
            
            with open(json_path, 'w') as json_file:
                json.dump(parsed_data, json_file, indent=2)
            
            print(f"📊 JSON data saved to: {json_path}")
        
        print(f"\n✅ Health check completed successfully!")
        print(f"🚨 Critical report: {critical_path}")
        print(f"📋 Detailed report: {detailed_path}")
        if args.web_output:
            print(f"🌐 Web data: {json_path}")
            
    except FileNotFoundError:
        print(f"❌ Error: 'asadm' command not found. Please ensure asadm is installed and in your PATH.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error executing health check: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()