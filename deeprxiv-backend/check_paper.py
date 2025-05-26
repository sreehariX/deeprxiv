#!/usr/bin/env python3

import sys
import json
import requests
from database import SessionLocal, Paper

def check_paper_status(arxiv_id):
    """Check the current status of a paper in the database."""
    db = SessionLocal()
    try:
        paper = db.query(Paper).filter(Paper.arxiv_id == arxiv_id).first()
        
        if not paper:
            print(f"❌ Paper {arxiv_id} not found in database")
            return None
            
        print(f"📄 Paper found: {paper.title or 'No title'}")
        print(f"✅ Processed: {paper.processed}")
        print(f"📝 Has PDF data: {bool(paper.pdf_data)}")
        print(f"📊 Text length: {len(paper.extracted_text) if paper.extracted_text else 0}")
        print(f"🗂️ Has sections: {bool(paper.sections_data)}")
        
        if paper.sections_data:
            try:
                sections_data = json.loads(paper.sections_data)
                if isinstance(sections_data, dict):
                    sections = sections_data.get('sections', [])
                else:
                    sections = sections_data
                print(f"📋 Number of sections: {len(sections)}")
            except:
                print("❌ Error parsing sections data")
                
        return paper
        
    finally:
        db.close()

def test_query_endpoint(arxiv_id, query, content_chunks=3, section_chunks=3):
    """Test the enhanced query endpoint."""
    url = "http://localhost:8000/api/query"
    
    payload = {
        "query": query,
        "arxiv_id": arxiv_id,
        "content_chunks": content_chunks,
        "section_chunks": section_chunks
    }
    
    print(f"\n🔍 Testing query: '{query}'")
    print(f"📊 Requesting {content_chunks} content chunks and {section_chunks} section chunks")
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        
        print(f"✅ Query successful!")
        print(f"📝 Answer length: {len(result.get('answer', ''))}")
        print(f"📄 Content results: {len(result.get('content_results', []))}")
        print(f"🗂️ Section results: {len(result.get('section_results', []))}")
        print(f"🔗 Sources: {len(result.get('sources', []))}")
        print(f"🖼️ Highlighted images: {len(result.get('highlighted_images', []))}")
        
        # Show first few characters of answer
        if result.get('answer'):
            print(f"\n📖 Answer preview: {result['answer'][:200]}...")
            
        # Show highlighted images info
        if result.get('highlighted_images'):
            print(f"\n🖼️ Highlighted Images:")
            for img in result['highlighted_images']:
                print(f"  - Page {img.get('page')}, Chunk {img.get('chunk_index')}, Score: {img.get('similarity_score', 0):.3f}")
                print(f"    URL: {img.get('url')}")
                print(f"    Preview: {img.get('text_preview', '')[:100]}...")
                
        return result
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server. Is it running on localhost:8000?")
        return None
    except Exception as e:
        print(f"❌ Error testing query: {str(e)}")
        return None

def main():
    arxiv_id = "2505.17655"
    
    print("="*60)
    print("🚀 DEEPRXIV END-TO-END TEST")
    print("="*60)
    
    # Step 1: Check paper status
    print("\n📋 STEP 1: Checking paper status...")
    paper = check_paper_status(arxiv_id)
    
    if not paper:
        print(f"\n❌ Paper {arxiv_id} not found. Please process it first.")
        return
        
    if not paper.processed:
        print(f"\n⚠️ Paper {arxiv_id} is not fully processed yet.")
        return
        
    # Step 2: Test different query scenarios
    test_queries = [
        {
            "query": "What is the main contribution of this paper?",
            "content_chunks": 3,
            "section_chunks": 2
        },
        {
            "query": "What methodology is used in this research?", 
            "content_chunks": 2,
            "section_chunks": 4
        },
        {
            "query": "What are the experimental results?",
            "content_chunks": 4,
            "section_chunks": 2
        }
    ]
    
    print("\n🔍 STEP 2: Testing query endpoint...")
    
    for i, test_case in enumerate(test_queries, 1):
        print(f"\n--- Test Query {i} ---")
        result = test_query_endpoint(arxiv_id, **test_case)
        
        if result:
            print("✅ Test passed!")
        else:
            print("❌ Test failed!")
            
        input("\nPress Enter to continue to next test...")
    
    print("\n🎉 END-TO-END TEST COMPLETED!")
    print("="*60)

if __name__ == "__main__":
    main() 