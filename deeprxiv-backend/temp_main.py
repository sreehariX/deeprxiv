import os
import json
import requests
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks, Header
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
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

from database import get_db, Paper, User, ChatSession, ChatMessage, create_tables
from pdf_processor import PDFProcessor
from llm_service import LLMService
from admin_routes import router as admin_router

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

# Include admin routes
app.include_router(admin_router)

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
    query_mode: str = "enhanced"  # "enhanced" or "raw"

class EmbeddingRequest(BaseModel):
    text: str

class TestPerplexityRequest(BaseModel):
    prompt: str = "How does RLHF work?"

# Chat Models
class ChatCreateRequest(BaseModel):
    paper_id: Optional[int] = None
    arxiv_id: Optional[str] = None
    title: Optional[str] = None
    is_public: bool = True
    user_id: Optional[int] = None

class ChatMessageRequest(BaseModel):
    session_id: str
    message: str
    content_chunks: int = 3
    section_chunks: int = 3
    model: str = "sonar"  # Default model
    stream: bool = True  # Default to streaming
    query_mode: str = "enhanced"  # "enhanced" or "raw"

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    chain_of_thought: Optional[str] = None  # For reasoning models
    sources: Optional[List[dict]] = None
    citations: Optional[List[str]] = None
    images: Optional[List[dict]] = None
    highlighted_images: Optional[List[dict]] = None
    model_used: Optional[str] = None
    thumbs_up: Optional[bool] = None
    thumbs_down: Optional[bool] = None
    created_at: datetime

class ChatSessionResponse(BaseModel):
    id: int
    session_id: str
    title: Optional[str]
    paper_id: Optional[int]
    paper_title: Optional[str]
    arxiv_id: Optional[str]
    is_public: bool
    share_url: Optional[str]
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessageResponse]

class ChatFeedbackRequest(BaseModel):
    message_id: int
    thumbs_up: Optional[bool] = None
    thumbs_down: Optional[bool] = None
    suggested_answer: Optional[str] = None

class ModelInfo(BaseModel):
    name: str
    description: str
    type: str
    context_length: str
    features: List[str]

class AvailableModelsResponse(BaseModel):
    models: Dict[str, ModelInfo]

# Track progress for each paper
paper_processing_status = {}

def get_embedding(text: str, title="DeepRxiv Paper"):
    """Generate embeddings using Google's text-embedding-004 model."""
    try:
        print(f"🔤 Generating embedding for text: '{text[:100]}...' (title: {title})")
        response = embedding_client.models.embed_content(
            model="models/text-embedding-004",
            contents=text,
            config=EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=768,
                title=title,
            ),
        )
        embedding_values = response.embeddings[0].values
        print(f"✅ Generated embedding with {len(embedding_values)} dimensions")
        return embedding_values
    except Exception as e:
        print(f"❌ Error generating embedding: {str(e)}")
        raise

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
import { ArrowLeft, Image as ImageIcon, ExternalLink, X, Play, FileText, BookOpen, Menu, MessageCircle } from 'lucide-react';
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

      {/* Chat with Paper Button - Fixed Overlay */}
      <Link 
        href={`/chat?paper_id=${paperData.id}&arxiv_id=${paperData.arxiv_id}`}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-all duration-200 flex items-center gap-2 hover:scale-105"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="font-medium">Chat with this paper</span>
      </Link>
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
            "id": paper.id,  # Add the missing id field
            "arxiv_id": paper.arxiv_id,
            "title": paper.title or f"Paper {paper.arxiv_id}",
            "authors": paper.authors or "Unknown authors",
            "abstract": paper.abstract[:200] + "..." if paper.abstract and len(paper.abstract) > 200 else paper.abstract or "No abstract available",
            "processed": paper.processed
        }
        response_data.append(paper_data)
        print(f"Paper {paper.id} ({paper.arxiv_id}): {paper_data['title']} - Processed: {paper.processed}")
    
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
    print(f"📷 Serving image request for ID: {image_id}")
    
    # Find the paper containing this image
    papers = db.query(Paper).filter(Paper.extracted_images.like(f"%{image_id}%")).all()
    print(f"Found {len(papers)} papers that might contain this image")
    
    for paper in papers:
        if not paper.extracted_images:
            print(f"Paper {paper.arxiv_id} has no extracted_images data")
            continue
        
        try:
            # Handle potential string JSON data for SQLite compatibility
            if isinstance(paper.extracted_images, str):
                images = json.loads(paper.extracted_images)
            else:
                images = paper.extracted_images
                
            print(f"Paper {paper.arxiv_id} has {len(images) if images else 0} images")
                
            for image in images:
                if image.get("id") == image_id:
                    image_path = image.get("path")
                    print(f"Found matching image: {image_id}")
                    print(f"Original path: {image_path}")
                    
                    # Try multiple path resolution strategies
                    paths_to_try = []
                    
                    if image_path:
                        # 1. Try original path first
                        paths_to_try.append(image_path)
                        
                        # 2. Try basename in current PDFProcessor temp directory
                        filename = os.path.basename(image_path)
                        paths_to_try.append(os.path.join(pdf_processor.temp_dir, filename))
                        
                        # 3. Try in common temp directories
                        temp_dirs = [
                            'temp',
                            'pdf_processor_temp',
                            '/tmp',
                            os.path.join(os.getcwd(), 'temp'),
                            os.path.join(os.getcwd(), 'pdf_processor_temp')
                        ]
                        
                        for temp_dir in temp_dirs:
                            if os.path.exists(temp_dir):
                                paths_to_try.append(os.path.join(temp_dir, filename))
                        
                        # 4. Try regenerating the image from PDF if we have it
                        if paper.pdf_data:
                            try:
                                print(f"Attempting to regenerate image from PDF...")
                                # Extract the page number from the image data
                                page_num = image.get('page', 0)
                                
                                # Use pdf_processor to extract this specific image
                                extracted_images = pdf_processor.extract_images_from_pdf(paper.pdf_data)
                                
                                # Find the matching image by page and approximate position
                                for extracted_img in extracted_images:
                                    if (extracted_img.get('page') == page_num and 
                                        extracted_img.get('id') == image_id):
                                        regenerated_path = extracted_img.get('path')
                                        if regenerated_path and os.path.exists(regenerated_path):
                                            print(f"✅ Regenerated image at: {regenerated_path}")
                                            return FileResponse(regenerated_path)
                            except Exception as regen_error:
                                print(f"❌ Failed to regenerate image: {regen_error}")
                    
                    # Try each path until we find one that exists
                    for path_to_try in paths_to_try:
                        print(f"Trying path: {path_to_try}")
                        if path_to_try and os.path.exists(path_to_try):
                            print(f"✅ Serving image from: {path_to_try}")
                            return FileResponse(path_to_try)
                    
                    print(f"❌ Image file not found at any of {len(paths_to_try)} attempted paths")
                    
                    # Last resort: try to find any file with the image_id in the name
                    for temp_dir in [pdf_processor.temp_dir, 'temp', '/tmp']:
                        if os.path.exists(temp_dir):
                            for file in os.listdir(temp_dir):
                                if image_id in file and file.endswith(('.png', '.jpg', '.jpeg')):
                                    fallback_path = os.path.join(temp_dir, file)
                                    print(f"✅ Found fallback image: {fallback_path}")
                                    return FileResponse(fallback_path)
                        
        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error for paper {paper.arxiv_id}: {str(e)}")
        except Exception as e:
            print(f"❌ Error processing paper {paper.arxiv_id}: {str(e)}")
    
    print(f"❌ Image {image_id} not found in any paper or file system")
    
    # Return a placeholder image or 404
    placeholder_response = HTTPException(status_code=404, detail=f"Image {image_id} not found")
    raise placeholder_response

