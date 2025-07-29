# Aerospike Health Dashboard

A professional web-based dashboard for visualizing Aerospike health check results with interactive charts, status indicators, and detailed analysis.

## Features

- **Dashboard Overview**: Key metrics and health status at a glance
- **Cluster Health**: Detailed health check results with collapsible sections
- **Performance Metrics**: Latency, throughput, and cache performance visualization
- **Configuration Analysis**: Best practices and configuration recommendations
- **System Information**: Namespaces, sets, indexes, and system details
- **XDR Status**: Cross-datacenter replication monitoring
- **Detailed Logs**: Raw command outputs and logs viewer

## Prerequisites

- Node.js 18+ and npm
- Python 3.7+ (for health check script)
- Aerospike tools (asadm)

## Installation

### 1. Install Dependencies

```bash
cd aerospike-health-dashboard
npm install
```

### 2. Run the Health Check Script

First, run the health check script to generate data:

```bash
# From the parent directory
python auto-health-check.py --collectinfo /path/to/your/collectinfo --web-output
```

This will generate:
- `aerospike_critical_report_YYYYMMDD_HHMMSS.txt` - Critical metrics
- `aerospike_detailed_report_YYYYMMDD_HHMMSS.txt` - Detailed information
- `aerospike_health_data_YYYYMMDD_HHMMSS.json` - JSON data for web app

### 3. Start the Web Application

```bash
npm run dev
```

The dashboard will open at `http://localhost:3000`

## Usage

### Navigation

- **Dashboard**: Overview with key metrics and charts
- **Cluster Health**: Detailed health check results
- **Performance**: Performance metrics and trends
- **Configuration**: Configuration analysis and recommendations
- **System Info**: System details and statistics
- **XDR Status**: Cross-datacenter replication status
- **Logs**: Raw command outputs

### Features

- **Interactive Charts**: Performance trends and cache statistics
- **Status Indicators**: Color-coded health status (green/yellow/red)
- **Collapsible Sections**: Expandable content for better organization
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Live data refresh capabilities

## Project Structure

```
aerospike-health-dashboard/
├── index.html
├── src/
│   ├── components/
│   │   ├── Sidebar.js
│   │   ├── MetricCard.js
│   │   ├── StatusCard.js
│   │   └── Chart.js
│   ├── pages/
│   │   ├── Dashboard.js
│   │   ├── ClusterHealth.js
│   │   ├── Performance.js
│   │   ├── Configuration.js
│   │   ├── SystemInfo.js
│   │   ├── XDRStatus.js
│   │   └── Logs.js
│   ├── App.js
│   ├── index.js
│   └── index.css
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Technology Stack

- **React 18** - UI framework
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Chart library
- **Lucide React** - Icon library
- **React Router** - Client-side routing

## Customization

### Adding New Metrics

1. Update the health check script to include new commands
2. Modify the JSON parsing in `parse_health_check_output()`
3. Add new components or update existing ones

### Styling

The application uses Tailwind CSS for styling. Custom styles can be added in:
- `src/index.css` for global styles
- `tailwind.config.js` for theme customization

### Data Integration

To integrate with real-time data:
1. Set up an API endpoint to serve health check data
2. Update the data fetching logic in components
3. Implement real-time updates using WebSocket or polling

## Security

✅ **All vulnerabilities fixed** - The application uses the latest secure dependencies:
- Vite 7.0.6 (latest)
- React 18.2.0
- All dependencies updated to secure versions

## Performance

- **Fast Development**: Vite provides instant hot module replacement
- **Optimized Build**: Production builds are optimized and minified
- **Tree Shaking**: Unused code is automatically removed
- **Modern ES Modules**: Better performance and smaller bundle sizes

## Troubleshooting

### Common Issues

1. **Health check script fails**: Ensure asadm is installed and in PATH
2. **Dashboard shows no data**: Check that JSON file is generated and accessible
3. **Charts not rendering**: Verify Recharts is properly installed

### Performance

- Large health check files may take time to load
- Consider implementing pagination for detailed logs
- Use lazy loading for non-critical components

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. 