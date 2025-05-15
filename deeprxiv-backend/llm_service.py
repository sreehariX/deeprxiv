import os
from google import genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure the Gemini API
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

class LLMService:
    def __init__(self):
        self.client = client
        self.model = 'gemini-2.5-pro-preview-05-06'
        self.flash_model = 'gemini-2.5-flash-preview-04-17'
    
    def extract_paper_metadata_flash(self, text_first_pages):
        """
        Extract basic paper metadata using Gemini Flash model.
        Takes the text from the first few pages of the paper.
        """
        prompt = f"""
        Extract the following information from this scientific paper text:
        1. Title
        2. Authors (as an array)
        3. Abstract

        Return only a valid JSON object with these fields.

        Here is the text from the first few pages:

        {text_first_pages}
        """
        
        try:
            response = self.client.models.generate_content(
                model=self.flash_model,
                contents=prompt
            )
            return response.text
        except Exception as e:
            print(f"Error extracting metadata with Flash: {str(e)}")
            return '{{"error": "Failed to extract metadata"}}'
    
    def generate_paper_metadata(self, paper_data):
        """Generate metadata about the paper."""
        prompt = f"""
        You are a scientific paper analyzer. I'm going to provide you with the content of a research paper.
        Please extract and provide the following metadata in JSON format:
        
        1. Title
        2. Authors (as an array)
        3. Abstract
        4. Keywords (as an array)
        5. Year of publication (if available)
        6. Main research area
        
        Format your response as valid JSON.
        
        Here is the paper content:
        
        {paper_data['text'][:20000]}  # Limiting to first part of the paper
        """
        
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt
            )
            return response.text
        except Exception as e:
            print(f"Error generating metadata: {str(e)}")
            return '{{"error": "Failed to generate metadata"}}' 