@app.get("/api/highlighted-image/{highlight_id}")
async def get_highlighted_image(highlight_id: str):
    """Serve a highlighted page image by ID."""
    # Look for the highlighted image in the PDF processor's temp directory
    highlight_path = os.path.join(pdf_processor.temp_dir, f"highlight_{highlight_id}.png")
    
    if os.path.exists(highlight_path):
        return FileResponse(highlight_path, media_type="image/png")
    
    raise HTTPException(status_code=404, detail="Highlighted image not found")

@app.post("/api/generate-highlight/{arxiv_id}")
async def generate_chunk_highlight(
    arxiv_id: str, 
    chunk_text: str = None,
    estimated_page: int = None,
    chunk_index: int = None,
    db: Session = Depends(get_db)
):
    """Generate a highlighted PDF page for a specific content chunk."""
    print(f"🖍️ Generating highlight for {arxiv_id}, page {estimated_page}, chunk {chunk_index}")
    
    # Get paper from database
    paper = db.query(Paper).filter(Paper.arxiv_id == arxiv_id).first()
    if not paper or not paper.pdf_data:
        raise HTTPException(status_code=404, detail="Paper not found or no PDF data available")
    
    try:
        # Generate unique highlight ID
        highlight_id = str(uuid.uuid4())
        highlight_path = os.path.join(pdf_processor.temp_dir, f"highlight_{highlight_id}.png")
        
        # Use estimated_page (1-indexed from frontend) converted to 0-indexed for processing
        page_to_highlight = max(0, (estimated_page or 1) - 1)
        
        print(f"Highlighting page {page_to_highlight} (0-indexed) with text: '{chunk_text[:100]}...'")
        
        # Create highlighted page image
        result = pdf_processor.create_highlighted_page_image(
            paper.pdf_data,
            page_to_highlight,
            chunk_text or "",
            highlight_path
        )
        
        if result:
            print(f"✅ Generated highlight image: {highlight_id}")
            return {
                "highlight_id": highlight_id,
                "highlight_url": f"/api/highlighted-image/{highlight_id}",
                "page": estimated_page or page_to_highlight + 1,
                "chunk_index": chunk_index
            }
        else:
            print(f"❌ Failed to generate highlight image")
            raise HTTPException(status_code=500, detail="Failed to generate highlighted image")
            
    except Exception as e:
        print(f"❌ Error generating highlight: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating highlight: {str(e)}")

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

# Chat Endpoints

