import os
import json
import requests
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import re
from io import BytesIO
import sqlite3
import sqlalchemy
from datetime import datetime
from dotenv import load_dotenv
import threading
import chromadb
from google import genai
import uuid
from google.genai.types import EmbedContentConfig

# Load environment variables
load_dotenv('.env.local')

from database import get_db, Paper, create_tables
from pdf_processor import PDFProcessor
from llm_service import LLMService

# Register SQLite JSON adapter for better JSON handling
sqlite3.register_adapter(dict, json.dumps)
sqlite3.register_adapter(list, json.dumps)
sqlite3.register_converter("JSON", json.loads)

# Create FastAPI app
app = FastAPI(title="DeepRxiv API", description="API for processing arXiv papers")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
pdf_processor = PDFProcessor()
llm_service = LLMService()

# Initialize Google GenAI client for embeddings only and ChromaDB
embedding_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
chroma_client = chromadb.PersistentClient(path="deeprxiv_chroma_db")

# Create database tables
create_tables()

# Path to frontend directory - use absolute path (replace with actual path)
# Get current directory and navigate to frontend
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
FRONTEND_PATH = os.path.join(parent_dir, "deeprxiv-frontend")
print(f"Frontend path is set to: {FRONTEND_PATH}")

# Pydantic models for request/response
class ArxivURLRequest(BaseModel):
    url: str

class PaperResponse(BaseModel):
    arxiv_id: str
    title: Optional[str] = None
    authors: Optional[str] = None
    abstract: Optional[str] = None
    processed: bool

class PaperDetailResponse(BaseModel):
    id: int
    arxiv_id: str
    title: Optional[str] = None
    authors: Optional[str] = None
    abstract: Optional[str] = None
    pdf_url: Optional[str] = None
    extracted_text: Optional[str] = None
    images: Optional[List[dict]] = None
    sections: Optional[List[dict]] = None
    processed: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class PaperStatusResponse(BaseModel):
    arxiv_id: str
    processed: bool
    progress: Optional[str] = None

# RAG Chatbot Models
class QueryRequest(BaseModel):
    query: str
    arxiv_id: str
    top_n: int = 5
    content_chunks: int = 3  # Number of raw content chunks to return
    section_chunks: int = 3  # Number of section/subsection chunks to return

class EmbeddingRequest(BaseModel):
    text: str

class TestPerplexityRequest(BaseModel):
    prompt: str = "How does RLHF work?"

# Track progress for each paper
paper_processing_status = {}

def get_embedding(text: str, title="DeepRxiv Paper"):
    """Generate embeddings using Google's text-embedding-004 model."""
    response = embedding_client.models.embed_content(
        model="models/text-embedding-004",
        contents=text,
        config=EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=768,
            title=title,
        ),
    )
    return response.embeddings[0].values

def split_content_by_tokens(content, max_tokens=2000, chars_per_token=4):
    """Fast and reliable content chunking by character count."""
    # Normalize newlines to spaces and remove multiple spaces
    normalized_content = content.replace('\n', ' ').replace('\r', ' ')
    normalized_content = ' '.join(normalized_content.split())
    
    max_chars = max_tokens * chars_per_token
    
    # Quick return if content fits in one chunk
    if len(normalized_content) <= max_chars:
        return [normalized_content]
    
    chunks = []
    start = 0
    
    while start < len(normalized_content):
        # Determine end position of this chunk
        end = min(start + max_chars, len(normalized_content))
        
        # If we're not at the end of the content, find last space
        if end < len(normalized_content):
            # Look for the last space within the chunk
            last_space = normalized_content.rfind(' ', start, end)
            
            if last_space != -1:  # If we found a space
                end = last_space  # Cut at the space
            # If no space found (very rare for large chunks), we'd cut at max_chars
        
        # Add the chunk and move to next position
        chunks.append(normalized_content[start:end])
        start = end + 1  # Skip the space
    
    return chunks

def index_paper_content(arxiv_id: str, content: str, sections: List[dict] = None):
    """Index paper content and sections in ChromaDB."""
    try:
        collection = chroma_client.get_or_create_collection(
            name=f"paper_{arxiv_id}",
            metadata={"hnsw:space": "cosine"}
        )
        
        documents = []
        embeddings = []
        metadatas = []
        ids_list = []
        
        # Index main content chunks with better page estimation
        content_chunks = split_content_by_tokens(content)
        chars_per_page = len(content) / max(20, 1)  # Estimate chars per page, assume at least 20 pages
        
        for i, chunk in enumerate(content_chunks):
            try:
                embedding = get_embedding(chunk, title=f"Paper {arxiv_id}")
                documents.append(chunk)
                embeddings.append(embedding)
                
                # Estimate page number based on character position
                chunk_start_pos = sum(len(content_chunks[j]) for j in range(i))
                estimated_page = max(1, int(chunk_start_pos / chars_per_page) + 1)
                
                metadatas.append({
                    'type': 'content',
                    'chunk_index': str(i),
                    'total_chunks': str(len(content_chunks)),
                    'estimated_page': str(estimated_page),
                    'chunk_start_pos': str(chunk_start_pos),
                    'arxiv_id': arxiv_id
                })
                ids_list.append(str(uuid.uuid4()))
                print(f"Indexed content chunk {i+1}/{len(content_chunks)} for paper {arxiv_id} (est. page {estimated_page})")
            except Exception as e:
                print(f"Error indexing content chunk {i+1}: {str(e)}")
        
        # Index sections if available
        if sections:
            for section in sections:
                try:
                    section_content = section.get('content', '')
                    if section_content:
                        section_chunks = split_content_by_tokens(section_content)
                        for i, chunk in enumerate(section_chunks):
                            try:
                                embedding = get_embedding(chunk, title=f"Paper {arxiv_id} - {section.get('title', 'Section')}")
                                documents.append(chunk)
                                embeddings.append(embedding)
                                metadatas.append({
                                    'type': 'section',
                                    'section_id': section.get('id', ''),
                                    'section_title': section.get('title', ''),
                                    'chunk_index': str(i),
                                    'total_chunks': str(len(section_chunks)),
                                    'page_number': str(section.get('page_number', '')),
                                    'arxiv_id': arxiv_id
                                })
                                ids_list.append(str(uuid.uuid4()))
                                print(f"Indexed section '{section.get('title', 'Unknown')}' chunk {i+1}/{len(section_chunks)}")
                            except Exception as e:
                                print(f"Error indexing section chunk: {str(e)}")
                        
                        # Index subsections
                        for subsection in section.get('subsections', []):
                            subsection_content = subsection.get('content', '')
                            if subsection_content:
                                subsection_chunks = split_content_by_tokens(subsection_content)
                                for i, chunk in enumerate(subsection_chunks):
                                    try:
                                        embedding = get_embedding(chunk, title=f"Paper {arxiv_id} - {subsection.get('title', 'Subsection')}")
                                        documents.append(chunk)
                                        embeddings.append(embedding)
                                        metadatas.append({
                                            'type': 'subsection',
                                            'section_id': section.get('id', ''),
                                            'section_title': section.get('title', ''),
                                            'subsection_id': subsection.get('id', ''),
                                            'subsection_title': subsection.get('title', ''),
                                            'chunk_index': str(i),
                                            'total_chunks': str(len(subsection_chunks)),
                                            'page_number': str(subsection.get('page_number', '')),
                                            'arxiv_id': arxiv_id
                                        })
                                        ids_list.append(str(uuid.uuid4()))
                                        print(f"Indexed subsection '{subsection.get('title', 'Unknown')}' chunk {i+1}/{len(subsection_chunks)}")
                                    except Exception as e:
                                        print(f"Error indexing subsection chunk: {str(e)}")
                except Exception as e:
                    print(f"Error processing section: {str(e)}")
        
        # Upsert all documents to ChromaDB
        if documents:
            collection.upsert(
                ids=ids_list,
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas
            )
            print(f"Successfully indexed {len(documents)} chunks for paper {arxiv_id}")
        
    except Exception as e:
        print(f"Error indexing paper {arxiv_id}: {str(e)}")
        import traceback
        traceback.print_exc()

