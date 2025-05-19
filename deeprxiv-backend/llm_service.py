import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class LLMService:
    def __init__(self):
        self.api_url = "https://api.perplexity.ai/chat/completions"
        self.api_key = os.getenv("PERPLEXITY_API_KEY")
        self.model = "sonar"  # Perplexity's default model
        
        if not self.api_key:
            print("WARNING: PERPLEXITY_API_KEY environment variable not set!")
    
    def _call_perplexity_api(self, prompt, system_prompt="Be precise and concise."):
        """
        Makes a call to the Perplexity API with the given prompt.
        Returns the response text and citations.
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        
        try:
            response = requests.post(self.api_url, json=payload, headers=headers)
            response.raise_for_status()
            
            response_data = response.json()
            content = response_data["choices"][0]["message"]["content"]
            
            # Extract citations if available
            citations = response_data.get("citations", [])
            
            return {
                "content": content,
                "citations": citations
            }
        except Exception as e:
            print(f"Error calling Perplexity API: {str(e)}")
            if response and hasattr(response, 'text'):
                print(f"Response text: {response.text}")
            return {
                "content": f"Error: {str(e)}",
                "citations": []
            }
    
    def extract_paper_metadata_flash(self, text_first_pages):
        """
        Extract basic paper metadata using Perplexity API.
        Takes the text from the first few pages of the paper.
        """
        system_prompt = "Extract metadata from the scientific paper text and provide the result as a valid JSON object."
        
        prompt = f"""
        Extract the following information from this scientific paper text:
        1. Title
        2. Authors (as an array)
        3. Abstract

        Return only a valid JSON object with these fields.

        Here is the text from the first few pages:

        {text_first_pages}
        """
        
        print("Sending metadata extraction request to Perplexity API...")
        try:
            result = self._call_perplexity_api(prompt, system_prompt)
            
            # Try to extract JSON from the response
            content = result["content"]
            print(f"Received response from Perplexity (length: {len(content)})")
            
            # Sometimes the model might wrap the JSON in markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
                
            return content
        except Exception as e:
            print(f"Error extracting metadata: {str(e)}")
            return '{{"Title": "Unknown Title", "Authors": ["Unknown Author"], "Abstract": "No abstract available"}}'
    
    def generate_paper_metadata(self, paper_data):
        """Generate metadata about the paper."""
        system_prompt = "You are a scientific paper analyzer. Extract metadata in valid JSON format."
        
        prompt = f"""
        I'm going to provide you with the content of a research paper.
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
            result = self._call_perplexity_api(prompt, system_prompt)
            return result["content"]
        except Exception as e:
            print(f"Error generating metadata: {str(e)}")
            return '{{"error": "Failed to generate metadata"}}'
    
    def generate_paper_sections(self, paper_text):
        """
        Generate sections and subsections for a paper based on its content.
        Returns a structured JSON representing the paper's organization along with citations.
        """
        system_prompt = "You are an academic paper analyzer. Create a structured outline in valid JSON format."
        
        prompt = f"""
        I'm providing you with the text of a scientific paper.
        Please analyze this paper and create a structured outline with sections and subsections, similar to a wiki.

        Your output should be a valid JSON array with this structure:
        [
            {{
                "id": "unique-id-for-section",
                "title": "Section Title",
                "content": "Summary of this section's content",
                "citations": [1, 2, 3], // Reference indices to the citations you provide
                "subsections": [
                    {{
                        "id": "unique-id-for-subsection",
                        "title": "Subsection Title",
                        "content": "Detailed content for this subsection",
                        "citations": [2, 4] // Reference indices to the citations you provide
                    }}
                ]
            }}
        ]

        For each section and subsection:
        - "id" should be a slug-like identifier (lowercase, hyphens for spaces)
        - "title" should reflect the actual section name from the paper or a logical name
        - "content" should summarize the key points, findings, or information
        - "citations" should include references to support the content
        
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
        
        print("Sending section generation request to Perplexity API...")
        try:
            result = self._call_perplexity_api(prompt, system_prompt)
            
            # Process the response to ensure it's valid JSON
            content = result["content"]
            citations = result["citations"]
            
            print(f"Received raw response from Perplexity (length: {len(content)})")
            
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            # Parse and validate the JSON
            sections = json.loads(content.strip())
            print(f"Successfully parsed JSON response with {len(sections)} sections")
            
            # Add citations to the response
            response_with_citations = {
                "sections": sections,
                "citations": citations
            }
            
            return response_with_citations
        except Exception as e:
            print(f"Error generating paper sections: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Return a basic structure in case of error
            return {
                "sections": [
                    {
                        "id": "overview",
                        "title": "Overview",
                        "content": "Paper content could not be automatically sectioned.",
                        "citations": [],
                        "subsections": []
                    }
                ],
                "citations": []
            }
    
    def generate_section_content(self, paper_text, section_title, section_content):
        """
        Generate detailed content for a specific section or subsection.
        Uses the section title and existing content as context.
        Returns the content and citations.
        """
        system_prompt = "You are analyzing a scientific paper section. Provide a detailed analysis with citations."
        
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
            result = self._call_perplexity_api(prompt, system_prompt)
            content = result["content"]
            citations = result["citations"]
            
            print(f"Generated content length: {len(content)} characters")
            
            return {
                "content": content,
                "citations": citations
            }
        except Exception as e:
            print(f"Error generating section content for '{section_title}': {str(e)}")
            return {
                "content": f"Content generation for section '{section_title}' failed due to: {str(e)}",
                "citations": []
            } 