@app.post("/api/chat/create", response_model=ChatSessionResponse)
async def create_chat_session(request: ChatCreateRequest, client_ip: str = Header(None), db: Session = Depends(get_db)):
    """Create a new chat session."""
    try:
        # Find or create paper if arxiv_id is provided
        paper = None
        if request.arxiv_id:
            paper = db.query(Paper).filter(Paper.arxiv_id == request.arxiv_id).first()
            if not paper:
                raise HTTPException(status_code=404, detail=f"Paper {request.arxiv_id} not found")
        elif request.paper_id:
            paper = db.query(Paper).filter(Paper.id == request.paper_id).first()
            if not paper:
                raise HTTPException(status_code=404, detail=f"Paper with ID {request.paper_id} not found")

        # Create or get user
        user = None
        user_id = request.user_id
        
        # If no user_id is provided, create an anonymous session with client IP
        if not user_id:
            # Check if we have an anonymous user with this IP
            anon_user = db.query(User).filter(
                User.is_anonymous == True,
                User.username == f"anon_{client_ip}"
            ).first()
            
            if anon_user:
                user = anon_user
                user_id = anon_user.id
            else:
                # Create a new anonymous user with IP as username
                anon_user = User(
                    username=f"anon_{client_ip}",
                    is_anonymous=True,
                    created_at=datetime.utcnow()
                )
                db.add(anon_user)
                db.flush()  # Get the ID without committing yet
                user = anon_user
                user_id = anon_user.id
        else:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")

        # Generate share URL if public
        share_url = None
        if request.is_public:
            share_url = str(uuid.uuid4())

        # Create chat session
        session = ChatSession(
            title=request.title or (f"Chat about {paper.title}" if paper else "New Chat"),
            paper_id=paper.id if paper else None,
            user_id=user_id,
            is_public=request.is_public,
            share_url=share_url
        )

        db.add(session)
        db.commit()
        db.refresh(session)

        return ChatSessionResponse(
            id=session.id,
            session_id=session.session_id,
            title=session.title,
            paper_id=session.paper_id,
            paper_title=paper.title if paper else None,
            arxiv_id=paper.arxiv_id if paper else None,
            is_public=session.is_public,
            share_url=session.share_url,
            created_at=session.created_at,
            updated_at=session.updated_at,
            messages=[]
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/sessions")
async def get_user_chat_sessions(user_id: Optional[int] = None, include_public: bool = True, db: Session = Depends(get_db)):
    """Get chat sessions for a user or public sessions."""
    print(f"📋 Loading sessions: user_id={user_id}, include_public={include_public}")

    query = None
    if user_id:
        # Load user's sessions
        query = db.query(ChatSession).filter(ChatSession.user_id == user_id)
        print(f"👤 Loading sessions for user {user_id}")
        
        if include_public:
            # Include public sessions along with user's sessions
            query = query.union(
                db.query(ChatSession).filter(ChatSession.is_public == True)
            )
            print(f"🔓 Including public sessions")
    else:
        if include_public:
            # Load only public sessions
            query = db.query(ChatSession).filter(ChatSession.is_public == True)
            print(f"🔓 Loading public sessions only")
        else:
            # Return empty when no user and not including public
            print(f"🚫 No user specified and not including public sessions - returning empty list")
            return []

    sessions = query.order_by(ChatSession.updated_at.desc()).limit(50).all()
    print(f"✅ Found {len(sessions)} sessions")
    
    # Convert to response format
    session_responses = []
    for session in sessions:
        paper = None
        if session.paper_id:
            paper = db.query(Paper).filter(Paper.id == session.paper_id).first()
        
        session_responses.append({
            "id": session.id,
            "session_id": session.session_id,
            "title": session.title,
            "paper_id": session.paper_id,
            "paper_title": paper.title if paper else None,
            "arxiv_id": paper.arxiv_id if paper else None,
            "is_public": session.is_public,
            "share_url": session.share_url,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "message_count": len(session.messages),
            "user_id": session.user_id
        })
    
    return session_responses

# CRITICAL: Models endpoint MUST come before {session_id} route to avoid routing conflicts
@app.get("/api/chat/models", response_model=AvailableModelsResponse)
async def get_available_models_fixed():
    """Get list of available Perplexity models with descriptions."""
    models_info = llm_service.get_available_models()
    formatted_models = {}
    
    for model_key, model_data in models_info.items():
        formatted_models[model_key] = ModelInfo(
            name=model_data["name"],
            description=model_data["description"],
            type=model_data["type"],
            context_length=model_data["context_length"],
            features=model_data["features"]
        )
    
    return AvailableModelsResponse(models=formatted_models)

@app.get("/api/chat/{session_id}", response_model=ChatSessionResponse)
async def get_chat_session(session_id: str, db: Session = Depends(get_db)):
    """Get a chat session by ID."""
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Get messages
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at).all()
    
    # Convert messages to response format
    message_responses = []
    for msg in messages:
        # Parse JSON fields properly
        sources = json.loads(msg.sources) if msg.sources else None
        citations = json.loads(msg.citations) if msg.citations else None
        images = json.loads(msg.images) if msg.images else None
        highlighted_images = json.loads(msg.highlighted_images) if msg.highlighted_images else None
        
        message_responses.append(ChatMessageResponse(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            chain_of_thought=msg.chain_of_thought,
            sources=sources,
            citations=citations,
            images=images,
            highlighted_images=highlighted_images,
            model_used=msg.model_used,
            thumbs_up=msg.thumbs_up,
            thumbs_down=msg.thumbs_down,
            created_at=msg.created_at
        ))

    # Get paper info if available
    paper = None
    if session.paper_id:
        paper = db.query(Paper).filter(Paper.id == session.paper_id).first()

    return ChatSessionResponse(
        id=session.id,
        session_id=session.session_id,
        title=session.title,
        paper_id=session.paper_id,
        paper_title=paper.title if paper else None,
        arxiv_id=paper.arxiv_id if paper else None,
        is_public=session.is_public,
        share_url=session.share_url,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=message_responses
    )

