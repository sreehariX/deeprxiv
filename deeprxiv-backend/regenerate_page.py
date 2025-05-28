#!/usr/bin/env python3

import os
import sys
import json

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, Paper
from main import create_nextjs_folder_structure

def regenerate_paper_page(arxiv_id):
    """Regenerate the page.tsx for a specific paper"""
    db = SessionLocal()
    try:
        paper = db.query(Paper).filter(Paper.arxiv_id == arxiv_id).first()
        if not paper:
            print(f"Paper {arxiv_id} not found in database")
            return False
        
        print(f"Regenerating page for paper: {paper.title}")
        create_nextjs_folder_structure(paper)
        print(f"Successfully regenerated page for {arxiv_id}")
        return True
    except Exception as e:
        print(f"Error regenerating page: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        arxiv_id = sys.argv[1]
    else:
        arxiv_id = "1706.03762"  # Default paper
    
    regenerate_paper_page(arxiv_id) 