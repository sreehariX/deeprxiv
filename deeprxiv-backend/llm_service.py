import os
from google import genai
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

# Configure the Gemini API
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

class LLMService:
    def __init__(self):
        self.client = client
        self.model = 'gemini-2.5-flash-preview-04-17'
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
        
        print("Sending metadata extraction request to Gemini Flash model...")
        try:
            response = self.client.models.generate_content(
                model=self.flash_model,
                contents=prompt
            )
            print(f"Received response from Gemini (length: {len(response.text)})")
            return response.text
        except Exception as e:
            print(f"Error extracting metadata with Flash: {str(e)}")
            print(f"Prompt length: {len(prompt)}")
            return '{{"Title": "Unknown Title", "Authors": ["Unknown Author"], "Abstract": "No abstract available"}}'
    
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
    
    def generate_paper_sections(self, paper_text):
        """
        Generate sections and subsections for a paper based on its content.
        Returns a structured JSON representing the paper's organization.
        """
        prompt = f"""
        You are an academic paper analyzer. I'm providing you with the text of a scientific paper.
        Please analyze this paper and create a structured outline with sections and subsections, similar to a wiki.

        Your output should be a valid JSON array with this structure:
        [
            {{
                "id": "unique-id-for-section",
                "title": "Section Title",
                "content": "Summary of this section's content",
                "subsections": [
                    {{
                        "id": "unique-id-for-subsection",
                        "title": "Subsection Title",
                        "content": "Detailed content for this subsection"
                    }}
                ]
            }}
        ]

        For each section and subsection:
        - "id" should be a slug-like identifier (lowercase, hyphens for spaces)
        - "title" should reflect the actual section name from the paper or a logical name
        - "content" should summarize the key points, findings, or information
        
        Include all major sections like:
        - Introduction/Overview
        - Background/Related Work
        - Methodology
        - Results/Evaluation
        - Discussion
        - Conclusion

        The paper text:

        {paper_text[:50000]}  # Using first 50k characters to stay within token limits
        """
        
        print("Sending section generation request to Gemini model...")
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt
            )
            
            # Process the response to ensure it's valid JSON
            result = response.text
            print(f"Received raw response from Gemini (length: {len(result)})")
            
            if result.startswith("```json"):
                result = result.replace("```json", "", 1)
                if result.endswith("```"):
                    result = result[:-3]
                result = result.strip()
                print("Cleaned JSON response")
            
            # Parse and validate the JSON
            sections = json.loads(result.strip())
            print(f"Successfully parsed JSON response with {len(sections)} sections")
            return sections
        except Exception as e:
            print(f"Error generating paper sections: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Return a basic structure in case of error
            return [
                {
                    "id": "overview",
                    "title": "Overview",
                    "content": "Paper content could not be automatically sectioned.",
                    "subsections": []
                }
            ]
    
    def generate_section_content(self, paper_text, section_title, section_content):
        """
        Generate detailed content for a specific section or subsection.
        Uses the section title and existing content as context.
        """
        prompt = f"""
        You are analyzing a scientific paper section titled "{section_title}".
        
        I have identified this section in the paper with the following initial content:
        "{section_content}"
        
        Please provide a detailed analysis and summary of this section. Include:
        1. The key points and arguments presented
        2. Any methods or techniques described
        3. Important findings or results
        4. Implications of the information in this section
        
        Use clear, concise language and maintain the academic tone of the paper.
        Format your response as plain text that could be displayed in a wiki-like interface.
        
        Here is the paper text for context:
        
        {paper_text[:30000]}  # Using first 30k characters to stay within token limits
        """
        
        print(f"Generating content for section/subsection: {section_title}")
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt
            )
            result = response.text
            print(f"Generated content length: {len(result)} characters")
            return result
        except Exception as e:
            print(f"Error generating section content for '{section_title}': {str(e)}")
            return f"Content generation for section '{section_title}' failed due to: {str(e)}" 