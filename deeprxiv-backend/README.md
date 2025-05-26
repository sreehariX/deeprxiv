# DeepRxiv Backend

A FastAPI-based backend service for processing and analyzing arXiv papers with RAG (Retrieval-Augmented Generation) capabilities.

## Features

- **Paper Processing**: Extract and process PDF papers from arXiv URLs
- **Vector Search**: Index paper content using Google's text-embedding-004 model
- **RAG Chatbot**: Query paper content using Perplexity AI for text generation
- **Metadata Extraction**: Extract titles, authors, abstracts, and structured sections
- **Image Processing**: Extract and serve images from research papers

## API Architecture

### Language Models
- **Embeddings**: Google's text-embedding-004 model (only Google service used)
- **Text Generation**: Perplexity AI (llama-3.1-sonar-large-128k-online)
- **Vector Database**: ChromaDB for similarity search

### Key Services
- **LLMService**: Handles all text generation tasks via Perplexity API
- **PDFProcessor**: Extracts text and images from PDF files
- **Vector Search**: Semantic search using Google embeddings + ChromaDB

## API Endpoints

### Paper Processing
- `POST /api/process` - Process arXiv paper from URL
- `GET /api/paper/{arxiv_id}` - Get paper details
- `GET /api/papers` - List all processed papers
- `GET /api/paper/{arxiv_id}/status` - Check processing status

### RAG Chatbot
- `POST /api/query` - Query paper content using RAG
- `POST /api/test-embedding` - Test embedding functionality
- `POST /api/test-perplexity` - Test Perplexity model

### Images
- `GET /api/images/{arxiv_id}` - Get paper images
- `GET /api/image/{image_id}` - Get specific image

## Environment Variables

```env
PERPLEXITY_API_KEY=your_perplexity_api_key
GEMINI_API_KEY=your_google_api_key  # Only used for embeddings
```

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables in `.env.local`

3. Run the server:
```bash
python main.py
# or
uvicorn main:app --reload
```

## Usage

1. **Process a paper**: Send arXiv URL to `/api/process`
2. **Query the paper**: Use `/api/query` with your question
3. **Get structured content**: Access sections and metadata via `/api/paper/{arxiv_id}`

The system will:
- Download and extract text from the PDF
- Generate embeddings using Google's model
- Create structured sections using Perplexity
- Enable semantic search and Q&A capabilities

## Architecture Notes

- **Embeddings**: Google's text-embedding-004 provides high-quality vector representations
- **Text Generation**: Perplexity AI handles all LLM tasks (metadata extraction, section generation, Q&A)
- **Hybrid Approach**: Combines Google's embedding strength with Perplexity's reasoning capabilities
- **Vector Storage**: ChromaDB provides efficient similarity search with cosine distance

## New Features

### RAG Chatbot System
- **Semantic Search**: Query papers using natural language
- **AI-Powered Responses**: Get intelligent answers about paper content
- **Section-Aware Search**: Search through sections and subsections
- **Source Attribution**: See exactly which parts of the paper inform each answer

### Google GenAI Integration
- **Upgraded SDK**: Now using the latest `google-genai` SDK
- **Gemini 2.0 Flash**: Primary LLM for content generation
- **Text Embeddings**: High-quality embeddings using `text-embedding-004`
- **Automatic Fallback**: Falls back to Perplexity if needed

### Direct URL Access
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
- `GET /api/papers` - List all papers
- `GET /api/images/{arxiv_id}` - Get paper images
- `GET /api/image/{image_id}` - Serve specific image
- `GET /api` - Health check

### RAG Chatbot Endpoints
- `GET /api/papers/{arxiv_id}/collection-stats` - Get vector collection statistics

### Query Endpoint Example
```bash
curl -X POST "http://localhost:8000/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the main contribution of this paper?",
    "arxiv_id": "1706.03762",
    "top_n": 5
  }'
```

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
# Create .env.local file with the following:
GEMINI_API_KEY=your_google_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key
```

3. Get API Keys:
   - **Gemini API Key**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - **Perplexity API Key**: Get from [Perplexity API](https://www.perplexity.ai/settings/api) (optional, used as fallback)

4. Run the server:
```bash
python run.py
```

The server will start on `http://127.0.0.1:8000`

## How It Works

### Paper Processing Pipeline
1. **PDF Download**: Fetch PDF from arXiv
2. **Content Extraction**: Extract text and images using PyMuPDF
3. **Metadata Generation**: Extract title, authors, abstract using Gemini
4. **Section Generation**: Create educational sections using AI
5. **Vector Indexing**: Index content chunks in ChromaDB for search
6. **Frontend Generation**: Create Next.js page structure

### RAG Chatbot System
1. **Content Chunking**: Split papers into ~2000 token chunks
2. **Embedding Generation**: Create vectors using Google's text-embedding-004
3. **Vector Storage**: Store in ChromaDB with metadata
4. **Query Processing**: Convert questions to embeddings
5. **Semantic Search**: Find relevant content chunks
6. **AI Response**: Generate answers using Gemini with context

## Recent Improvements

### Google GenAI SDK Upgrade
- Migrated from `google-generativeai` to `google-genai`
- Updated all embedding and generation calls
- Added proper error handling and fallbacks
- Compatible with Gemini 2.0 models

### RAG Implementation
- Automatic content indexing after section creation
- Token-aware chunking for optimal search
- Metadata-rich search results
- Source attribution with page numbers

### JSON Parsing Robustness
- Enhanced JSON sanitization for LLM responses
- Multiple fallback parsing strategies
- Automatic handling of escape sequence issues
- Debug file generation for troubleshooting

## Dependencies

- FastAPI - Web framework
- SQLAlchemy - Database ORM  
- PyMuPDF - PDF processing
- Requests - HTTP client
- google-genai - Google AI/Gemini SDK
- chromadb - Vector database
- uuid - Unique identifiers
- Perplexity API - LLM fallback services

## Environment Variables

Create a `.env.local` file with:

```env
# Required
GEMINI_API_KEY=your_google_api_key

# Optional (fallback)
PERPLEXITY_API_KEY=your_perplexity_api_key

# Database
DATABASE_URL=sqlite:///./deeprxiv.db
``` 