@app.get("/")
def read_root():
    return {"message": "Welcome to DeepRxiv API"}

@app.post("/api/process", response_model=PaperResponse)
async def process_arxiv_url(request: ArxivURLRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Process an arXiv URL and extract paper content."""
    url = request.url
    
    # Extract arXiv ID
    arxiv_id = pdf_processor.extract_arxiv_id(url)
    if not arxiv_id:
        raise HTTPException(status_code=400, detail="Invalid arXiv URL format")
    
    # Check if paper already exists in database
    existing_paper = db.query(Paper).filter(Paper.arxiv_id == arxiv_id).first()
    if existing_paper:
        return PaperResponse(
            arxiv_id=existing_paper.arxiv_id,
            title=existing_paper.title,
            authors=existing_paper.authors,
            abstract=existing_paper.abstract,
            processed=existing_paper.processed
        )
    
    # Determine PDF URL
    pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
    
    try:
        # Download PDF
        response = requests.get(pdf_url)
        response.raise_for_status()
        pdf_data = response.content
        
        # Create new paper record
        new_paper = Paper(
            arxiv_id=arxiv_id,
            pdf_url=pdf_url,
            pdf_data=pdf_data,
            processed=False
        )
        
        db.add(new_paper)
        db.commit()
        db.refresh(new_paper)
        
        # Start processing in background thread
        background_tasks.add_task(process_paper, arxiv_id, None)
        
        return PaperResponse(
            arxiv_id=new_paper.arxiv_id,
            title=new_paper.title,
            authors=new_paper.authors,
            abstract=new_paper.abstract,
            processed=new_paper.processed
        )
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing paper: {str(e)}")

def process_paper(arxiv_id: str, db: Session = None):
    """Process a paper and update the database."""
    # Import database modules locally to ensure they're available in this context
    from database import SessionLocal
    
    # Create a new session if one wasn't provided
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True
        
    paper = db.query(Paper).filter(Paper.arxiv_id == arxiv_id).first()
    if not paper:
        if own_session:
            db.close()
        return
    
    try:
        print(f"================ PROCESSING PAPER {arxiv_id} ================")
        # Update status
        paper_processing_status[arxiv_id] = "Extracting content from PDF"
        print(f"Status: {paper_processing_status[arxiv_id]}")
        
        # Extract content from PDF
        pdf_content = pdf_processor.process_pdf(paper.pdf_data)
        
        # Store extracted text
        paper.extracted_text = pdf_content["text"]
        print(f"Extracted text length: {len(paper.extracted_text)}")
        
        # Store extracted images as JSON
        # Ensure we're storing JSON as strings for SQLite compatibility
        extracted_images = [img for img in pdf_content["images"]]
        paper.extracted_images = json.dumps(extracted_images)
        print(f"Extracted {len(extracted_images)} images")
        
        # Save initial extraction data to database
        db.add(paper)
        db.commit()
        db.refresh(paper)
        print("Saved extracted text and images to database")
        
        # Update status
        paper_processing_status[arxiv_id] = "Extracting metadata"
        print(f"Status: {paper_processing_status[arxiv_id]}")
        
        # Get text from first 4 pages for metadata extraction
        first_pages_text = pdf_processor.extract_text_from_first_pages(paper.pdf_data, num_pages=4)
        
        # Generate metadata using Flash LLM on first pages
        print("Generating metadata using LLM...")
        metadata_json = llm_service.extract_paper_metadata_flash(first_pages_text)
        try:
            # Clean JSON response if it starts with ```json and ends with ```
            if metadata_json.startswith("```json"):
                metadata_json = metadata_json.replace("```json", "", 1)
                if metadata_json.endswith("```"):
                    metadata_json = metadata_json[:-3]
                metadata_json = metadata_json.strip()
            
            print(f"Raw metadata JSON: {metadata_json}")
            
            # Parse JSON
            metadata = json.loads(metadata_json)
            
            # Update paper with extracted metadata
            if "Title" in metadata:
                paper.title = metadata.get("Title", "")
            elif "title" in metadata:
                paper.title = metadata.get("title", "")
                
            authors_field = None
            if "Authors" in metadata:
                authors_field = "Authors"
            elif "authors" in metadata:
                authors_field = "authors"
                
            if authors_field and isinstance(metadata.get(authors_field), list):
                paper.authors = ", ".join(metadata.get(authors_field, []))
            elif authors_field:
                paper.authors = metadata.get(authors_field, "")
                
            if "Abstract" in metadata:
                paper.abstract = metadata.get("Abstract", "")
            elif "abstract" in metadata:
                paper.abstract = metadata.get("abstract", "")
                
            print(f"Successfully processed metadata: Title='{paper.title}', Authors='{paper.authors}'")
            print(f"Abstract length: {len(paper.abstract) if paper.abstract else 0}")
            
            # Save metadata to database
            db.add(paper)
            db.commit()
            db.refresh(paper)
            print("Saved metadata to database")
            
        except json.JSONDecodeError as e:
            print(f"Error parsing metadata JSON: {metadata_json}")
            print(f"JSON error: {str(e)}")
            # Try to extract metadata from the raw text as a fallback
            try:
                print("Attempting fallback metadata extraction from text...")
                if "Title:" in first_pages_text or "TITLE:" in first_pages_text:
                    # Simple pattern matching as fallback
                    title_pattern = r"(?:Title|TITLE):(.*?)(?:\n|Authors|ABSTRACT)"
                    title_match = re.search(title_pattern, first_pages_text, re.DOTALL | re.IGNORECASE)
                    if title_match:
                        paper.title = title_match.group(1).strip()
                        print(f"Extracted title by regex: {paper.title}")
                    
                    authors_pattern = r"(?:Authors|AUTHOR[S]?):(.*?)(?:\n|Abstract|ABSTRACT)"
                    authors_match = re.search(authors_pattern, first_pages_text, re.DOTALL | re.IGNORECASE)
                    if authors_match:
                        paper.authors = authors_match.group(1).strip()
                        print(f"Extracted authors by regex: {paper.authors}")
                    
                    abstract_pattern = r"(?:Abstract|ABSTRACT):(.*?)(?:\n\n|\n#|Introduction|INTRODUCTION)"
                    abstract_match = re.search(abstract_pattern, first_pages_text, re.DOTALL | re.IGNORECASE)
                    if abstract_match:
                        paper.abstract = abstract_match.group(1).strip()
                        print(f"Extracted abstract by regex: {paper.abstract[:100]}...")
                        
                # Save fallback metadata to database
                db.add(paper)
                db.commit()
                db.refresh(paper)
                print("Saved fallback metadata to database")
            except Exception as fallback_error:
                print(f"Error in fallback metadata extraction: {str(fallback_error)}")
        
        # Update status
        paper_processing_status[arxiv_id] = "Generating paper sections with LLM"
        print(f"Status: {paper_processing_status[arxiv_id]}")
        
        # Generate sections data with Perplexity
        try:
            print(f"Starting LLM section generation for paper {arxiv_id}...")
            print(f"Paper text length: {len(paper.extracted_text)} characters")
            
            sections_response = llm_service.generate_paper_sections(paper.extracted_text)
            print(f"LLM section generation completed successfully")
            print(f"Response type: {type(sections_response)}")
            print(f"Response keys: {sections_response.keys() if isinstance(sections_response, dict) else 'Not a dict'}")
            
            sections = sections_response["sections"]
            citations = sections_response["citations"]
            
            print(f"LLM generated {len(sections)} sections:")
            for i, section in enumerate(sections):
                print(f"  Section {i+1}: {section['title']}")
                if 'subsections' in section and section['subsections']:
                    for j, subsection in enumerate(section['subsections']):
                        print(f"    Subsection {j+1}: {subsection['title']}")
            
            # Process each section to generate detailed content
            section_count = len(sections)
            for i, section in enumerate(sections):
                # Update status with section progress
                paper_processing_status[arxiv_id] = f"Generating content for section {i+1}/{section_count}: {section['title']}"
                print(f"Status: {paper_processing_status[arxiv_id]}")
                
                try:
                    # Generate detailed content for the main section
                    print(f"Generating content for main section: {section['title']}")
                    section_content_response = llm_service.generate_section_content(
                        paper.extracted_text,
                        section["title"],
                        section["content"]
                    )
                    section["content"] = section_content_response["content"]
                    # Add citations to the section if available
                    if "citations" in section_content_response and section_content_response["citations"]:
                        section["citations"] = section_content_response["citations"]
                    
                    print(f"Generated content for section {section['title']} ({len(section['content'])} chars)")
                except Exception as section_error:
                    print(f"Error generating content for section {section['title']}: {str(section_error)}")
                    import traceback
                    traceback.print_exc()
                    # Keep the original content if generation fails
                
                # Process subsections if they exist
                if "subsections" in section and section["subsections"]:
                    subsection_count = len(section["subsections"])
                    for j, subsection in enumerate(section["subsections"]):
                        # Update status with subsection progress
                        paper_processing_status[arxiv_id] = f"Generating content for subsection {j+1}/{subsection_count} of {section['title']}"
                        print(f"Status: {paper_processing_status[arxiv_id]}")
                        
                        try:
                            print(f"Generating content for subsection: {subsection['title']}")
                            subsection_content_response = llm_service.generate_section_content(
                                paper.extracted_text,
                                subsection["title"],
                                subsection["content"]
                            )
                            subsection["content"] = subsection_content_response["content"]
                            # Add citations to the subsection if available
                            if "citations" in subsection_content_response and subsection_content_response["citations"]:
                                subsection["citations"] = subsection_content_response["citations"]
                            
                            print(f"  Generated content for subsection {subsection['title']} ({len(subsection['content'])} chars)")
                        except Exception as subsection_error:
                            print(f"Error generating content for subsection {subsection['title']}: {str(subsection_error)}")
                            import traceback
                            traceback.print_exc()
                            # Keep the original content if generation fails
            
            # Store the sections and citations data as JSON
            sections_data_to_save = {
                "sections": sections,
                "citations": citations
            }
            
            # Debug: Log subsections info
            total_subsections = 0
            for section in sections:
                if 'subsections' in section and section['subsections']:
                    subsection_count = len(section['subsections'])
                    total_subsections += subsection_count
                    print(f"Section '{section['title']}' has {subsection_count} subsections:")
                    for i, subsection in enumerate(section['subsections']):
                        print(f"  {i+1}. {subsection.get('title', 'No title')} (ID: {subsection.get('id', 'No ID')})")
                else:
                    print(f"Section '{section['title']}' has no subsections")
            
            print(f"Total subsections across all sections: {total_subsections}")
            
            paper.sections_data = json.dumps(sections_data_to_save)
            print(f"Successfully generated {len(sections)} sections with {total_subsections} total subsections for paper {arxiv_id}")
            
            # Save sections data to database
            db.add(paper)
            db.commit()
            db.refresh(paper)
            print("Saved sections data to database")
            
        except Exception as sections_error:
            print(f"CRITICAL ERROR in LLM section generation: {str(sections_error)}")
            import traceback
            traceback.print_exc()
            
            # Create a basic structure in case of error
            basic_sections = [
                {
                    "id": "overview",
                    "title": "Overview",
                    "content": paper.abstract or "Paper overview not available.",
                    "citations": [],
                    "subsections": [
                        {
                            "id": "abstract-summary",
                            "title": "Abstract Summary",
                            "content": "This subsection provides a summary of the paper's abstract and main contributions.",
                            "citations": [],
                            "page_number": 1
                        },
                        {
                            "id": "key-findings",
                            "title": "Key Findings",
                            "content": "This subsection highlights the main findings and results presented in the paper.",
                            "citations": [],
                            "page_number": 1
                        }
                    ],
                    "page_number": 1
                }
            ]
            paper.sections_data = json.dumps({
                "sections": basic_sections,
                "citations": []
            })
            print("Created and saved basic fallback sections due to LLM error")
            # Save basic sections to database
            db.add(paper)
            db.commit()
            db.refresh(paper)
        
        # Update status
        paper_processing_status[arxiv_id] = "Creating folder structure"
        print(f"Status: {paper_processing_status[arxiv_id]}")
        
        # Set the paper as processed
        paper.processed = True
        
        # Commit the changes to the database
        db.add(paper)
        db.commit()
        db.refresh(paper)
        print(f"Paper {arxiv_id} successfully processed and saved to database")
        
        # Index paper content for RAG chatbot
        paper_processing_status[arxiv_id] = "Indexing content for search"
        print(f"Status: {paper_processing_status[arxiv_id]}")
        
        try:
            # Parse sections data for indexing
            sections_for_indexing = None
            if paper.sections_data:
                sections_data = json.loads(paper.sections_data)
                if isinstance(sections_data, dict):
                    sections_for_indexing = sections_data.get("sections", [])
                elif isinstance(sections_data, list):
                    sections_for_indexing = sections_data
            
            # Index the paper content and sections
            index_paper_content(arxiv_id, paper.extracted_text, sections_for_indexing)
            print(f"Successfully indexed paper {arxiv_id} for RAG chatbot")
        except Exception as indexing_error:
            print(f"Error indexing paper {arxiv_id}: {str(indexing_error)}")
            import traceback
            traceback.print_exc()
            # Don't fail the entire process if indexing fails
        
        # Verify data was saved
        db.refresh(paper)
        verification_data = {
            "title": paper.title,
            "authors": paper.authors,
            "abstract_length": len(paper.abstract) if paper.abstract else 0,
            "extracted_text_length": len(paper.extracted_text) if paper.extracted_text else 0,
            "sections_data_length": len(paper.sections_data) if paper.sections_data else 0,
            "processed": paper.processed
        }
        print(f"Verification - Paper data: {json.dumps(verification_data)}")
        
        # Create folder-based structure in Next.js frontend
        create_nextjs_folder_structure(paper)
        
        # Clear status
        if arxiv_id in paper_processing_status:
            del paper_processing_status[arxiv_id]
            
        print(f"================ FINISHED PROCESSING PAPER {arxiv_id} ================")
        return paper
    except Exception as e:
        print(f"Error processing paper: {str(e)}")
        import traceback
        traceback.print_exc()
        paper_processing_status[arxiv_id] = f"Error: {str(e)}"
        db.rollback()
    finally:
        # Close the session if we created it
        if own_session:
            db.close()

def create_nextjs_folder_structure(paper):
    """
    Create a folder structure in the Next.js frontend for the paper.
    This creates:
    - /app/abs/{arxiv_id}/ folder
    - README.md with paper metadata
    - page.tsx file for the paper
    """
    try:
        # Define the path to the frontend app and paper folder
        if not os.path.exists(FRONTEND_PATH):
            print(f"Frontend path not found: {FRONTEND_PATH}")
            return
        
        paper_folder = os.path.join(FRONTEND_PATH, "app", "abs", paper.arxiv_id)
        
        # Create folder if it doesn't exist
        os.makedirs(paper_folder, exist_ok=True)
        
        # Create README.md
        readme_content = f"""# {paper.title or 'Untitled Paper'}

## arXiv ID
{paper.arxiv_id}

## Authors
{paper.authors or 'No authors listed'}

## Abstract
{paper.abstract or 'No abstract available'}

## Links
- [View on arXiv](https://arxiv.org/abs/{paper.arxiv_id})
- [Download PDF](https://arxiv.org/pdf/{paper.arxiv_id}.pdf)

## Extracted Text
{paper.extracted_text[:1000] + '...' if paper.extracted_text and len(paper.extracted_text) > 1000 else paper.extracted_text or 'No extracted text available'}
"""
        with open(os.path.join(paper_folder, "README.md"), "w", encoding="utf-8") as f:
            f.write(readme_content)
        
        # Get sections data if available, or create a basic structure
        try:
            sections_data = json.loads(paper.sections_data) if paper.sections_data else {}
            
            # Handle different formats of sections_data
            if isinstance(sections_data, dict):
                # New format with sections and citations
                sections = sections_data.get("sections", [])
                citations = sections_data.get("citations", [])
            elif isinstance(sections_data, list):
                # Old format - direct list of sections
                sections = sections_data
                citations = []
            else:
                # Fallback for unexpected format
                sections = []
                citations = []
                
            # Ensure we have valid sections
            if not sections or not isinstance(sections, list):
                sections = [
                    {
                        "id": "overview",
                        "title": "Overview",
                        "content": paper.abstract or "Paper overview not available.",
                        "citations": [],
                        "subsections": []
                    }
                ]
                
            # Ensure citations is a list
            if not isinstance(citations, list):
                citations = []
                
        except (json.JSONDecodeError, TypeError, AttributeError) as e:
            print(f"Error parsing sections data: {e}")
            sections = [
                {
                    "id": "overview",
                    "title": "Overview",
                    "content": paper.abstract or "Paper overview not available.",
                    "citations": [],
                    "subsections": []
                }
            ]
            citations = []
        
        # Parse extracted images from the paper
        try:
            if isinstance(paper.extracted_images, str):
                images = json.loads(paper.extracted_images)
            else:
                images = paper.extracted_images or []
                
            # Add API URLs for each image
            for image in images:
                if 'id' in image:
                    image['url'] = f"/api/image/{image['id']}"
        except (json.JSONDecodeError, TypeError, AttributeError):
            images = []
        
        # Create a simplified page.tsx with enhanced markdown support
        # We'll avoid complex templating with f-strings
        safe_title = (paper.title or "Untitled Paper").replace("'", "\\'").replace('"', '\\"')
        safe_authors = (paper.authors or "").replace("'", "\\'").replace('"', '\\"')
        safe_abstract = (paper.abstract or "").replace("'", "\\'").replace('"', '\\"').replace("\n", " ")
        
        sections_json = json.dumps(sections).replace("'", "\\'").replace("`", "\\`")
        citations_json = json.dumps(citations).replace("'", "\\'").replace("`", "\\`")
        
        page_content = """'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Image as ImageIcon, ExternalLink, X, Play, FileText, BookOpen, Menu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Custom CSS for hiding scrollbars and responsive margins
const customStyles = `
  .scrollbar-hide {
    -ms-overflow-style: none;  /* Internet Explorer 10+ */
    scrollbar-width: none;  /* Firefox */
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;  /* Safari and Chrome */
  }
  .main-content {
    margin-left: 0;
    margin-right: 0;
  }
  @media (min-width: 768px) {
    .main-content {
      margin-left: 352px;
      margin-right: 0;
    }
  }
  @media (min-width: 1024px) {
    .main-content {
      margin-left: 416px;
      margin-right: 512px;
    }
  }
`;

// Types for better TypeScript support
interface ImageData {
  id: string;
  page: number;
  original_position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  expanded_position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  path?: string;
  url?: string;
}

interface SubSection {
  id: string;
  title: string;
  content: string;
  citations?: string[];
  page_number?: number;
}

interface Section {
  id: string;
  title: string;
  content: string;
  citations?: string[];
  page_number?: number;
  subsections?: SubSection[];
}

// Paper data
const paperData = {
  id: """ + str(paper.id or 0) + """,
  arxiv_id: '""" + paper.arxiv_id + """',
  title: '""" + safe_title + """',
  authors: '""" + safe_authors + """',
  abstract: '""" + safe_abstract + """',
  processed: true
};

// Sections data
const sectionsData: Section[] = """ + sections_json + """;
const citationsData: string[] = """ + citations_json + """;

// YouTube URL detection function
const isYouTubeUrl = (url: string): boolean => {
  return /(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/|youtube\\.com\\/embed\\/)/.test(url);
};

// Extract YouTube video ID
const getYouTubeVideoId = (url: string): string | null => {
  const match = url.match(/(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/|youtube\\.com\\/embed\\/)([^&\\n?#]+)/);
  return match ? match[1] : null;
};

// Function to remove duplicate headings from markdown content
const removeDuplicateHeading = (content: string, title: string): string => {
  if (!content || !title) return content;
  
  // Create variations of the title to match against
  const titleVariations = [
    title.trim(),
    title.trim().toLowerCase(),
    title.replace(/[^a-zA-Z0-9\\s]/g, '').trim(),
    title.replace(/[^a-zA-Z0-9\\s]/g, '').trim().toLowerCase()
  ];
  
  // Split content into lines
  const lines = content.split('\\n');
  const filteredLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this line is a heading (starts with #)
    if (line.match(/^#{1,6}\\s/)) {
      // Extract the heading text (remove # and whitespace)
      const headingText = line.replace(/^#{1,6}\\s*/, '').trim();
      const headingTextLower = headingText.toLowerCase();
              const headingTextClean = headingText.replace(/[^a-zA-Z0-9\\s]/g, '').trim();
              const headingTextCleanLower = headingTextClean.toLowerCase();
        
        // Check if this heading matches any title variation
        const isDuplicate = titleVariations.some(variation => 
          headingText === variation ||
          headingTextLower === variation ||
          headingTextClean === variation ||
          headingTextCleanLower === variation ||
          variation.includes(headingText) ||
          variation.includes(headingTextLower) ||
          headingText.includes(variation) ||
          headingTextLower.includes(variation)
        );
      
      // Skip the first heading if it's a duplicate, but keep subsequent headings
      if (isDuplicate && i < 3) {
        continue;
      }
    }
    
    filteredLines.push(lines[i]);
  }
  
  return filteredLines.join('\\n');
};

// Markdown component with math support
const MarkdownContent = ({ content, title }: { content: string; title?: string }) => {
  // Remove duplicate heading if title is provided
  const processedContent = title ? removeDuplicateHeading(content, title) : content;
  
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      className="prose prose-lg max-w-none text-gray-900 leading-relaxed"
      components={{
        // Custom styling for different elements
        h1: ({ children }) => <h1 className="text-3xl font-bold text-gray-900 mb-4">{children}</h1>,
        h2: ({ children }) => <h2 className="text-2xl font-semibold text-gray-900 mb-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-xl font-medium text-gray-900 mb-2">{children}</h3>,
        p: ({ children }) => <p className="text-black-900 mb-4 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-4 text-gray-900">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-4 text-gray-900">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 mb-4">{children}</blockquote>,
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-900">{children}</code>;
          }
          return <pre className="bg-black-100 p-4 rounded-lg overflow-x-auto mb-4"><code className="text-sm font-mono">{children}</code></pre>;
        },
        a: ({ children, href }) => <a href={href} className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
};

export default function PaperPage() {
  const [activeContent, setActiveContent] = useState('');
  const [imagesData, setImagesData] = useState<ImageData[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [selectedPdfPage, setSelectedPdfPage] = useState<number | null>(null);
  const [youtubeModal, setYoutubeModal] = useState<{ isOpen: boolean; videoId: string | null }>({
    isOpen: false,
    videoId: null
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Fetch images from API
  useEffect(() => {
    const fetchImages = async () => {
      try {
        setImagesLoading(true);
        const response = await fetch(`http://localhost:8000/api/images/${paperData.arxiv_id}`);
        if (response.ok) {
          const images = await response.json();
          setImagesData(images);
        } else {
          console.error('Failed to fetch images:', response.statusText);
          setImagesData([]);
        }
      } catch (error) {
        console.error('Error fetching images:', error);
        setImagesData([]);
      } finally {
        setImagesLoading(false);
      }
    };

    fetchImages();
  }, []);
  
  // Initialize with the first section
  useEffect(() => {
    if (sectionsData?.length > 0) {
      setActiveContent(sectionsData[0].id);
    }
  }, []);
  
  // Get current content (section or subsection)
  const getCurrentContent = () => {
    // First check if it's a main section
    const section = sectionsData?.find(section => section.id === activeContent);
    if (section) {
      return { type: 'section', content: section };
    }
    
    // Then check if it's a subsection
    for (const section of sectionsData || []) {
      const subsection = section.subsections?.find(sub => sub.id === activeContent);
      if (subsection) {
        return { type: 'subsection', content: subsection, parentSection: section };
      }
    }
    
    return null;
  };
  
  const currentContent = getCurrentContent();
  
  // Get relevant images for current content
  const getRelevantImages = (pageNumber: number | undefined): ImageData[] => {
    if (!pageNumber || !imagesData || !Array.isArray(imagesData)) return [];
    return imagesData.filter(img => img.page === pageNumber);
  };
  
  const relevantImages = getRelevantImages(currentContent?.content?.page_number);
  
  // Get citations for current content
  const getSectionCitations = (citations?: string[]): string[] => {
    if (!citations || !Array.isArray(citations)) return [];
    return citations;
  };
  
  const contentCitations = getSectionCitations(currentContent?.content?.citations);

  // Handle citation click
  const handleCitationClick = (citation: string) => {
    if (isYouTubeUrl(citation)) {
      const videoId = getYouTubeVideoId(citation);
      if (videoId) {
        setYoutubeModal({ isOpen: true, videoId });
        return;
      }
    }
    // For non-YouTube links, open in new tab
    window.open(citation, '_blank', 'noopener,noreferrer');
  };

  // Handle PDF page view - open in new tab
  const handlePdfPageView = (pageNumber: number) => {
    const pdfUrl = `https://arxiv.org/pdf/${paperData.arxiv_id}.pdf#page=${pageNumber}`;
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };



  return (
    <div className="min-h-screen flex flex-col bg-white">
      <style jsx global>{customStyles}</style>
      {/* Header */}
      <header className="bg-white sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4">
          <div className="flex items-center justify-between h-16 lg:pl-32 md:pl-16 pl-4">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center text-blue-600 hover:text-blue-700">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 lowercase">deeprxiv</h1>
              <span className="text-lg text-gray-800 font-medium truncate max-w-md lg:max-w-2xl">
                {paperData.title}
              </span>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed left-0 top-16 bottom-0 w-80 bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <nav className="space-y-1">
                {sectionsData?.map((section) => (
                  <div key={section.id} className="space-y-1">
                    <button
                      onClick={() => {
                        setActiveContent(section.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`block w-full text-left px-1 py-3 rounded-md transition-colors text-sm font-medium ${
                        activeContent === section.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <div className="truncate" title={section.title}>
                        {section.title}
                      </div>
                    </button>
                    
                    {section.subsections && section.subsections.length > 0 && (
                      <div className="ml-8 space-y-1">
                        {section.subsections.map((subsection) => (
                          <button
                            key={subsection.id}
                            onClick={() => {
                              setActiveContent(subsection.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`block w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                              activeContent === subsection.id
                                ? 'bg-blue-25 text-blue-600'
                                : 'text-gray-800 hover:bg-gray-50'
                            }`}
                          >
                            <div className="truncate" title={subsection.title}>
                              {subsection.title}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow">
        <div className="max-w-full mx-auto px-4">
          <div className="flex min-h-screen">
            {/* Left Sidebar - Navigation */}
            <aside className="w-72 bg-white flex-shrink-0 fixed top-16 bottom-0 overflow-y-auto scrollbar-hide hidden md:block md:left-16 lg:left-32">
              <div className="p-6">
                <nav className="space-y-1">
              {sectionsData?.map((section) => (
                  <div key={section.id} className="space-y-1">
                    {/* Main Section */}
                <button
                      onClick={() => setActiveContent(section.id)}
                      className={`block w-full text-left px-1 py-3 rounded-md transition-colors text-sm font-medium ${
                        activeContent === section.id
                          ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-900 hover:bg-gray-100'
                  }`}
                >
                      <div className="truncate" title={section.title}>
                  {section.title}
                      </div>
                    </button>
                    
                    {/* All Subsections */}
                    {section.subsections && section.subsections.length > 0 && (
                      <div className="ml-8 space-y-1">
                        {section.subsections.map((subsection) => (
                          <button
                            key={subsection.id}
                            onClick={() => setActiveContent(subsection.id)}
                            className={`block w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                              activeContent === subsection.id
                                ? 'bg-blue-25 text-blue-600'
                                : 'text-gray-800 hover:bg-gray-50'
                            }`}
                          >
                            <div className="truncate" title={subsection.title}>
                              {subsection.title}
                            </div>
                </button>
                        ))}
                      </div>
                    )}
                  </div>
                              ))}
                </nav>
              </div>
            </aside>

            {/* Center Content Area */}
            <div className="flex-1 bg-white px-6 py-6 overflow-y-auto main-content">
              {currentContent && (
                <>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                    {currentContent.content.title}
                  </h3>
                  
                  {/* Content - Proper Markdown rendering */}
                  <MarkdownContent content={currentContent.content.content} title={currentContent.content.title} />
                  
                  {/* Mobile PDF, Images, and Sources - Only visible on small screens */}
                  <div className="lg:hidden mt-8 space-y-6">
                    {/* PDF Section */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        PDF Original
                      </h4>
                      {currentContent?.content?.page_number ? (
                        <div className="space-y-3">
                          <button
                            onClick={() => handlePdfPageView(currentContent.content.page_number!)}
                            className="w-full bg-blue-50 p-3 rounded-lg hover:bg-blue-100 transition-colors text-left"
                          >
                            <div className="flex items-center space-x-2">
                              <FileText className="w-4 h-4 text-blue-600" />
                              <div>
                                <p className="text-sm font-medium text-blue-700">
                                  Page {currentContent.content.page_number}
                                </p>
                                <p className="text-xs text-blue-600">
                                  Click to view full page
                                </p>
                              </div>
                            </div>
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-xs text-gray-500 mb-2">No page reference available</p>
                          <button
                            onClick={() => window.open(`https://arxiv.org/pdf/${paperData.arxiv_id}.pdf`, '_blank', 'noopener,noreferrer')}
                            className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            View Full PDF
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Images Section */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Images
                      </h4>
                      {imagesLoading ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                          <p className="text-xs text-gray-500 mt-2">Loading images...</p>
                        </div>
                      ) : relevantImages.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {relevantImages.map((image, index) => (
                            <div
                              key={image.id || index}
                              className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors overflow-hidden group"
                              onClick={() => setSelectedImage(image)}
                            >
                              <img
                                src={image.url || `/api/image/${image.id}`}
                                alt={`Figure ${index + 1}`}
                                className="max-w-full max-h-full object-contain p-1 group-hover:scale-105 transition-transform"
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">No images for this content</p>
                        </div>
                      )}
                    </div>

                    {/* Sources Section */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Sources
                      </h4>
                      {contentCitations.length > 0 ? (
                        <div className="space-y-2">
                          {contentCitations.map((citation, index) => (
                            <div
                              key={index}
                              className="bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-start space-x-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-900 mb-1">
                                    Reference {index + 1}
                                  </p>
                                  <p className="text-xs text-gray-800 break-words">
                                    {citation}
                                  </p>
                                  <button
                                    onClick={() => handleCitationClick(citation)}
                                    className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 hover:underline mt-2"
                                  >
                                    {isYouTubeUrl(citation) ? (
                                      <Play className="w-3 h-3 mr-1" />
                                    ) : (
                                      <ExternalLink className="w-3 h-3 mr-1" />
                                    )}
                                    {isYouTubeUrl(citation) ? 'Watch Video' : 'View Source'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <ExternalLink className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">No citations for this content</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right Sidebar - PDF, Images, and Sources */}
            <aside className="w-96 bg-white flex-shrink-0 fixed top-16 bottom-0 overflow-y-auto scrollbar-hide hidden lg:block lg:right-32">
              <div className="p-6 space-y-6">
              
              {/* PDF Section */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  PDF Original
                </h4>
                {currentContent?.content?.page_number ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => handlePdfPageView(currentContent.content.page_number!)}
                      className="w-full bg-blue-50 p-3 rounded-lg hover:bg-blue-100 transition-colors text-left"
                    >
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-blue-700">
                            Page {currentContent.content.page_number}
                          </p>
                          <p className="text-xs text-blue-600">
                            Click to view full page
                          </p>
                        </div>
                      </div>
                    </button>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-2">
                        <strong>PDF Reference:</strong>
                      </p>
                      <p className="text-xs text-gray-700">
                        This content is sourced from page {currentContent.content.page_number} of the original PDF. 
                        Click above to view the full page with figures, tables, and original formatting.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 mb-2">No page reference available</p>
                    <button
                      onClick={() => window.open(`https://arxiv.org/pdf/${paperData.arxiv_id}.pdf`, '_blank', 'noopener,noreferrer')}
                      className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Full PDF
                    </button>
                  </div>
                )}
              </div>

              {/* Images Section */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Images
                </h4>
                {imagesLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-xs text-gray-500 mt-2">Loading images...</p>
                  </div>
                ) : relevantImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {relevantImages.map((image, index) => (
                      <div
                        key={image.id || index}
                        className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors overflow-hidden group"
                        onClick={() => setSelectedImage(image)}
                      >
                        <img
                          src={image.url || `/api/image/${image.id}`}
                          alt={`Figure ${index + 1}`}
                          className="max-w-full max-h-full object-contain p-1 group-hover:scale-105 transition-transform"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">No images for this content</p>
                  </div>
                )}
                {relevantImages.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Click on an image to enlarge.
                  </p>
                )}
              </div>

              {/* Sources Section */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Sources
                </h4>
                {contentCitations.length > 0 ? (
                  <div className="space-y-2">
                    {contentCitations.map((citation, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-start space-x-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 mb-1">
                              Reference {index + 1}
                            </p>
                            <p className="text-xs text-gray-800 break-words">
                              {citation}
                            </p>
                            <button
                              onClick={() => handleCitationClick(citation)}
                              className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 hover:underline mt-2"
                            >
                              {isYouTubeUrl(citation) ? (
                                <Play className="w-3 h-3 mr-1" />
                              ) : (
                                <ExternalLink className="w-3 h-3 mr-1" />
                              )}
                              {isYouTubeUrl(citation) ? 'Watch Video' : 'View Source'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <ExternalLink className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">No citations for this content</p>
                  </div>
                )}
                </div>
                
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Image Modal with Close Button */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full p-2"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage.url || `/api/image/${selectedImage.id}`}
              alt="Enlarged figure"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* YouTube Modal */}
      {youtubeModal.isOpen && youtubeModal.videoId && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-lg max-w-4xl w-full max-h-full">
            <button
              onClick={() => setYoutubeModal({ isOpen: false, videoId: null })}
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 z-10"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="p-4">
              <iframe
                width="100%"
                height="480"
                src={`https://www.youtube.com/embed/${youtubeModal.videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="rounded-lg"
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"""
        with open(os.path.join(paper_folder, "page.tsx"), "w", encoding="utf-8") as f:
            f.write(page_content)
        
        print(f"Successfully created Next.js folder structure for paper {paper.arxiv_id}")
    except Exception as e:
        print(f"Error creating Next.js folder structure for paper {paper.arxiv_id}: {str(e)}")
        import traceback
        traceback.print_exc()

@app.get("/api/paper/{arxiv_id}", response_model=PaperDetailResponse)
async def get_paper(arxiv_id: str, db: Session = Depends(get_db)):
    """Get paper details by arXiv ID."""
    paper = db.query(Paper).filter(Paper.arxiv_id == arxiv_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    # Parse images
    # Handle potential string JSON data for SQLite compatibility
    try:
        if isinstance(paper.extracted_images, str):
            images = json.loads(paper.extracted_images)
        else:
            images = paper.extracted_images or []
    except (TypeError, json.JSONDecodeError):
        images = []
    
    return PaperDetailResponse(
        id=paper.id,
        arxiv_id=paper.arxiv_id,
        title=paper.title,
        authors=paper.authors,
        abstract=paper.abstract,
        pdf_url=paper.pdf_url,
        extracted_text=paper.extracted_text,
        images=images,
        sections=json.loads(paper.sections_data) if paper.sections_data else None,
        processed=paper.processed,
        created_at=paper.created_at,
        updated_at=paper.updated_at
    )

@app.get("/api/papers")
async def list_papers(db: Session = Depends(get_db)):
    """List all processed papers."""
    papers = db.query(Paper).all()  # Get all papers, not just processed ones
    print(f"Found {len(papers)} papers in database")
    
    response_data = []
    for paper in papers:
        paper_data = {
            "arxiv_id": paper.arxiv_id,
            "title": paper.title or f"Paper {paper.arxiv_id}",
            "authors": paper.authors or "Unknown authors",
            "abstract": paper.abstract[:200] + "..." if paper.abstract and len(paper.abstract) > 200 else paper.abstract or "No abstract available",
            "processed": paper.processed
        }
        response_data.append(paper_data)
        print(f"Paper {paper.arxiv_id}: {paper_data['title']} - Processed: {paper.processed}")
    
    return response_data

@app.get("/api/images/{arxiv_id}")
async def get_paper_images(arxiv_id: str, db: Session = Depends(get_db)):
    """Get all images for a specific paper."""
    paper = db.query(Paper).filter(Paper.arxiv_id == arxiv_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    if not paper.extracted_images:
        return []
    
    try:
        # Handle potential string JSON data for SQLite compatibility
        if isinstance(paper.extracted_images, str):
            images = json.loads(paper.extracted_images)
        else:
            images = paper.extracted_images or []
            
        # Add image URLs for each image
        for image in images:
            image["url"] = f"/api/image/{image['id']}"
            
        return images
    except json.JSONDecodeError:
        return []

@app.get("/api/image/{image_id}")
async def get_image(image_id: str, db: Session = Depends(get_db)):
    """Serve an extracted image by ID."""
    # Find the paper containing this image
    papers = db.query(Paper).filter(Paper.extracted_images.like(f"%{image_id}%")).all()
    
    for paper in papers:
        if not paper.extracted_images:
            continue
        
        try:
            # Handle potential string JSON data for SQLite compatibility
            if isinstance(paper.extracted_images, str):
                images = json.loads(paper.extracted_images)
            else:
                images = paper.extracted_images
                
            for image in images:
                if image.get("id") == image_id:
                    image_path = image.get("path")
                    if image_path and os.path.exists(image_path):
                        return FileResponse(image_path)
        except json.JSONDecodeError:
            pass
    
    raise HTTPException(status_code=404, detail="Image not found")

@app.get("/api/highlighted-image/{highlight_id}")
async def get_highlighted_image(highlight_id: str):
    """Serve a highlighted page image by ID."""
    # Look for the highlighted image in the PDF processor's temp directory
    highlight_path = os.path.join(pdf_processor.temp_dir, f"highlight_{highlight_id}.png")
    
    if os.path.exists(highlight_path):
        return FileResponse(highlight_path, media_type="image/png")
    
    raise HTTPException(status_code=404, detail="Highlighted image not found")

@app.get("/api")
def health_check():
    """Health check endpoint for the frontend to verify backend is running."""
    return {"status": "ok", "service": "DeepRxiv API", "version": "1.0.0"}

@app.get("/api/paper/{arxiv_id}/status", response_model=PaperStatusResponse)
async def get_paper_status(arxiv_id: str, db: Session = Depends(get_db)):
    """Get the processing status of a paper."""
    paper = db.query(Paper).filter(Paper.arxiv_id == arxiv_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    if paper.processed:
        progress = "Completed"
    elif arxiv_id in paper_processing_status:
        progress = paper_processing_status[arxiv_id]
    else:
        progress = "Processing"
    
    return PaperStatusResponse(
        arxiv_id=paper.arxiv_id,
        processed=paper.processed,
        progress=progress
    )

# RAG Chatbot Endpoints

@app.post("/api/query")
async def query_paper(request: QueryRequest):
    """Query a specific paper's content using RAG with separate content and section results."""
    try:
        arxiv_id = request.arxiv_id
        query = request.query
        content_chunks = request.content_chunks
        section_chunks = request.section_chunks
        
        # Get query embedding
        query_embedding = get_embedding(query, title=f"Query for paper {arxiv_id}")
        
        # Get the paper's collection
        try:
            collection = chroma_client.get_collection(name=f"paper_{arxiv_id}")
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Paper {arxiv_id} not found in vector database. Please ensure the paper has been processed and indexed.")
        
        # Query the collection with increased results to separate content types
        total_results = max(content_chunks + section_chunks * 2, 20)  # Get more results to filter
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=total_results,
            include=['documents', 'metadatas', 'distances']
        )
        
        # Separate results by content type
        content_results = []
        section_results = []
        
        if results['documents'] and results['documents'][0]:
            for i in range(len(results['documents'][0])):
                result = {
                    'document': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'similarity_score': 1 - results['distances'][0][i]
                }
                
                content_type = result['metadata'].get('type', 'content')
                if content_type == 'content':
                    content_results.append(result)
                elif content_type in ['section', 'subsection']:
                    section_results.append(result)
        
        # Limit results to requested amounts
        content_results = content_results[:content_chunks]
        section_results = section_results[:section_chunks]
        
        # Combine for overall results (maintaining separation info)
        all_results = content_results + section_results
        
        if not all_results:
            return {
                "query": query,
                "arxiv_id": arxiv_id,
                "answer": "No relevant content found for your query.",
                "content_results": [],
                "section_results": [],
                "sources": [],
                "highlighted_pages": []
            }
        
        # Format context for LLM with clear separation
        context_content = ""
        sources = []
        highlighted_pages = []
        
        # Add content chunks first
        if content_results:
            context_content += "\n=== RAW EXTRACTED TEXT ===\n"
            for idx, result in enumerate(content_results):
                metadata = result['metadata']
                chunk_index = int(metadata.get('chunk_index', idx))
                source_info = f"Raw Content Chunk {chunk_index + 1}"
                
                context_content += f"\n[C{idx + 1}] {source_info}:\n{result['document']}\n"
                sources.append({
                    'index': f"C{idx + 1}",
                    'type': 'content',
                    'title': f'Raw Content Chunk {chunk_index + 1}',
                    'chunk_index': chunk_index,
                    'similarity_score': result['similarity_score'],
                    'text': result['document']
                })
                
                # Prepare for page highlighting - we'll generate highlighted pages for content chunks
                highlighted_pages.append({
                    'type': 'content',
                    'chunk_index': chunk_index,
                    'text': result['document'],
                    'similarity_score': result['similarity_score']
                })
        
        # Add section chunks
        if section_results:
            context_content += "\n=== STRUCTURED SECTIONS ===\n"
            for idx, result in enumerate(section_results):
                metadata = result['metadata']
                content_type = metadata.get('type', 'section')
                
                if content_type == 'section':
                    source_info = f"Section: {metadata.get('section_title', 'Unknown')}"
                    if metadata.get('page_number'):
                        source_info += f" (Page {metadata.get('page_number')})"
                elif content_type == 'subsection':
                    source_info = f"Subsection: {metadata.get('subsection_title', 'Unknown')} (under {metadata.get('section_title', 'Unknown')})"
                    if metadata.get('page_number'):
                        source_info += f" (Page {metadata.get('page_number')})"
                
                context_content += f"\n[S{idx + 1}] {source_info}:\n{result['document']}\n"
                sources.append({
                    'index': f"S{idx + 1}",
                    'type': content_type,
                    'title': metadata.get('section_title') or metadata.get('subsection_title', 'Section'),
                    'page_number': metadata.get('page_number'),
                    'similarity_score': result['similarity_score']
                })
        
        # Generate answer using Perplexity
        answer_prompt = f"""You are a helpful research assistant. Answer the user's question about this academic paper based on the provided context.

User Question: {query}

Context from Paper {arxiv_id}:
{context_content}

Instructions:
1. Answer the question directly and accurately based on the provided context
2. Use specific information from both raw content (C1, C2, etc.) and structured sections (S1, S2, etc.)
3. Include relevant citations using [C1], [S2], etc. format referring to the numbered sources
4. When referencing raw content, explain that it comes from the original extracted text
5. When referencing sections, mention they are from the structured analysis
6. If the context doesn't contain enough information to answer the question, say so clearly
7. Keep your answer focused and concise while being informative
8. Use technical language appropriate for the academic content

Answer:"""

        # Generate highlighted page images if we have content results
        highlighted_images = []
        if highlighted_pages:
            try:
                # Get the paper's PDF data
                from database import SessionLocal
                db = SessionLocal()
                paper = db.query(Paper).filter(Paper.arxiv_id == arxiv_id).first()
                if paper and paper.pdf_data:
                    highlighted_images = pdf_processor.generate_page_highlights_for_query(
                        paper.pdf_data, 
                        highlighted_pages
                    )
                    # Add URLs for serving the highlighted images
                    for img in highlighted_images:
                        img['url'] = f"/api/highlighted-image/{img['id']}"
                db.close()
            except Exception as highlight_error:
                print(f"Error generating highlighted images: {str(highlight_error)}")
        
        try:
            # Use Perplexity via the LLM service
            system_prompt = "You are a helpful research assistant specializing in academic paper analysis. Provide accurate, well-sourced answers that distinguish between raw extracted text and structured sections."
            perplexity_result = llm_service._call_perplexity_api(answer_prompt, system_prompt)
            answer = perplexity_result["content"]
            
        except Exception as llm_error:
            print(f"Error generating LLM answer: {str(llm_error)}")
            answer = f"I found relevant content in the paper, but encountered an error generating a detailed answer. Here are the key relevant excerpts: {all_results[0]['document'][:500]}..."
        
        return {
            "query": query,
            "arxiv_id": arxiv_id,
            "answer": answer,
            "content_results": content_results,
            "section_results": section_results,
            "sources": sources,
            "highlighted_pages": highlighted_pages,
            "highlighted_images": highlighted_images
        }
    
    except Exception as e:
        print(f"Error in query endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/test-embedding")
async def test_embedding(request: EmbeddingRequest):
    """Test the embedding functionality."""
    try:
        embedding = get_embedding(request.text)
        return {
            "text": request.text,
            "embedding_length": len(embedding),
            "embedding_sample": embedding[:10]  # First 10 dimensions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/test-perplexity")
async def test_perplexity_model(request: TestPerplexityRequest):
    """Test the Perplexity model."""
    try:
        # Use Perplexity via the LLM service
        system_prompt = "Be helpful and provide accurate, well-researched answers."
        result = llm_service._call_perplexity_api(request.prompt, system_prompt)
        
        return {"response": result["content"], "citations": result.get("citations", [])}
    
    except Exception as e:
        print(f"Error in test perplexity: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/papers/{arxiv_id}/collection-stats")
async def get_collection_stats(arxiv_id: str):
    """Get statistics about a paper's vector collection."""
    try:
        collection = chroma_client.get_collection(name=f"paper_{arxiv_id}")
        
        count = collection.count()
        
        # Get sample documents to understand the structure
        if count > 0:
            results = collection.get(limit=min(10, count), include=['metadatas'])
            
            # Analyze the metadata
            content_types = {}
            sections = set()
            pages = set()
            
            for metadata in results['metadatas']:
                content_type = metadata.get('type', 'unknown')
                content_types[content_type] = content_types.get(content_type, 0) + 1
                
                if metadata.get('section_title'):
                    sections.add(metadata.get('section_title'))
                
                if metadata.get('page_number'):
                    pages.add(metadata.get('page_number'))
            
            return {
                "arxiv_id": arxiv_id,
                "total_chunks": count,
                "content_types": content_types,
                "unique_sections": len(sections),
                "sections": sorted(list(sections)),
                "pages_covered": sorted(list(pages))
            }
        else:
            return {
                "arxiv_id": arxiv_id,
                "total_chunks": 0,
                "message": "Collection is empty"
            }
    
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Collection for paper {arxiv_id} not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 