@app.post("/api/chat/message")
async def send_chat_message(request: ChatMessageRequest, db: Session = Depends(get_db)):
    """Send a message in a chat session with model selection and streaming support."""
    try:
        print(f"\n=== CHAT MESSAGE REQUEST ===")
        print(f"Session ID: {request.session_id}")
        print(f"Message: {request.message}")
        print(f"Model: {request.model}")
        print(f"Stream: {request.stream}")
        print(f"Content chunks: {request.content_chunks}")
        print(f"Section chunks: {request.section_chunks}")
        
        # Get chat session
        session = db.query(ChatSession).filter(ChatSession.session_id == request.session_id).first()
        if not session:
            print(f"❌ Chat session not found: {request.session_id}")
            raise HTTPException(status_code=404, detail="Chat session not found")

        print(f"✅ Found session: {session.title}")
        print(f"Session paper_id: {session.paper_id}")
        
        # Get paper info if available
        paper_info = None
        if session.paper_id:
            paper_info = db.query(Paper).filter(Paper.id == session.paper_id).first()
            print(f"Session arxiv_id: {paper_info.arxiv_id if paper_info else 'None'}")
        else:
            print(f"Session arxiv_id: None (no paper selected)")

        # Save user message
        user_message = ChatMessage(
            session_id=session.id,
            role="user",
            content=request.message
        )
        db.add(user_message)
        db.commit()
        db.refresh(user_message)
        print(f"✅ Saved user message with ID: {user_message.id}")

        # Set the model for the LLM service
        llm_service.set_model(request.model)

        # Handle streaming vs non-streaming response
        if request.stream:
            return StreamingResponse(
                generate_streaming_chat_response(request, session.session_id, db),
                media_type="text/plain"
            )

        # Generate non-streaming response
        return await generate_non_streaming_chat_response(request, session.session_id, db)

    except Exception as e:
        db.rollback()
        print(f"Error in chat message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/feedback")
