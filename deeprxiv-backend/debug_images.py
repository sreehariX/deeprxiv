#!/usr/bin/env python3

import sqlite3
import json
import os
from pathlib import Path

def debug_images():
    """Debug image storage and paths in the database."""
    print("🔍 Debugging image storage...")
    
    try:
        # Connect to database
        conn = sqlite3.connect('deeprxiv.db')
        cursor = conn.cursor()
        
        # Get papers with images
        cursor.execute("SELECT arxiv_id, extracted_images FROM papers WHERE extracted_images IS NOT NULL AND extracted_images != '[]'")
        papers_with_images = cursor.fetchall()
        
        print(f"📊 Found {len(papers_with_images)} papers with image data")
        
        for arxiv_id, extracted_images_json in papers_with_images:
            print(f"\n📄 Paper: {arxiv_id}")
            
            try:
                # Parse the JSON
                if isinstance(extracted_images_json, str):
                    images = json.loads(extracted_images_json)
                else:
                    images = extracted_images_json or []
                
                print(f"   🖼️  Images count: {len(images)}")
                
                # Check each image
                for i, image in enumerate(images):
                    print(f"   Image {i+1}:")
                    print(f"     ID: {image.get('id', 'No ID')}")
                    print(f"     Page: {image.get('page', 'No page')}")
                    
                    image_path = image.get('path', '')
                    print(f"     Path: {image_path}")
                    
                    if image_path:
                        path_exists = os.path.exists(image_path)
                        print(f"     Path exists: {path_exists}")
                        
                        if not path_exists:
                            # Check if it's a relative vs absolute path issue
                            abs_path = os.path.abspath(image_path)
                            print(f"     Absolute path: {abs_path}")
                            print(f"     Absolute path exists: {os.path.exists(abs_path)}")
                            
                            # Check current working directory
                            cwd = os.getcwd()
                            print(f"     Current working directory: {cwd}")
                            
                            # Try to find the file in temp directories
                            possible_paths = [
                                os.path.join(cwd, 'temp', os.path.basename(image_path)),
                                os.path.join(cwd, 'pdf_processor_temp', os.path.basename(image_path)),
                                os.path.join('/tmp', os.path.basename(image_path)),
                            ]
                            
                            for possible_path in possible_paths:
                                if os.path.exists(possible_path):
                                    print(f"     ✅ Found at: {possible_path}")
                                    break
                            else:
                                print(f"     ❌ File not found in any expected location")
                    else:
                        print(f"     ❌ No path specified")
                
            except json.JSONDecodeError as e:
                print(f"   ❌ JSON decode error: {e}")
            except Exception as e:
                print(f"   ❌ Error processing images: {e}")
        
        conn.close()
        
        # Check temp directories
        print(f"\n📁 Checking temp directories:")
        temp_dirs = ['temp', 'pdf_processor_temp', '/tmp']
        
        for temp_dir in temp_dirs:
            if os.path.exists(temp_dir):
                files = os.listdir(temp_dir)
                image_files = [f for f in files if f.endswith(('.png', '.jpg', '.jpeg'))]
                print(f"   {temp_dir}: {len(image_files)} image files")
            else:
                print(f"   {temp_dir}: Directory does not exist")
        
        # Check if PDFProcessor temp directory exists
        from pdf_processor import PDFProcessor
        processor = PDFProcessor()
        temp_dir = processor.temp_dir
        print(f"\n🔧 PDFProcessor temp directory: {temp_dir}")
        print(f"   Exists: {os.path.exists(temp_dir)}")
        
        if os.path.exists(temp_dir):
            files = os.listdir(temp_dir)
            image_files = [f for f in files if f.endswith(('.png', '.jpg', '.jpeg'))]
            print(f"   Image files: {len(image_files)}")
            if image_files:
                print(f"   Sample files: {image_files[:5]}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_images() 