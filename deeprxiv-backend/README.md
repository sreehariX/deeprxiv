# DeepRxiv Backend

This is the backend service for DeepRxiv, an application for exploring and understanding research papers from arXiv.

## Features

- Processing and analyzing arXiv papers
- Extracting text and images from PDFs
- Using Perplexity AI for content analysis and summarization
- Serving paper data to the frontend

## Setup

1. Clone the repository
2. Create a virtual environment: `python -m venv venv`
3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Unix/MacOS: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Create a `.env.local` file with the following variables:
   ```
   # Perplexity API key (required for LLM features)
   # Get it from: https://www.perplexity.ai
   PERPLEXITY_API_KEY=your_perplexity_api_key_here
   ```

## Running the backend

To run the backend service:

```bash
python main.py
```

The service will start at `http://127.0.0.1:8000`.

## API Endpoints

- `POST /api/process`: Process an arXiv URL and extract paper content
- `GET /api/paper/{arxiv_id}`: Get paper details by arXiv ID
- `GET /api/papers`: List all processed papers
- `GET /api/paper/{arxiv_id}/status`: Get the processing status of a paper
- `GET /api/images/{arxiv_id}`: Get all images for a specific paper
- `GET /api/image/{image_id}`: Serve an extracted image by ID 