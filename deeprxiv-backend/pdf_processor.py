import os
import cv2
import numpy as np
import PyPDF2
from PIL import Image
from pdf2image import convert_from_bytes
import json
import re
import tempfile
import uuid
from io import BytesIO
from dotenv import load_dotenv

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