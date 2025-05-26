#!/usr/bin/env python3

import sys
import json
import chromadb
import uuid
from database import SessionLocal, Paper
from google import genai
from google.genai.types import EmbedContentConfig
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

def get_embedding(text: str, title="DeepRxiv Paper"):
    """Generate embeddings using Google's text-embedding-004 model."""
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    response = client.models.embed_content(
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

def reindex_paper_content(arxiv_id: str, content: str, sections: list = None):
    """Re-index paper content with enhanced metadata including page estimation."""
    try:
        print(f"🔄 Re-indexing paper {arxiv_id}...")
        
        # Initialize ChromaDB
        chroma_client = chromadb.PersistentClient(path="deeprxiv_chroma_db")
        
        # Delete existing collection if it exists
        try:
            chroma_client.delete_collection(name=f"paper_{arxiv_id}")
            print(f"🗑️ Deleted existing collection for paper {arxiv_id}")
        except Exception:
            print(f"ℹ️ No existing collection found for paper {arxiv_id}")
        
        # Create new collection
        collection = chroma_client.get_or_create_collection(
            name=f"paper_{arxiv_id}",
            metadata={"hnsw:space": "cosine"}
        )
        print(f"✅ Created new collection for paper {arxiv_id}")
        
        documents = []
        embeddings = []
        metadatas = []
        ids_list = []
        
        # Index main content chunks with better page estimation
        content_chunks = split_content_by_tokens(content)
        chars_per_page = len(content) / max(20, 1)  # Estimate chars per page, assume at least 20 pages
        
        print(f"📄 Processing {len(content_chunks)} content chunks...")
        
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
                print(f"  ✅ Indexed content chunk {i+1}/{len(content_chunks)} (est. page {estimated_page})")
            except Exception as e:
                print(f"  ❌ Error indexing content chunk {i+1}: {str(e)}")
        
        # Index sections if available
        if sections:
            print(f"🗂️ Processing {len(sections)} sections...")
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
                                print(f"  ✅ Indexed section '{section.get('title', 'Unknown')}' chunk {i+1}/{len(section_chunks)}")
                            except Exception as e:
                                print(f"  ❌ Error indexing section chunk: {str(e)}")
                        
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
                                        print(f"  ✅ Indexed subsection '{subsection.get('title', 'Unknown')}' chunk {i+1}/{len(subsection_chunks)}")
                                    except Exception as e:
                                        print(f"  ❌ Error indexing subsection chunk: {str(e)}")
                except Exception as e:
                    print(f"  ❌ Error processing section: {str(e)}")
        
        # Upsert all documents to ChromaDB
        if documents:
            collection.upsert(
                ids=ids_list,
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas
            )
            print(f"🎉 Successfully re-indexed {len(documents)} chunks for paper {arxiv_id}")
            
            # Show summary
            content_count = len([m for m in metadatas if m['type'] == 'content'])
            section_count = len([m for m in metadatas if m['type'] == 'section'])
            subsection_count = len([m for m in metadatas if m['type'] == 'subsection'])
            
            print(f"📊 Summary:")
            print(f"  - Content chunks: {content_count}")
            print(f"  - Section chunks: {section_count}")
            print(f"  - Subsection chunks: {subsection_count}")
            print(f"  - Total chunks: {len(documents)}")
        
    except Exception as e:
        print(f"❌ Error re-indexing paper {arxiv_id}: {str(e)}")
        import traceback
        traceback.print_exc()

def main():
    arxiv_id = "2505.17655"
    
    print("="*60)
    print("🔄 DEEPRXIV PAPER RE-INDEXING")
    print("="*60)
    
    # Get paper from database
    db = SessionLocal()
    try:
        paper = db.query(Paper).filter(Paper.arxiv_id == arxiv_id).first()
        
        if not paper:
            print(f"❌ Paper {arxiv_id} not found in database")
            return
            
        print(f"📄 Found paper: {paper.title or 'No title'}")
        
        if not paper.extracted_text:
            print(f"❌ Paper {arxiv_id} has no extracted text")
            return
            
        if not paper.sections_data:
            print(f"⚠️ Paper {arxiv_id} has no sections data")
            sections = None
        else:
            try:
                sections_data = json.loads(paper.sections_data)
                if isinstance(sections_data, dict):
                    sections = sections_data.get('sections', [])
                else:
                    sections = sections_data
                print(f"🗂️ Found {len(sections)} sections")
            except Exception as e:
                print(f"❌ Error parsing sections: {str(e)}")
                sections = None
        
        # Re-index the paper
        reindex_paper_content(arxiv_id, paper.extracted_text, sections)
        print(f"\n✅ Re-indexing completed for paper {arxiv_id}")
        
    finally:
        db.close()

if __name__ == "__main__":
    main() 