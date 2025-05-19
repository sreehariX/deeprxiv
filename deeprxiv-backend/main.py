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
            print(f"Generating sections for paper {arxiv_id}...")
            sections_response = llm_service.generate_paper_sections(paper.extracted_text)
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
                
                # Generate detailed content for the main section
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
                
                # Process subsections if they exist
                if "subsections" in section and section["subsections"]:
                    subsection_count = len(section["subsections"])
                    for j, subsection in enumerate(section["subsections"]):
                        # Update status with subsection progress
                        paper_processing_status[arxiv_id] = f"Generating content for subsection {j+1}/{subsection_count} of {section['title']}"
                        print(f"Status: {paper_processing_status[arxiv_id]}")
                        
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
            
            # Store the sections and citations data as JSON
            paper.sections_data = json.dumps({
                "sections": sections,
                "citations": citations
            })
            print(f"Successfully generated {len(sections)} sections for paper {arxiv_id}")
            
            # Save sections data to database
            db.add(paper)
            db.commit()
            db.refresh(paper)
            print("Saved sections data to database")
            
        except Exception as sections_error:
            print(f"Error generating sections: {str(sections_error)}")
            # Create a basic structure in case of error
            basic_sections = [
                {
                    "id": "overview",
                    "title": "Overview",
                    "content": paper.abstract or "Paper overview not available.",
                    "citations": [],
                    "subsections": []
                }
            ]
            paper.sections_data = json.dumps(basic_sections)
            # Save basic sections to database
            db.add(paper)
            db.commit()
            db.refresh(paper)
            print("Saved basic sections data to database")
        
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
            
            # Check if we have the new format with sections and citations
            sections = sections_data.get("sections", [])
            citations = sections_data.get("citations", [])
            
            # If we don't have the new format, try the old format
            if not isinstance(sections, list) and isinstance(sections_data, list):
                sections = sections_data
                citations = []
                
            if not sections:
                sections = [
                    {
                        "id": "overview",
                        "title": "Overview",
                        "content": paper.abstract or "Paper overview not available.",
                        "citations": [],
                        "subsections": []
                    }
                ]
        except (json.JSONDecodeError, TypeError):
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
        
        # Create page.tsx with DeepWiki-like structure and equation support
        page_content = f"""'use client';

import {{ useState, useEffect, useRef }} from 'react';
import Link from 'next/link';
import {{ 
  ArrowLeft, 
  ExternalLink, 
  Download, 
  ChevronRight, 
  ChevronDown,
  Menu,
  FileText,
  BookOpen
}} from 'lucide-react';
import Script from 'next/script';

// KaTeX CSS for equation rendering
const KatexCSS = () => (
  <>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css"
      integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn"
      crossOrigin="anonymous"
    />
  </>
);

// Paper data
const paperData = {{
  arxiv_id: '{paper.arxiv_id}',
  title: '{(paper.title or "Untitled Paper").replace("'", "\\'")}',
  authors: '{(paper.authors or "").replace("'", "\\'")}',
  abstract: '{(paper.abstract or "").replace("'", "\\'")}',
}};

// Sections data
const sectionsData = {json.dumps(sections)};

// Citations data
const citationsData = {json.dumps(citations)};

export default function PaperPage() {{
  const [activeSection, setActiveSection] = useState(sectionsData[0]?.id);
  const [activeSubsection, setActiveSubsection] = useState(null);
  const [expandedSections, setExpandedSections] = useState({{}});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const activeSectionRef = useRef(null);
  
  // Initialize section expansion state
  useEffect(() => {{
    const initialExpandedSections = {{}};
    sectionsData.forEach(section => {{
      initialExpandedSections[section.id] = true;
    }});
    setExpandedSections(initialExpandedSections);
  }}, []);
  
  // Scroll to the active section when it changes
  useEffect(() => {{
    if (activeSectionRef.current) {{
      activeSectionRef.current.scrollIntoView({{ behavior: 'smooth', block: 'start' }});
    }}
  }}, [activeSection, activeSubsection]);
  
  // Initialize KaTeX for equation rendering
  useEffect(() => {{
    const renderMathInElement = window.katex?.renderMathInElement;
    if (renderMathInElement) {{
      document.querySelectorAll('.math-content').forEach(el => {{
        renderMathInElement(el, {{
          delimiters: [
            {{ left: '$$', right: '$$', display: true }},
            {{ left: '$', right: '$', display: false }},
            {{ left: '\\\\(', right: '\\\\)', display: false }},
            {{ left: '\\\\[', right: '\\\\]', display: true }}
          ],
          throwOnError: false
        }});
      }});
    }}
  }}, [activeSection, activeSubsection]);

  // Find the active section content
  const currentSection = sectionsData.find(section => section.id === activeSection);
  const currentSubsection = activeSubsection
    ? currentSection?.subsections?.find(sub => sub.id === activeSubsection)
    : null;
  
  const contentToDisplay = currentSubsection
    ? currentSubsection.content
    : currentSection?.content;
  
  // Get citations for the current section/subsection
  const currentCitations = currentSubsection?.citations || currentSection?.citations || [];
  
  // Function to render citations
  const renderCitations = () => {{
    if (citationsData.length === 0 || currentCitations.length === 0) return null;
    
    return (
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">References</h3>
        <ol className="list-decimal pl-5 space-y-2">
          {{currentCitations.map((citationIndex) => {{
            const citation = citationsData[citationIndex];
            return (
              <li key={{citationIndex}} className="text-sm text-gray-700 dark:text-gray-300">
                <a 
                  href={{citation?.url || "#"}} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline break-words"
                >
                  {{citation?.title || citation?.url || `Citation ${{citationIndex + 1}}`}}
                </a>
              </li>
            );
          }})}}
        </ol>
      </div>
    );
  }};
  
  // Function to toggle section expansion
  const toggleSectionExpand = (sectionId) => {{
    setExpandedSections(prev => ({{
      ...prev,
      [sectionId]: !prev[sectionId]
    }}));
  }};
  
  // Function to render content with headings, lists, code blocks, and equations
  const renderContent = (content) => {{
    if (!content) return null;
    
    // Split content into paragraphs
    const paragraphs = content.split('\\n\\n');
    
    return paragraphs.map((paragraph, idx) => {{
      // Check if it's a heading with #
      if (paragraph.startsWith('# ')) {{
        const headingText = paragraph.substring(2);
        return (
          <h2 id={{`heading-${{idx}}`}} key={{idx}} className="text-xl font-bold mt-6 mb-3 text-gray-800 dark:text-gray-200">
            {{headingText}}
          </h2>
        );
      }} 
      // Check if it's a subheading with ##
      else if (paragraph.startsWith('## ')) {{
        const headingText = paragraph.substring(3);
        return (
          <h3 id={{`subheading-${{idx}}`}} key={{idx}} className="text-lg font-semibold mt-5 mb-2 text-gray-700 dark:text-gray-300">
            {{headingText}}
          </h3>
        );
      }}
      // Check if it's a list
      else if (paragraph.match(/^[*-] /m)) {{
        const listItems = paragraph.split(/\\n[*-] /);
        return (
          <ul key={{idx}} className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
            {{listItems.map((item, i) => {{
              // First item might still have the bullet
              const cleanItem = i === 0 ? item.replace(/^[*-] /, '') : item;
              return <li key={{i}} className="mb-1 math-content">{{cleanItem}}</li>;
            }})}}
          </ul>
        );
      }}
      // Check if it's a code block
      else if (paragraph.startsWith('```') && paragraph.endsWith('```')) {{
        const langMatch = paragraph.match(/^```(\\w+)/);
        const language = langMatch ? langMatch[1] : '';
        const code = paragraph.substring(3 + language.length, paragraph.length - 3);
        
        return (
          <div key={{idx}} className="bg-gray-100 dark:bg-gray-800/50 rounded-md p-3 my-4 overflow-x-auto font-mono text-sm">
            {{language && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-sans">{{language}}</div>
            )}}
            <pre>{{code}}</pre>
          </div>
        );
      }}
      // Regular paragraph with math support
      else {{
        return (
          <p key={{idx}} className="mb-4 text-gray-700 dark:text-gray-300 math-content leading-relaxed">
            {{paragraph}}
          </p>
        );
      }}
    }});
  }};
  
  return (
    <>
      <KatexCSS />
      <Script
        src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"
        integrity="sha384-cpW21h6RZv/phavutF+AuVYrr+dA8xD9zs6FwLpaCct6O9ctzYFfFr4dgmgccOTx"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"
        integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />

      <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
        {{/* Header */}}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/" 
                className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                <span className="font-medium">DeepRxiv</span>
              </Link>
              
              <div className="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
                {{paperData.arxiv_id}}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <a 
                href={{`https://arxiv.org/abs/${{paperData.arxiv_id}}`}}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                <span>arXiv</span>
              </a>
              
              <a 
                href={{`https://arxiv.org/pdf/${{paperData.arxiv_id}}.pdf`}}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>PDF</span>
              </a>
              
              <button 
                onClick={{() => setSidebarOpen(!sidebarOpen)}}
                className="md:hidden inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {{/* Left sidebar with sections - collapsible on mobile */}}
          <div className={{`${{sidebarOpen ? 'block' : 'hidden'}} md:block w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto`}}>
            <div className="py-6 px-4">
              <div className="mb-6">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-3">Paper Info</h3>
                
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    arXiv ID: {{paperData.arxiv_id}}
                  </div>
                  
                  {{paperData.authors && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Authors</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                        {{paperData.authors}}
                      </div>
                    </div>
                  )}}
                </div>
              </div>
              
              <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-3">Sections</h3>
              <nav className="space-y-1">
                {{sectionsData.map(section => (
                  <div key={{section.id}} className="mb-2">
                    <div className="flex items-start">
                      <button
                        onClick={{() => toggleSectionExpand(section.id)}}
                        className="mr-1 mt-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {{expandedSections[section.id] ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}}
                      </button>
                      
                      <button
                        onClick={{() => {{
                          setActiveSection(section.id);
                          setActiveSubsection(null);
                        }}}}
                        className={{`flex w-full items-center py-1.5 text-sm font-medium rounded-md ${{
                          activeSection === section.id && !activeSubsection
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }}`}}
                      >
                        {{section.title}}
                      </button>
                    </div>
                    
                    {{/* Subsections */}}
                    {{expandedSections[section.id] && section.subsections && section.subsections.length > 0 && (
                      <div className="pl-6 mt-1 space-y-1">
                        {{section.subsections.map(subsection => (
                          <button
                            key={{subsection.id}}
                            onClick={{() => {{
                              setActiveSection(section.id);
                              setActiveSubsection(subsection.id);
                            }}}}
                            className={{`flex w-full items-center pl-2 py-1 text-xs font-medium rounded-md ${{
                              activeSection === section.id && activeSubsection === subsection.id
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }}`}}
                          >
                            <ChevronRight className="w-3 h-3 mr-1 opacity-70" />
                            {{subsection.title}}
                          </button>
                        ))}}
                      </div>
                    )}}
                  </div>
                ))}}
              </nav>
            </div>
          </div>

          {{/* Main content */}}
          <div className="flex-1 overflow-auto">
            {{/* Paper header */}}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-6">
              <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-5 text-gray-900 dark:text-white math-content">
                  {{paperData.title}}
                </h1>
                
                {{paperData.abstract && (
                  <div className="mb-4 bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 rounded-lg p-4">
                    <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-2">Abstract</h2>
                    <p className="text-sm text-gray-700 dark:text-gray-300 math-content leading-relaxed">
                      {{paperData.abstract}}
                    </p>
                  </div>
                )}}
              </div>
            </div>
            
            {{/* Section content */}}
            <div className="py-8 px-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-8">
                  <BookOpen className="w-4 h-4" />
                  <span>
                    {{currentSubsection 
                      ? `${{currentSection?.title}} / ${{currentSubsection.title}}` 
                      : currentSection?.title}}
                  </span>
                </div>
                
                <div ref={{activeSectionRef}} className="prose dark:prose-invert max-w-none">
                  <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-5">
                    {{currentSubsection ? currentSubsection.title : currentSection?.title}}
                  </h2>
                  
                  <div className="math-content">
                    {{renderContent(contentToDisplay)}}
                  </div>
                  
                  {{renderCitations()}}
                </div>
              </div>
            </div>
          </div>
          
          {{/* Right sidebar with "On this page" (TOC) - desktop only */}}
          <div className="hidden lg:block w-56 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="py-6 px-4">
              <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-3">On this page</h3>
              <nav className="space-y-1">
                <button
                  onClick={{() => {{
                    activeSectionRef.current?.scrollIntoView({{ behavior: 'smooth', block: 'start' }});
                  }}}}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 block mb-2"
                >
                  {{currentSubsection ? currentSubsection.title : currentSection?.title}}
                </button>
                
                {{/* TOC will be simpler here since we don't have the detailed content */}}
                <div className="pl-2 border-l border-gray-200 dark:border-gray-700">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {{paperData.arxiv_id}}
                    </div>
                  </div>
                </div>
              </nav>
              
              {{/* Metadata */}}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-3">Source</h3>
                
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <a 
                    href={{`https://arxiv.org/abs/${{paperData.arxiv_id}}`}}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    <span>arxiv.org/abs/{{paperData.arxiv_id}}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}}
"""
        with open(os.path.join(paper_folder, "page.tsx"), "w", encoding="utf-8") as f:
            f.write(page_content)
        
        print(f"Successfully created Next.js folder structure for paper {paper.arxiv_id}")
    except Exception as e:
        print(f"Error creating Next.js folder structure for paper {paper.arxiv_id}: {str(e)}")

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