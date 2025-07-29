# Aerospike Health Check Backend

This backend service processes Aerospike collectinfo files using asadm commands and OpenAI API for intelligent data parsing.

## Setup

### 1. Environment Variables

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-actual-openai-api-key-here

# Aerospike Configuration (optional overrides)
AEROSPIKE_HOST=localhost
AEROSPIKE_PORT=3000
AEROSPIKE_NAMESPACE=test
```

### 2. Install Dependencies

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Prerequisites

- **asadm**: Aerospike Administration Tool must be installed and available in PATH
- **Aerospike Server**: Running on localhost:3000 (or configure in .env)
- **OpenAI API Key**: Valid API key for GPT-4 access

### 4. Run the Backend

```bash
# Activate virtual environment
source venv/bin/activate

# Start the server
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

- `POST /upload` - Upload and process collectinfo files
- `GET /reports` - Get all parsed reports
- `POST /set-openai-key` - Set OpenAI API key dynamically
- `DELETE /clear-db` - Clear Aerospike database
- `DELETE /clear-logs` - Clear log files
- `GET /health` - Health check
- `GET /debug/files` - Debug extracted files

## Data Flow

1. **Upload**: Collectinfo file uploaded via `/upload`
2. **Processing**: All asadm commands executed against the file
3. **AI Parsing**: Combined outputs sent to OpenAI GPT-4 for structured parsing
4. **Storage**: Results stored in Aerospike database
5. **Retrieval**: Structured data available via `/reports`

## Logs

Logs are written to `logs/backend.log` and cleared on each restart. 