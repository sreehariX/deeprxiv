# DeepRxiv Backend

A FastAPI backend service for processing arXiv papers with AI-powered analysis.

## Features

- **PDF Processing**: Extract text and images from arXiv PDFs
- **AI-Powered Analysis**: Generate structured sections and metadata using LLM services
- **Auto-Processing**: Automatically process papers when accessed via direct URLs
- **Image Extraction**: Extract and serve figures and diagrams from papers
- **RESTful API**: Clean API endpoints for frontend integration

## New Feature: Direct URL Access

You can now directly access papers by navigating to:
```
http://localhost:3000/abs/{arxiv_id}
```

For example:
- `http://localhost:3000/abs/2412.17364` - New paper on text embedding models
- `http://localhost:3000/abs/1706.03762` - Attention Is All You Need

**How it works:**
1. If the paper exists in the database → Shows the paper immediately
2. If the paper doesn't exist → Automatically starts processing and shows progress
3. If auto-processing fails → Redirects to home page with URL pre-filled

This makes it easy to share direct links to papers and ensures they get processed automatically!

## API Endpoints

### Core Endpoints
- `POST /api/process` - Process an arXiv URL
- `GET /api/paper/{arxiv_id}` - Get paper details
- `GET /api/paper/{arxiv_id}/status` - Get processing status
- `GET /api/papers` - List all papers
- `GET /api/images/{arxiv_id}` - Get paper images
- `GET /api/image/{image_id}` - Serve specific image
- `GET /api` - Health check

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
# Create .env.local file
PERPLEXITY_API_KEY=your_api_key_here
```

3. Run the server:
```bash
python run.py
```

The server will start on `http://127.0.0.1:8000`

## Recent Improvements

### JSON Parsing Robustness
- Enhanced JSON sanitization for LLM responses
- Multiple fallback parsing strategies
- Automatic handling of escape sequence issues
- Debug file generation for troubleshooting

### Auto-Processing Feature
- Direct URL access to papers
- Automatic processing initiation
- Graceful fallback to home page
- Real-time processing status updates

## Dependencies

- FastAPI - Web framework
- SQLAlchemy - Database ORM  
- PyMuPDF - PDF processing
- Requests - HTTP client
- Perplexity API - LLM services 