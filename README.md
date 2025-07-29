# Aerospike Health Check Dashboard

A comprehensive web application for analyzing Aerospike cluster health using collectinfo files and AI-powered data parsing.

## Features

- **File Upload**: Upload collectinfo files (tar, zip, or no extension)
- **AI-Powered Parsing**: Uses OpenAI GPT-4 to intelligently parse asadm command outputs
- **Comprehensive Analysis**: Processes 15+ asadm commands for complete cluster insights
- **Real-time Dashboard**: Beautiful, responsive UI with collapsible sections
- **Data Persistence**: Stores results in Aerospike database
- **Debug Tools**: Built-in debugging and management features

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js (for frontend)
- Python 3.8+ (for backend)
- asadm (Aerospike Administration Tool)
- OpenAI API key

### 1. Clone and Setup

```bash
git clone <repository-url>
cd automateHealthcheck
```

### 2. Configure Environment

```bash
# Copy environment file
cp backend/.env.example backend/.env

# Edit the file and add your OpenAI API key
nano backend/.env
```

### 3. Run the Application

```bash
# Start all services
./run.sh
```

This will:
- Start Aerospike database in Docker
- Start Python backend API
- Start React frontend
- Open the application at http://localhost:3001

### 4. Set OpenAI API Key

1. Click "Set OpenAI Key" button in the UI, OR
2. Edit `backend/.env` file directly

### 5. Upload and Analyze

1. Upload a collectinfo file
2. Wait for processing (all asadm commands + AI parsing)
3. View comprehensive cluster analysis

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Aerospike     │
│   (React)       │◄──►│   (FastAPI)     │◄──►│   (Database)    │
│   Port: 3001    │    │   Port: 8000    │    │   Port: 3000    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   OpenAI API    │
                       │   (GPT-4)       │
                       └─────────────────┘
```

## Data Flow

1. **Upload**: User uploads collectinfo file
2. **Extraction**: Backend extracts archive if needed
3. **Command Execution**: Runs 15+ asadm commands
4. **AI Processing**: Sends combined output to OpenAI
5. **Structured Data**: Receives parsed JSON from AI
6. **Storage**: Saves to Aerospike database
7. **Display**: Frontend renders comprehensive dashboard

## API Endpoints

- `POST /upload` - Upload and process files
- `GET /reports` - Get all parsed reports
- `POST /set-openai-key` - Set OpenAI API key
- `DELETE /clear-db` - Clear database
- `DELETE /clear-logs` - Clear logs
- `GET /health` - Health check

## Development

### Backend Development

```bash
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Docker Services

```bash
# Start only Aerospike
docker-compose up -d

# View logs
docker-compose logs -f
```

## Configuration

### Environment Variables

See `backend/.env.example` for all available options:

- `OPENAI_API_KEY` - Your OpenAI API key
- `AEROSPIKE_HOST` - Aerospike host (default: localhost)
- `AEROSPIKE_PORT` - Aerospike port (default: 3000)
- `AEROSPIKE_NAMESPACE` - Database namespace (default: test)

## Troubleshooting

### Common Issues

1. **"OpenAI API key not configured"**
   - Set your API key in `backend/.env` or via UI

2. **"asadm not available"**
   - Install asadm: `pip install aerospike-tools`

3. **"Aerospike connection failed"**
   - Ensure Docker is running
   - Check `docker-compose ps`

4. **"Port already in use"**
   - Stop existing services: `./run.sh` (Ctrl+C)
   - Or change ports in configuration

### Logs

- Backend logs: `backend/logs/backend.log`
- Frontend logs: Browser console
- Docker logs: `docker-compose logs`

## License

[Add your license here] 