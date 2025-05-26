import os
import cv2
import numpy as np
import PyPDF2
from PIL import Image, ImageDraw, ImageFont
from pdf2image import convert_from_bytes
import json
import re
import tempfile
import uuid
from io import BytesIO
from dotenv import load_dotenv
import fitz  # PyMuPDF for better text extraction with coordinates

# Load environment variables
load_dotenv()

class PDFProcessor:
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
        
    def extract_text_from_pdf(self, pdf_data):
        """Extract text from PDF binary data."""
        text = ""
        try:
            # Create a PDF reader object
            pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_data))
            
            # Extract text from each page
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n\n"
                
            return text
        except Exception as e:
            print(f"Error extracting text: {str(e)}")
            return ""
    
    def extract_text_from_first_pages(self, pdf_data, num_pages=4):
        """Extract text from the first few pages of a PDF."""
        text = ""
        try:
            # Create a PDF reader object
            pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_data))
            
            # Get total number of pages
            total_pages = len(pdf_reader.pages)
            
            # Extract text from specified number of pages (or all if fewer)
            for page_num in range(min(num_pages, total_pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n\n"
                
            return text
        except Exception as e:
            print(f"Error extracting first pages: {str(e)}")
            return ""
    
    def extract_images_from_pdf(self, pdf_data):
        """Extract images from PDF binary data using pdf2image and OpenCV."""
        images_data = []
        
        try:
            # Convert PDF to images
            pages = convert_from_bytes(pdf_data)
            
            for i, page in enumerate(pages):
                # Save page as temporary image
                img_path = os.path.join(self.temp_dir, f"page_{i}.png")
                page.save(img_path, "PNG")
                
                # Read image with OpenCV
                img = cv2.imread(img_path)
                img_height, img_width = img.shape[:2]
                
                # Convert to grayscale for processing
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                
                # Apply threshold to get binary image
                _, binary = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)
                
                # Find contours
                contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                # Filter contours by size to identify potential images
                for j, contour in enumerate(contours):
                    x, y, w, h = cv2.boundingRect(contour)
                    
                    # Filter small contours
                    if w > 100 and h > 100:
                        # Expand the bounding box to include more context (axes, labels, etc.)
                        # Calculate expansion amount (greater of 20% of width/height or fixed pixels)
                        x_expansion = max(int(w * 0.20), 50)
                        y_expansion = max(int(h * 0.20), 50)
                        
                        # Create expanded coordinates
                        x_expanded = max(0, x - x_expansion)
                        y_expanded = max(0, y - y_expansion)
                        w_expanded = min(img_width - x_expanded, w + 2 * x_expansion)
                        h_expanded = min(img_height - y_expanded, h + 2 * y_expansion)
                        
                        # Extract the region with expanded bounds
                        roi = img[y_expanded:y_expanded+h_expanded, x_expanded:x_expanded+w_expanded]
                        
                        # Save the extracted image
                        image_id = str(uuid.uuid4())
                        extracted_img_path = os.path.join(self.temp_dir, f"image_{image_id}.png")
                        cv2.imwrite(extracted_img_path, roi)
                        
                        # Add to results with original and expanded position data
                        images_data.append({
                            "id": image_id,
                            "page": i,
                            "original_position": {"x": x, "y": y, "width": w, "height": h},
                            "expanded_position": {"x": x_expanded, "y": y_expanded, "width": w_expanded, "height": h_expanded},
                            "path": extracted_img_path
                        })
            
            return images_data
        except Exception as e:
            print(f"Error extracting images: {str(e)}")
            return []
    
    def process_pdf(self, pdf_data):
        """Process PDF and extract text and images."""
        result = {
            "text": self.extract_text_from_pdf(pdf_data),
            "images": self.extract_images_from_pdf(pdf_data)
        }
        return result
        
    def extract_arxiv_id(self, url):
        """Extract arXiv ID from URL."""
        # Match patterns like arxiv.org/abs/1706.03762 or arxiv.org/pdf/1706.03762
        pattern = r'arxiv\.org/(?:abs|pdf)/(\d+\.\d+)'
        match = re.search(pattern, url)
        if match:
            return match.group(1)
        return None

    def extract_text_with_coordinates(self, pdf_data):
        """Extract text with coordinates using PyMuPDF for better text positioning."""
        try:
            doc = fitz.open(stream=pdf_data, filetype="pdf")
            text_blocks = []
            
            for page_num in range(doc.page_count):
                page = doc.load_page(page_num)
                blocks = page.get_text("dict")
                
                page_text = ""
                for block in blocks["blocks"]:
                    if "lines" in block:
                        for line in block["lines"]:
                            for span in line["spans"]:
                                text = span["text"]
                                bbox = span["bbox"]  # (x0, y0, x1, y1)
                                page_text += text
                                
                                text_blocks.append({
                                    "text": text,
                                    "page": page_num,
                                    "bbox": bbox,
                                    "page_text_position": len(page_text) - len(text)
                                })
                            page_text += " "
                        page_text += "\n"
                
            doc.close()
            return text_blocks
        except Exception as e:
            print(f"Error extracting text with coordinates: {str(e)}")
            return []

    def create_highlighted_page_image(self, pdf_data, page_num, text_to_highlight, output_path):
        """Create a highlighted page image showing the specified text in yellow."""
        try:
            # Convert PDF page to image
            pages = convert_from_bytes(pdf_data, first_page=page_num+1, last_page=page_num+1, dpi=200)
            if not pages:
                print(f"No pages found for page number {page_num+1}")
                return None
                
            page_image = pages[0]
            
            # Extract text with coordinates using PyMuPDF
            doc = fitz.open(stream=pdf_data, filetype="pdf")
            
            # Check if page number is valid
            if page_num >= doc.page_count:
                print(f"Page number {page_num} is out of range. Document has {doc.page_count} pages.")
                doc.close()
                return None
                
            pdf_page = doc.load_page(page_num)
            
            # Search for text occurrences
            text_instances = []
            words_to_highlight = text_to_highlight.split()[:10]  # Limit to first 10 words for better matching
            
            for word in words_to_highlight:
                if len(word) > 3:  # Only search for words longer than 3 chars
                    instances = pdf_page.search_for(word)
                    text_instances.extend(instances)
            
            # Get page dimensions for scaling
            pdf_width = pdf_page.rect.width
            pdf_height = pdf_page.rect.height
            
            doc.close()
            
            # Convert to PIL for highlighting
            img = page_image.convert("RGBA")
            overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
            draw = ImageDraw.Draw(overlay)
            
            # Scale coordinates from PDF to image
            img_width, img_height = img.size
            
            x_scale = img_width / pdf_width
            y_scale = img_height / pdf_height
            
            # Draw highlights
            for rect in text_instances:
                x0, y0, x1, y1 = rect
                # Scale coordinates
                x0 *= x_scale
                y0 *= y_scale
                x1 *= x_scale
                y1 *= y_scale
                
                # Draw yellow highlight
                draw.rectangle([x0, y0, x1, y1], fill=(255, 255, 0, 128))  # Semi-transparent yellow
            
            # Combine original image with highlights
            highlighted_img = Image.alpha_composite(img, overlay)
            highlighted_img = highlighted_img.convert("RGB")
            
            # Save the highlighted image
            highlighted_img.save(output_path, "PNG", quality=95)
            return output_path
            
        except Exception as e:
            print(f"Error creating highlighted page image: {str(e)}")
            return None

    def generate_page_highlights_for_query(self, pdf_data, highlighted_pages):
        """Generate highlighted page images for query results."""
        highlighted_images = []
        
        # First, get the total number of pages in the PDF
        try:
            doc = fitz.open(stream=pdf_data, filetype="pdf")
            total_pages = doc.page_count
            doc.close()
        except Exception as e:
            print(f"Error getting PDF page count: {str(e)}")
            total_pages = 20  # Fallback
        
        for highlight_info in highlighted_pages:
            try:
                text = highlight_info.get('text', '')
                chunk_index = int(highlight_info.get('chunk_index', 0))
                
                # Better page estimation: use chunk index with improved calculation
                # Assume average 2-4 chunks per page, with some variation
                base_page = max(0, chunk_index // 3)  # 0-indexed
                # Cap at actual document page count
                estimated_page = min(base_page, total_pages - 1)
                
                print(f"Generating highlight for chunk {chunk_index}: estimated page {estimated_page} (0-indexed) of {total_pages} total pages")
                
                # Create highlighted image
                highlight_id = str(uuid.uuid4())
                highlight_path = os.path.join(self.temp_dir, f"highlight_{highlight_id}.png")
                
                result = self.create_highlighted_page_image(
                    pdf_data, 
                    estimated_page,  # 0-indexed for the function
                    text[:500],  # First 500 chars for highlighting
                    highlight_path
                )
                
                if result:
                    highlighted_images.append({
                        "id": highlight_id,
                        "path": highlight_path,
                        "page": estimated_page + 1,  # 1-indexed for display
                        "chunk_index": chunk_index,
                        "similarity_score": highlight_info.get('similarity_score', 0),
                        "text_preview": text[:200] + "..." if len(text) > 200 else text
                    })
                    print(f"Generated highlighted image for chunk {chunk_index} on page {estimated_page + 1}")
                else:
                    print(f"Failed to generate highlighted image for chunk {chunk_index}")
                    
            except Exception as e:
                print(f"Error generating page highlight: {str(e)}")
                continue
        
        return highlighted_images

    def cleanup(self):
        """Clean up temporary files."""
        for filename in os.listdir(self.temp_dir):
            file_path = os.path.join(self.temp_dir, filename)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                print(f"Error deleting {file_path}: {e}")
        try:
            os.rmdir(self.temp_dir)
        except Exception as e:
            print(f"Error removing directory {self.temp_dir}: {e}") 