async def submit_chat_feedback(request: ChatFeedbackRequest, db: Session = Depends(get_db)):
    """Submit feedback for a chat message."""
    message = db.query(ChatMessage).filter(ChatMessage.id == request.message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Update feedback
    if request.thumbs_up is not None:
        message.thumbs_up = request.thumbs_up
        message.thumbs_down = not request.thumbs_up if request.thumbs_up else None
    
    if request.thumbs_down is not None:
        message.thumbs_down = request.thumbs_down
        message.thumbs_up = not request.thumbs_down if request.thumbs_down else None
    
    if request.suggested_answer:
        message.suggested_answer = request.suggested_answer
    
    db.commit()
    
    return {"message": "Feedback submitted successfully"}

@app.delete("/api/chat/{session_id}")
async def delete_chat_session(session_id: str, db: Session = Depends(get_db)):
    """Delete a chat session and all its messages."""
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Delete all messages in the session
    db.query(ChatMessage).filter(ChatMessage.session_id == session.id).delete()
    
    # Delete the session
    db.delete(session)
    db.commit()
    
    return {"message": "Chat session deleted successfully"}

@app.get("/api/chat/share/{share_url}", response_model=ChatSessionResponse)
async def get_shared_chat(share_url: str, db: Session = Depends(get_db)):
    """Get a shared chat session by share URL."""
    session = db.query(ChatSession).filter(ChatSession.share_url == share_url).first()
    if not session or not session.is_public:
        raise HTTPException(status_code=404, detail="Shared chat not found or not public")
    
    # Use the existing get_chat_session logic
    return await get_chat_session(session.session_id, db)

@app.post("/api/chat/{session_id}/share")
async def create_share_link(session_id: str, db: Session = Depends(get_db)):
    """Create or get a share link for a chat session."""
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Generate share URL if it doesn't exist
    if not session.share_url:
        session.share_url = str(uuid.uuid4())
        session.is_public = True  # Make it public when sharing
        db.commit()
        db.refresh(session)
    
    return {"share_url": session.share_url}

# Streaming chat response generator
async def generate_streaming_chat_response(request: ChatMessageRequest, session_id: str, db: Session):
    """Generate streaming chat response with RAG support."""
    try:
        print(f"\n🌊 STARTING STREAMING RESPONSE...")
        
        # Initialize response variables
        sources = []
        highlighted_images = []
        citations = []
        images = []
        chain_of_thought = ""
        context_content = ""
        
        # Re-query the session to ensure it's attached to the current database session
        session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Update session title if this is the first user message
        message_count = db.query(ChatMessage).filter(ChatMessage.session_id == session.id).count()
        if message_count == 1 and (session.title == 'New Chat' or not session.title):  # Only user message exists (just added) and title is default
            paper = None
            if session.paper_id:
                paper = db.query(Paper).filter(Paper.id == session.paper_id).first()
            
            # Create a meaningful title from first question + arXiv ID
            first_question = request.message[:50] + "..." if len(request.message) > 50 else request.message
            if paper:
                new_title = f"{paper.arxiv_id}: {first_question}"
            else:
                new_title = first_question
            
            session.title = new_title
            db.commit()
            print(f"📝 Updated session title to: {new_title}")
        
        # Check if session has an associated paper for RAG
        if session.paper_id:
            print(f"\n🔍 USING RAG MODE - Paper ID: {session.paper_id}")
            paper = db.query(Paper).filter(Paper.id == session.paper_id).first()
            
            if paper and paper.processed:
                print(f"✅ Found processed paper: {paper.arxiv_id} - {paper.title}")
                
                try:
                    # Determine the query to use for vector search
                    search_query = request.message
                    
                    if request.query_mode == "enhanced":
                        print(f"🚀 ENHANCED MODE: Improving query for vector search...")
                        # Use Sonar model to enhance the query for better vector search
                        enhancement_prompt = f"""You are a research assistant helping to improve search queries for academic papers. 

Original user question: "{request.message}"

Paper context: This is about the paper "{paper.title}" (arXiv:{paper.arxiv_id}).

Task: Rewrite the user's question to be more specific and effective for search academic content. Focus on:
1. Using technical terminology that would appear in academic papers
2. Expanding abbreviations and adding relevant keywords
3. Making the query more specific to academic/research context
4. Keeping the core intent but making it more searchable

Return ONLY the improved search query, nothing else."""

                        try:
                            enhancement_response = llm_service._call_perplexity_api(
                                enhancement_prompt,
                                "You are a helpful research assistant that improves search queries.",
                                model="sonar",  # Use basic sonar for query enhancement
                                stream=False
                            )
                            
                            if enhancement_response and enhancement_response.get("content"):
                                search_query = enhancement_response["content"].strip()
                                print(f"✅ Enhanced query: '{search_query}'")
                            else:
                                print(f"⚠️ Query enhancement failed, using original query")
                                search_query = request.message
                        except Exception as e:
                            print(f"⚠️ Query enhancement error: {str(e)}, using original query")
                            search_query = request.message
                    else:
                        print(f"🔍 RAW MODE: Using original query for vector search")
                    
                    # Update the answer prompt to include the search query information
                    print(f"🔤 Final search query: '{search_query}'")
                    
                    # Get query embedding
                    print(f"🔤 Getting embedding for search query: '{search_query[:100]}...'")
                    query_embedding = get_embedding(search_query, title=f"Query for paper {paper.arxiv_id}")
                    print(f"✅ Generated embedding with dimension: {len(query_embedding) if query_embedding else 'None'}")
                    
                    # Get the paper's collection
                    collection_name = f"paper_{paper.arxiv_id}"
                    print(f"🗂️  Getting collection: {collection_name}")
                    collection = chroma_client.get_collection(name=collection_name)
                    collection_count = collection.count()
                    print(f"✅ Collection found with {collection_count} documents")
                    
                    # Query the collection
                    total_results = max(request.content_chunks + request.section_chunks * 2, 20)
                    print(f"🔍 Querying collection for {total_results} results...")
                    results = collection.query(
                        query_embeddings=[query_embedding],
                        n_results=total_results,
                        include=['documents', 'metadatas', 'distances']
                    )
                    
                    result_count = len(results['documents'][0]) if results['documents'] and results['documents'][0] else 0
                    print(f"✅ Retrieved {result_count} results from vector search")
                    
                    # Process RAG results
                    content_results = []
                    section_results = []
                    
                    print(f"\n📋 PROCESSING SEARCH RESULTS...")
                    if results['documents'] and results['documents'][0]:
                        for i in range(len(results['documents'][0])):
                            result = {
                                'document': results['documents'][0][i],
                                'metadata': results['metadatas'][0][i],
                                'similarity_score': 1 - results['distances'][0][i]
                            }
                            
                            content_type = result['metadata'].get('type', 'content')
                            similarity_pct = result['similarity_score'] * 100
                            
                            if content_type == 'content':
                                content_results.append(result)
                                print(f"  📄 Content chunk {len(content_results)}: {similarity_pct:.1f}% similarity")
                            elif content_type in ['section', 'subsection']:
                                section_results.append(result)
                                section_title = result['metadata'].get('section_title', 'Unknown')
                                print(f"  📑 Section '{section_title}': {similarity_pct:.1f}% similarity")
                    
                    # Limit results
                    original_content_count = len(content_results)
                    original_section_count = len(section_results)
                    content_results = content_results[:request.content_chunks]
                    section_results = section_results[:request.section_chunks]
                    
                    print(f"📊 Results filtered: {len(content_results)}/{original_content_count} content, {len(section_results)}/{original_section_count} sections")
                    
                    # Build context and sources
                    if content_results:
                        context_content += "\n=== RAW EXTRACTED TEXT ===\n"
                        for idx, result in enumerate(content_results):
                            metadata = result['metadata']
                            chunk_index = int(metadata.get('chunk_index', idx))
                            estimated_page = metadata.get('estimated_page', 'N/A')
                            
                            context_content += f"\n[C{idx + 1}] Raw Content Chunk {chunk_index + 1} (Est. Page {estimated_page}):\n{result['document']}\n"
                            sources.append({
                                'index': f"C{idx + 1}",
                                'type': 'content',
                                'title': f'Raw Content Chunk {chunk_index + 1}',
                                'chunk_index': chunk_index,
                                'estimated_page': estimated_page,
                                'similarity_score': result['similarity_score'],
                                'text': result['document'][:200] + '...' if len(result['document']) > 200 else result['document'],
                                'full_text': result['document'],  # Keep full text for highlighting
                                'arxiv_id': paper.arxiv_id
                            })
                    
                    if section_results:
                        context_content += "\n=== STRUCTURED SECTIONS ===\n"
                        for idx, result in enumerate(section_results):
                            metadata = result['metadata']
                            content_type = metadata.get('type', 'section')
                            
                            if content_type == 'section':
                                source_info = f"Section: {metadata.get('section_title', 'Unknown')}"
                                section_id = metadata.get('section_id', '')
                            elif content_type == 'subsection':
                                source_info = f"Subsection: {metadata.get('subsection_title', 'Unknown')} (under {metadata.get('section_title', 'Unknown')})"
                                section_id = metadata.get('subsection_id', '')
                            
                            page_number = metadata.get('page_number', 'N/A')
                            if page_number != 'N/A':
                                source_info += f" (Page {page_number})"
                            
                            context_content += f"\n[S{idx + 1}] {source_info}:\n{result['document']}\n"
                            sources.append({
                                'index': f"S{idx + 1}",
                                'type': content_type,
                                'title': metadata.get('section_title') or metadata.get('subsection_title', 'Section'),
                                'section_id': section_id,
                                'page_number': page_number,
                                'similarity_score': result['similarity_score'],
                                'text': result['document'][:200] + '...' if len(result['document']) > 200 else result['document'],
                                'full_text': result['document'],  # Keep full text for highlighting
                                'arxiv_id': paper.arxiv_id
                            })
                    
                    print(f"\n🧠 RAG CONTEXT PREPARED:")
                    print(f"Context length: {len(context_content)} characters")
                    print(f"Sources prepared: {len(sources)}")
                    
                    # Prepare RAG prompt
                    answer_prompt = f"""You are a helpful research assistant. Answer the user's question about this academic paper based on the provided context.

User Question: {request.message}

Context from Paper {paper.arxiv_id} - {paper.title}:
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
                    
                except Exception as rag_error:
                    print(f"❌ Error in RAG processing: {str(rag_error)}")
                    import traceback
                    traceback.print_exc()
                    answer_prompt = f"I encountered an error while processing the paper content. Please answer this general question: {request.message}"
                    sources = []
            else:
                print(f"❌ Paper not processed or not found: paper={paper}, processed={paper.processed if paper else 'None'}")
                answer_prompt = f"The paper is not yet processed. Please answer this general question: {request.message}"
                sources = []
        else:
            print(f"\n💬 USING GENERAL MODE - No paper selected for session {session.session_id}")
            print(f"Session details: title='{session.title}', paper_id={session.paper_id}")
            answer_prompt = request.message
            sources = []
        
        # Prepare system prompt
        system_prompt = "You are a helpful research assistant specializing in academic paper analysis. Provide accurate, well-sourced answers."
        
        print(f"🤖 CALLING PERPLEXITY API (Streaming)...")
        print(f"Model: {request.model}")
        print(f"Prompt length: {len(answer_prompt)} characters")
        
        # Get streaming response from Perplexity
        streaming_generator = llm_service._call_perplexity_api(
            answer_prompt, 
            system_prompt, 
            model=request.model, 
            stream=True
        )
        
        # Stream the response
        full_content = ""
        
        for chunk in streaming_generator:
            if chunk["type"] == "content":
                content = chunk["content"]
                full_content += content
                
                # Send content chunk
                yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                
            elif chunk["type"] == "metadata":
                citations = chunk.get("citations", [])
                images = chunk.get("images", [])
                
                # Extract chain of thought for reasoning models
                if request.model in ["sonar-reasoning", "sonar-reasoning-pro"]:
                    chain_of_thought, full_content = llm_service._extract_chain_of_thought(full_content)
                
                # Send final metadata
                metadata = {
                    "type": "metadata",
                    "sources": sources,
                    "citations": citations,
                    "images": images,
                    "chain_of_thought": chain_of_thought,
                    "model_used": request.model
                }
                yield f"data: {json.dumps(metadata)}\n\n"
                
            elif chunk["type"] == "error":
                yield f"data: {json.dumps(chunk)}\n\n"
        
        # Save assistant message to database
        assistant_message = ChatMessage(
            session_id=session.id,
            role="assistant",
            content=full_content,
            chain_of_thought=chain_of_thought,
            sources=json.dumps(sources) if sources else None,
            citations=json.dumps(citations) if citations else None,
            images=json.dumps(images) if images else None,
            highlighted_images=json.dumps(highlighted_images) if highlighted_images else None,
            model_used=request.model
        )
        db.add(assistant_message)
        session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(assistant_message)
        
        print(f"✅ Saved assistant message to database with ID: {assistant_message.id}")
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        
    except Exception as e:
        error_msg = f"Error in streaming response: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"

async def generate_non_streaming_chat_response(request: ChatMessageRequest, session_id: str, db: Session):
    """Generate non-streaming chat response with RAG support."""
    print(f"\n📝 GENERATING NON-STREAMING RESPONSE...")
    
    # Initialize response variables
    sources = []
    highlighted_images = []
    citations = []
    images = []
    chain_of_thought = ""
    context_content = ""
    
    try:
        # Re-query the session to ensure it's attached to the current database session
        session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Check if session has an associated paper for RAG
        if session.paper_id:
            print(f"\n🔍 USING RAG MODE - Paper ID: {session.paper_id}")
            paper = db.query(Paper).filter(Paper.id == session.paper_id).first()
            
            if paper and paper.processed:
                print(f"✅ Found processed paper: {paper.arxiv_id} - {paper.title}")
                
                try:
                    # Determine the query to use for vector search
                    search_query = request.message
                    
                    if request.query_mode == "enhanced":
                        print(f"🚀 ENHANCED MODE: Improving query for vector search...")
                        # Use Sonar model to enhance the query for better vector search
                        enhancement_prompt = f"""You are a research assistant helping to improve search queries for academic papers. 

Original user question: "{request.message}"

Paper context: This is about the paper "{paper.title}" (arXiv:{paper.arxiv_id}).

Task: Rewrite the user's question to be more specific and effective for semantic search in academic content. Focus on:
1. Using technical terminology that would appear in academic papers
2. Expanding abbreviations and adding relevant keywords
3. Making the query more specific to academic/research context
4. Keeping the core intent but making it more searchable

Return ONLY the improved search query, nothing else."""

                        try:
                            enhancement_response = llm_service._call_perplexity_api(
                                enhancement_prompt,
                                "You are a helpful research assistant that improves search queries.",
                                model="sonar",  # Use basic sonar for query enhancement
                                stream=False
                            )
                            
                            if enhancement_response and enhancement_response.get("content"):
                                search_query = enhancement_response["content"].strip()
                                print(f"✅ Enhanced query: '{search_query}'")
                            else:
                                print(f"⚠️ Query enhancement failed, using original query")
                                search_query = request.message
                        except Exception as e:
                            print(f"⚠️ Query enhancement error: {str(e)}, using original query")
                            search_query = request.message
                    else:
                        print(f"🔍 RAW MODE: Using original query for vector search")
                    
                    # Get query embedding
                    print(f"🔤 Getting embedding for search query: '{search_query[:100]}...'")
                    query_embedding = get_embedding(search_query, title=f"Query for paper {paper.arxiv_id}")
                    print(f"✅ Generated embedding with dimension: {len(query_embedding) if query_embedding else 'None'}")
                    
                    # Get the paper's collection
                    collection_name = f"paper_{paper.arxiv_id}"
                    print(f"🗂️  Getting collection: {collection_name}")
                    collection = chroma_client.get_collection(name=collection_name)
                    collection_count = collection.count()
                    print(f"✅ Collection found with {collection_count} documents")
                    
                    # Query the collection
                    total_results = max(request.content_chunks + request.section_chunks * 2, 20)
                    print(f"🔍 Querying collection for {total_results} results...")
                    results = collection.query(
                        query_embeddings=[query_embedding],
                        n_results=total_results,
                        include=['documents', 'metadatas', 'distances']
                    )
                    
                    result_count = len(results['documents'][0]) if results['documents'] and results['documents'][0] else 0
                    print(f"✅ Retrieved {result_count} results from vector search")
                    
                    # Process RAG results (same logic as streaming)
                    content_results = []
                    section_results = []
                    
                    print(f"\n📋 PROCESSING SEARCH RESULTS...")
                    if results['documents'] and results['documents'][0]:
                        for i in range(len(results['documents'][0])):
                            result = {
                                'document': results['documents'][0][i],
                                'metadata': results['metadatas'][0][i],
                                'similarity_score': 1 - results['distances'][0][i]
                            }
                            
                            content_type = result['metadata'].get('type', 'content')
                            similarity_pct = result['similarity_score'] * 100
                            
                            if content_type == 'content':
                                content_results.append(result)
                                print(f"  📄 Content chunk {len(content_results)}: {similarity_pct:.1f}% similarity")
                            elif content_type in ['section', 'subsection']:
                                section_results.append(result)
                                section_title = result['metadata'].get('section_title', 'Unknown')
                                print(f"  📑 Section '{section_title}': {similarity_pct:.1f}% similarity")
                    
                    # Limit results
                    original_content_count = len(content_results)
                    original_section_count = len(section_results)
                    content_results = content_results[:request.content_chunks]
                    section_results = section_results[:request.section_chunks]
                    
                    print(f"📊 Results filtered: {len(content_results)}/{original_content_count} content, {len(section_results)}/{original_section_count} sections")
                    
                    # Build context and sources (same logic as streaming)
                    if content_results:
                        context_content += "\n=== RAW EXTRACTED TEXT ===\n"
                        for idx, result in enumerate(content_results):
                            metadata = result['metadata']
                            chunk_index = int(metadata.get('chunk_index', idx))
                            estimated_page = metadata.get('estimated_page', 'N/A')
                            
                            context_content += f"\n[C{idx + 1}] Raw Content Chunk {chunk_index + 1} (Est. Page {estimated_page}):\n{result['document']}\n"
                            sources.append({
                                'index': f"C{idx + 1}",
                                'type': 'content',
                                'title': f'Raw Content Chunk {chunk_index + 1}',
                                'chunk_index': chunk_index,
                                'estimated_page': estimated_page,
                                'similarity_score': result['similarity_score'],
                                'text': result['document'][:200] + '...' if len(result['document']) > 200 else result['document'],
                                'full_text': result['document'],  # Keep full text for highlighting
                                'arxiv_id': paper.arxiv_id
                            })
                    
                    if section_results:
                        context_content += "\n=== STRUCTURED SECTIONS ===\n"
                        for idx, result in enumerate(section_results):
                            metadata = result['metadata']
                            content_type = metadata.get('type', 'section')
                            
                            if content_type == 'section':
                                source_info = f"Section: {metadata.get('section_title', 'Unknown')}"
                                section_id = metadata.get('section_id', '')
                            elif content_type == 'subsection':
                                source_info = f"Subsection: {metadata.get('subsection_title', 'Unknown')} (under {metadata.get('section_title', 'Unknown')})"
                                section_id = metadata.get('subsection_id', '')
                            
                            page_number = metadata.get('page_number', 'N/A')
                            if page_number != 'N/A':
                                source_info += f" (Page {page_number})"
                            
                            context_content += f"\n[S{idx + 1}] {source_info}:\n{result['document']}\n"
                            sources.append({
                                'index': f"S{idx + 1}",
                                'type': content_type,
                                'title': metadata.get('section_title') or metadata.get('subsection_title', 'Section'),
                                'section_id': section_id,
                                'page_number': page_number,
                                'similarity_score': result['similarity_score'],
                                'text': result['document'][:200] + '...' if len(result['document']) > 200 else result['document'],
                                'full_text': result['document'],  # Keep full text for highlighting
                                'arxiv_id': paper.arxiv_id
                            })
                    
                    print(f"\n🧠 RAG CONTEXT PREPARED:")
                    print(f"Context length: {len(context_content)} characters")
                    print(f"Sources prepared: {len(sources)}")
                    
                    # Prepare RAG prompt
                    answer_prompt = f"""You are a helpful research assistant. Answer the user's question about this academic paper based on the provided context.

User Question: {request.message}

Context from Paper {paper.arxiv_id} - {paper.title}:
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
                    
                except Exception as rag_error:
                    print(f"❌ Error in RAG processing: {str(rag_error)}")
                    import traceback
                    traceback.print_exc()
                    answer_prompt = f"I encountered an error while processing the paper content. Please answer this general question: {request.message}"
                    sources = []
            else:
                print(f"❌ Paper not processed or not found")
                answer_prompt = f"The paper is not yet processed. Please answer this general question: {request.message}"
                sources = []
        else:
            print(f"\n💬 USING GENERAL MODE - No paper selected")
            answer_prompt = request.message
            sources = []
        
        # Prepare system prompt
        system_prompt = "You are a helpful research assistant specializing in academic paper analysis. Provide accurate, well-sourced answers."
        
        print(f"🤖 CALLING PERPLEXITY API (Non-streaming)...")
        print(f"Model: {request.model}")
        print(f"Prompt length: {len(answer_prompt)} characters")
        
        # Get response from Perplexity
        perplexity_result = llm_service._call_perplexity_api(
            answer_prompt, 
            system_prompt, 
            model=request.model, 
            stream=False
        )
        
        answer = perplexity_result["content"]
        citations = perplexity_result.get("citations", [])
        images = perplexity_result.get("images", [])
        
        print(f"✅ Received response from Perplexity:")
        print(f"Response length: {len(answer)} characters")
        print(f"Citations: {len(citations)}")
        print(f"Images: {len(images)}")
        
        # Extract chain of thought for reasoning models
        if request.model in ["sonar-reasoning", "sonar-reasoning-pro"]:
            chain_of_thought, answer = llm_service._extract_chain_of_thought(answer)
            print(f"Chain of thought extracted: {len(chain_of_thought) if chain_of_thought else 0} characters")

    except Exception as e:
        print(f"❌ Error generating response: {str(e)}")
        import traceback
        traceback.print_exc()
        answer = "I encountered an error while processing your question. Please try again."
        sources = []
        citations = []
        images = []
        chain_of_thought = ""

    # Save assistant message
    assistant_message = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=answer,
        chain_of_thought=chain_of_thought,
        sources=json.dumps(sources) if sources else None,
        citations=json.dumps(citations) if citations else None,
        images=json.dumps(images) if images else None,
        highlighted_images=json.dumps(highlighted_images) if highlighted_images else None,
        model_used=request.model
    )
    db.add(assistant_message)
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assistant_message)
    
    print(f"✅ Saved assistant message to database with ID: {assistant_message.id}")

    return {
        "user_message": {
            "id": None,  # User message was already saved
            "role": "user",
            "content": request.message,
            "created_at": datetime.utcnow().isoformat()
        },
        "assistant_message": {
            "id": assistant_message.id,
            "role": "assistant",
            "content": answer,
            "chain_of_thought": chain_of_thought,
            "sources": sources,
            "citations": citations,
            "images": images,
            "highlighted_images": highlighted_images,
            "model_used": request.model,
            "created_at": assistant_message.created_at.isoformat()
        }
    }
