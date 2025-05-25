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

# Track progress for each paper
paper_processing_status = {}

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
import { ArrowLeft, Image as ImageIcon, ExternalLink, X, Play } from 'lucide-react';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

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

export default function PaperPage() {
  const [activeContent, setActiveContent] = useState('');
  const [activeTab, setActiveTab] = useState<'images' | 'sources'>('sources');
  const [imagesData, setImagesData] = useState<ImageData[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [youtubeModal, setYoutubeModal] = useState<{ isOpen: boolean; videoId: string | null }>({
    isOpen: false,
    videoId: null
  });
  
  // Fetch images from API
  useEffect(() => {
    const fetchImages = async () => {
      try {
        setImagesLoading(true);
        const response = await fetch(`http://localhost:8000/api/images/${paperData.arxiv_id}`);
        if (response.ok) {
          const images = await response.json();
          setImagesData(images);
          // If images are available, switch to images tab
          if (images && images.length > 0) {
            setActiveTab('images');
          }
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

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="bg-white sticky top-0 z-50 border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center text-blue-600 hover:text-blue-700">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-800 lowercase">deeprxiv</h1>
              <span className="text-lg text-gray-600 font-medium truncate max-w-md">
                {paperData.title}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-0 py-0">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-0 min-h-screen">
          {/* Left Sidebar - Navigation with All Subsections Visible */}
          <aside className="lg:col-span-1 bg-white p-6 border-r border-gray-200">
            <div className="sticky top-20">
              <nav className="space-y-2">
                {sectionsData?.map((section) => (
                  <div key={section.id} className="space-y-1">
                    {/* Main Section */}
                    <button
                      onClick={() => setActiveContent(section.id)}
                      className={`block w-full text-left px-4 py-3 rounded-md transition-colors text-sm font-medium ${
                        activeContent === section.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="truncate" title={section.title}>
                        {section.title}
                      </div>
                    </button>
                    
                    {/* All Subsections - Always Visible */}
                    {section.subsections && section.subsections.length > 0 && (
                      <div className="ml-4 space-y-1">
                        {section.subsections.map((subsection) => (
                          <button
                            key={subsection.id}
                            onClick={() => setActiveContent(subsection.id)}
                            className={`block w-full text-left px-3 py-2 rounded-md text-sm transition-colors border-l-2 ${
                              activeContent === subsection.id
                                ? 'border-blue-400 bg-blue-25 text-blue-600'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
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
          <div className="lg:col-span-3 bg-white p-6">
            {currentContent && (
              <>
                <h3 className="text-2xl font-semibold text-gray-800 mb-2">
                  {currentContent.content.title}
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  arXiv:{paperData.arxiv_id} • {paperData.authors}
                  {currentContent.content.page_number && (
                    <span> • Page {currentContent.content.page_number}</span>
                  )}
                </p>
                
                {/* Content - Same formatting for sections and subsections */}
                <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    className="prose prose-gray max-w-none"
                    components={{
                      // Enhanced LaTeX and content rendering
                      p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
                      h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 text-gray-900">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-semibold mb-3 text-gray-800">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-medium mb-2 text-gray-700">{children}</h3>,
                      h4: ({ children }) => <h4 className="text-base font-medium mb-2 text-gray-700">{children}</h4>,
                      h5: ({ children }) => <h5 className="text-sm font-medium mb-2 text-gray-700">{children}</h5>,
                      h6: ({ children }) => <h6 className="text-sm font-medium mb-2 text-gray-700">{children}</h6>,
                      code: ({ inline, children }) => 
                        inline ? (
                          <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800">
                            {children}
                          </code>
                        ) : (
                          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto my-4">
                            <code className="text-sm font-mono text-gray-800">{children}</code>
                          </pre>
                        ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4">
                          {children}
                        </blockquote>
                      ),
                      ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border border-gray-300">{children}</table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="border border-gray-300 px-4 py-2 bg-gray-100 font-semibold text-left">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-gray-300 px-4 py-2">{children}</td>
                      ),
                      // Enhanced math rendering
                      div: ({ className, children }) => {
                        if (className?.includes('math')) {
                          return <div className={`${className} my-4 text-center`}>{children}</div>;
                        }
                        return <div className={className}>{children}</div>;
                      },
                      span: ({ className, children }) => {
                        if (className?.includes('math')) {
                          return <span className={`${className} mx-1`}>{children}</span>;
                        }
                        return <span className={className}>{children}</span>;
                      }
                    }}
                  >
                    {currentContent.content.content}
                  </ReactMarkdown>
                </div>
              </>
            )}
          </div>

          {/* Right Sidebar - Images and Sources */}
          <aside className="lg:col-span-1 bg-white p-6 border-l border-gray-200">
            <div className="sticky top-20">
              {/* Tab Buttons */}
              <div className="flex mb-4 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('images')}
                  className={`flex-1 py-2 px-4 text-center font-medium transition-colors border-b-2 ${
                    activeTab === 'images'
                      ? 'text-blue-700 border-blue-700 font-semibold'
                      : 'text-gray-600 border-transparent hover:text-gray-800'
                  }`}
                >
                  <ImageIcon className="inline-block w-4 h-4 mr-1" />
                  Images
                </button>
                <button
                  onClick={() => setActiveTab('sources')}
                  className={`flex-1 py-2 px-4 text-center font-medium transition-colors border-b-2 ${
                    activeTab === 'sources'
                      ? 'text-blue-700 border-blue-700 font-semibold'
                      : 'text-gray-600 border-transparent hover:text-gray-800'
                  }`}
                >
                  <ExternalLink className="inline-block w-4 h-4 mr-1" />
                  Sources
                </button>
              </div>

              {/* Images Tab Content */}
              {activeTab === 'images' && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Figures and tables related to the current content.
                  </p>
                  {imagesLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading images...</p>
                    </div>
                  ) : relevantImages.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {relevantImages.map((image, index) => (
                        <div
                          key={image.id || index}
                          className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors overflow-hidden group"
                          onClick={() => setSelectedImage(image)}
                        >
                          <img
                            src={image.url || `/api/image/${image.id}`}
                            alt={`Figure ${index + 1}`}
                            className="max-w-full max-h-full object-contain p-2 group-hover:scale-105 transition-transform"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No images for this content</p>
                    </div>
                  )}
                  {relevantImages.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Click on an image to enlarge.
                    </p>
                  )}
                </div>
              )}

              {/* Sources Tab Content */}
              {activeTab === 'sources' && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Citations and references mentioned in this content.
                  </p>
                  {contentCitations.length > 0 ? (
                    <div className="space-y-3">
                      {contentCitations.map((citation, index) => (
                        <div
                          key={index}
                          className="bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start space-x-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 mb-1">
                                Reference {index + 1}
                              </p>
                              <p className="text-xs text-gray-600 break-words">
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
                    <div className="text-center py-8">
                      <ExternalLink className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No citations for this content</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 