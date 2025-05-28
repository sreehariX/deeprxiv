import os
import requests
import json
from dotenv import load_dotenv
import re
from typing import Dict, Any, List, Generator, Optional

# Load environment variables
load_dotenv()

class LLMService:
    def __init__(self):
        # Initialize Perplexity API only
        self.api_url = "https://api.perplexity.ai/chat/completions"
        self.perplexity_api_key = os.getenv("PERPLEXITY_API_KEY")
        self.model = "sonar"  # Default model
        
        # Available Perplexity models
        self.available_models = {
            "sonar": {
                "name": "Sonar",
                "description": "A lightweight, cost-effective search model optimized for quick, grounded answers with real-time web search.",
                "type": "Non-reasoning",
                "context_length": "128k",
                "features": ["Real-time web search", "Fast responses", "Cost effective"]
            },
            "sonar-pro": {
                "name": "Sonar Pro", 
                "description": "An advanced search model designed for complex queries, delivering deeper content understanding with enhanced citation accuracy.",
                "type": "Non-reasoning",
                "context_length": "200k",
                "features": ["2x more citations", "Advanced information retrieval", "Multi-step tasks"]
            },
            "sonar-reasoning": {
                "name": "Sonar Reasoning",
                "description": "A reasoning-focused model that applies Chain-of-Thought (CoT) reasoning for quick problem-solving and structured analysis.",
                "type": "Reasoning",
                "context_length": "128k", 
                "features": ["Chain-of-thought reasoning", "Real-time search", "Problem solving"]
            },
            "sonar-reasoning-pro": {
                "name": "Sonar Reasoning Pro",
                "description": "A high-performance reasoning model leveraging advanced multi-step CoT reasoning and enhanced information retrieval.",
                "type": "Reasoning",
                "context_length": "128k",
                "features": ["Enhanced CoT reasoning", "2x more citations", "Complex topics"]
            }
        }
        
        if not self.perplexity_api_key:
            print("WARNING: PERPLEXITY_API_KEY environment variable not set!")
    
    def set_model(self, model: str):
        """Set the model to use for API calls."""
        if model in self.available_models:
            self.model = model
        else:
            raise ValueError(f"Model {model} not available. Available models: {list(self.available_models.keys())}")
    
    def get_available_models(self):
        """Get list of available models with their descriptions."""
        return self.available_models
    
    def _call_perplexity_api(self, prompt, system_prompt="Be precise and concise.", model=None, stream=False):
        """
        Makes a call to the Perplexity API with the given prompt.
        Returns the response text and citations.
        Supports streaming if stream=True.
        """
        current_model = model or self.model
        
        print(f"\n🚀 PERPLEXITY API CALL")
        print(f"Model: {current_model}")
        print(f"Stream: {stream}")
        print(f"System prompt: {system_prompt[:100]}...")
        print(f"User prompt length: {len(prompt)} characters")
        print(f"User prompt preview: {prompt[:200]}...")
        
        headers = {
            "Authorization": f"Bearer {self.perplexity_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": current_model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "stream": stream,
            "return_images": True,
            "return_related_questions": False,
            "temperature": 0.2,
            "top_p": 0.9
        }
        
        try:
            print(f"📡 Sending request to Perplexity...")
            
            if stream:
                return self._handle_streaming_response(headers, payload)
            else:
                response = requests.post(self.api_url, json=payload, headers=headers)
                response.raise_for_status()
                
                response_data = response.json()
                content = response_data["choices"][0]["message"]["content"]
                
                # Extract citations if available
                citations = response_data.get("citations", [])
                
                # Extract images if available (new feature)
                images = response_data.get("images", [])
                
                print(f"✅ Perplexity response received:")
                print(f"Content length: {len(content)} characters")
                print(f"Citations count: {len(citations)}")
                print(f"Images count: {len(images)}")
                print(f"Response preview: {content[:300]}...")
                
                return {
                    "content": content,
                    "citations": citations,
                    "images": images,
                    "model_used": current_model
                }
        except Exception as e:
            print(f"❌ Error calling Perplexity API: {str(e)}")
            if 'response' in locals() and hasattr(response, 'text'):
                print(f"Response text: {response.text}")
            if 'response' in locals() and hasattr(response, 'status_code'):
                print(f"Status code: {response.status_code}")
            return {
                "content": f"Error: {str(e)}",
                "citations": [],
                "images": [],
                "model_used": current_model
            }
    
    def _handle_streaming_response(self, headers, payload):
        """Handle streaming response from Perplexity API."""
        try:
            response = requests.post(self.api_url, json=payload, headers=headers, stream=True)
            response.raise_for_status()
            
            def generate_chunks():
                citations = []
                images = []
                model_used = payload["model"]
                full_response_data = None
                
                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data: '):
                            line = line[6:]  # Remove 'data: ' prefix
                            
                            if line.strip() == '[DONE]':
                                break
                                
                            try:
                                chunk_data = json.loads(line)
                                
                                # Store the full response data for final metadata extraction
                                full_response_data = chunk_data
                                
                                # Extract content delta
                                if 'choices' in chunk_data and len(chunk_data['choices']) > 0:
                                    delta = chunk_data['choices'][0].get('delta', {})
                                    content = delta.get('content', '')
                                    
                                    if content:
                                        yield {
                                            "type": "content",
                                            "content": content
                                        }
                                
                                # Extract metadata from any chunk that has it
                                if 'citations' in chunk_data:
                                    citations = chunk_data['citations']
                                if 'images' in chunk_data:
                                    images = chunk_data['images']
                                    
                            except json.JSONDecodeError:
                                continue
                
                # Extract final metadata from the complete response
                if full_response_data:
                    # Try to get citations and images from the final response
                    if 'citations' in full_response_data:
                        citations = full_response_data['citations']
                    if 'images' in full_response_data:
                        images = full_response_data['images']
                    
                    # Also check in the message content for citations
                    if 'choices' in full_response_data and len(full_response_data['choices']) > 0:
                        message = full_response_data['choices'][0].get('message', {})
                        if 'citations' in message:
                            citations = message['citations']
                        if 'images' in message:
                            images = message['images']
                
                print(f"🔍 Final streaming metadata: {len(citations)} citations, {len(images)} images")
                
                # Yield final metadata
                yield {
                    "type": "metadata",
                    "citations": citations,
                    "images": images,
                    "model_used": model_used
                }
            
            return generate_chunks()
            
        except Exception as e:
            print(f"❌ Error in streaming response: {str(e)}")
            def error_generator():
                yield {
                    "type": "error",
                    "content": f"Error: {str(e)}",
                    "citations": [],
                    "images": [],
                    "model_used": payload["model"]
                }
            return error_generator()
    
    def _extract_chain_of_thought(self, content: str) -> tuple[str, str]:
        """
        Extract chain of thought reasoning from sonar-reasoning models.
        Returns (thinking_process, final_answer)
        """
        # For reasoning models, the response often contains <think> tags
        if '<think>' in content and '</think>' in content:
            think_start = content.find('<think>')
            think_end = content.find('</think>') + 8
            
            thinking = content[think_start:think_end]
            final_answer = content[think_end:].strip()
            
            # Clean up the thinking section
            thinking = thinking.replace('<think>', '').replace('</think>', '').strip()
            
            return thinking, final_answer
        
        return "", content
    
    def extract_paper_metadata_flash(self, text_first_pages):
        """
        Extract basic paper metadata using Perplexity.
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
        
        # Use Perplexity for metadata extraction
        system_prompt = "Extract metadata from the scientific paper text and provide the result as a valid JSON object."
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
        system_prompt = """
        You are an expert academic research interpreter and educational content creator.
        
        Your task is to transform a research paper into an interactive, educational wiki-like experience
        that helps researchers understand complex concepts step by step.
        
        CRITICAL REQUIREMENTS:
        1. Create 4-8 main sections that logically organize the paper's content
        2. Each main section should have 2-4 subsections for detailed exploration
        3. Focus on educational value over strict paper structure adherence
        4. Use clear, descriptive titles that indicate what readers will learn
        5. Include specific page references and figure/table mentions
        6. Use proper markdown with LaTeX math notation (KaTeX compatible only)
        7. Make content accessible while maintaining technical accuracy
        8. Connect concepts to broader research context
        
        LATEX REQUIREMENTS (KATEX ONLY):
        - Use single $ for inline math: $E = mc^2$
        - Use double $$ for display equations: $$\\frac{a}{b} = c$$
        - ONLY use KaTeX-supported functions: \\frac{}{}, \\sum_{}, \\int_{}, \\alpha, \\beta, \\gamma, etc.
        - For matrices: $$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$
        - For aligned equations: $$\\begin{align} x &= y \\\\ a &= b \\end{align}$$
        - NO AMSmath packages or unsupported LaTeX commands
        - Test all math expressions for KaTeX compatibility
        
        EDUCATIONAL STRUCTURE:
        - Section titles should be clear learning objectives
        - Subsection titles should address specific concepts or techniques
        - Include practical examples and real-world applications
        - Explain mathematical intuition before formal definitions
        - Connect to related work and broader research themes
        """
        
        prompt = f"""
        Analyze this research paper and create a comprehensive educational structure.
        
        TASK: Create a JSON array of sections that transforms this paper into an educational resource.
        
        REQUIRED JSON STRUCTURE:
        [
            {{
                "id": "descriptive-slug",
                "title": "Clear, Educational Title",
                "content": "Comprehensive markdown content with LaTeX math ($...$ inline, $$...$$ display)",
                "citations": [1, 2, 3],
                "page_number": 2,
                "subsections": [
                    {{
                        "id": "subsection-slug",
                        "title": "Specific Subsection Topic",
                        "content": "Detailed explanation with examples and context",
                        "citations": [2, 4],
                        "page_number": 3
                    }}
                ]
            }}
        ]
        
        EXAMPLE STRUCTURE:
        ```json
        [
            {{
                "id": "research-problem",
                "title": "Understanding the Research Problem",
                "content": "This section introduces the fundamental challenge addressed in this paper. The authors tackle [specific problem], which is crucial for [broader context]...",
                "citations": [1, 2],
                "page_number": 1,
                "subsections": [
                    {{
                        "id": "problem-motivation",
                        "title": "Why This Problem Matters",
                        "content": "The motivation for this research stems from [context]. Current approaches face limitations such as...",
                        "citations": [1],
                        "page_number": 1
                    }},
                    {{
                        "id": "existing-approaches",
                        "title": "Current State of the Art",
                        "content": "Previous work in this area includes [summary]. However, these methods have drawbacks...",
                        "citations": [2, 3],
                        "page_number": 2
                    }}
                ]
            }},
            {{
                "id": "neural-architecture",
                "title": "Neural Architecture Design",
                "content": "This section explores the novel neural network architecture proposed in the paper. The authors introduce a transformer-based model with several key innovations...",
                "citations": [1, 3, 7],
                "page_number": 4,
                "subsections": [
                    {{
                        "id": "attention-mechanism",
                        "title": "Multi-Head Attention Mechanism",
                        "content": "The attention mechanism is the core of the proposed architecture. As detailed on page 4, the model uses...",
                        "citations": [1, 5],
                        "page_number": 4
                    }},
                    {{
                        "id": "positional-encoding",
                        "title": "Enhanced Positional Encoding",
                        "content": "Building on standard positional encoding, the authors propose...",
                        "citations": [1, 8],
                        "page_number": 5
                    }}
                ]
            }}
        ]
        ```

        PAPER TEXT TO ANALYZE:
        {paper_text[:50000]}
        
        Generate a comprehensive educational structure that makes this research accessible and engaging for researchers.
        """
        
        # Use Perplexity Sonar Reasoning Pro for enhanced section generation
        print("Sending section generation request to Perplexity API (sonar-reasoning-pro)...")
        try:
            print("Calling Perplexity API for section generation...")
            result = self._call_perplexity_api(prompt, system_prompt, model="sonar-reasoning-pro")
        except Exception as perplexity_error:
            print(f"Error with Perplexity API: {str(perplexity_error)}")
            raise perplexity_error
        
        # Process the response to ensure it's valid JSON
        try:
            content = result["content"]
            citations = result["citations"]
            
            print(f"Received raw response from Perplexity (length: {len(content)})")
            print(f"Citations count: {len(citations) if citations else 0}")
            
            # Sanitize the JSON content to fix escape sequence issues
            try:
                print("Starting JSON sanitization...")
                content = self._sanitize_json_string(content)
                print("Successfully sanitized JSON content")
            except Exception as sanitize_error:
                print(f"CRITICAL ERROR: JSON sanitization failed: {sanitize_error}")
                import traceback
                traceback.print_exc()
                # Continue with original content as fallback
                print("Continuing with original content...")
            
            # Parse and validate the JSON with multiple fallback strategies
            sections = None
            parsing_attempts = [
                lambda: json.loads(content.strip()),
                lambda: json.loads(self._repair_json(content)),
                lambda: json.loads(content.strip().replace('\n', ' ')),
                lambda: json.loads(re.sub(r'//.*', '', content.strip())),  # Remove comments
                lambda: json.loads(content.strip().replace('\\"', '"').replace('\\\\', '\\')),  # Fix double escaping
                lambda: self._parse_json_with_ast(content),  # AST-based parsing as last resort
            ]
            
            print(f"Attempting to parse JSON with {len(parsing_attempts)} different strategies...")
            for i, attempt in enumerate(parsing_attempts):
                try:
                    print(f"JSON parsing attempt {i+1}...")
                    sections = attempt()
                    if sections is not None:  # Handle case where AST parsing returns None
                        print(f"Successfully parsed JSON response with {len(sections)} sections (attempt {i+1})")
                        break
                    else:
                        print(f"JSON parsing attempt {i+1} returned None")
                except (json.JSONDecodeError, Exception) as parse_error:
                    print(f"JSON parsing attempt {i+1} failed: {parse_error}")
                    if i == len(parsing_attempts) - 1:
                        # If all attempts fail, log the content for debugging and save to file
                        print(f"All JSON parsing attempts failed. Content preview: {content[:500]}...")
                        # Save the problematic content to a debug file
                        try:
                            with open('debug_json_content.txt', 'w', encoding='utf-8') as f:
                                f.write(content)
                            print("Saved problematic JSON content to debug_json_content.txt")
                        except:
                            pass
                        
                        # Create a fallback structure instead of raising an error
                        print("Creating fallback section structure...")
                        sections = [
                            {
                                "id": "overview",
                                "title": "Overview",
                                "content": "Paper content could not be automatically sectioned due to JSON parsing errors. Please check the debug file for details.",
                                "citations": [],
                                "page_number": 1,
                                "subsections": []
                            }
                        ]
                        break
            
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
        system_prompt = """
        You are an expert academic research educator and technical writer.
        
        Your task is to create comprehensive, educational content for a specific section of a research paper.
        Think of yourself as writing for a high-quality educational platform like Khan Academy or Coursera,
        but for advanced researchers and graduate students.
        
        CONTENT CREATION PRINCIPLES:
        1. Start with clear context and learning objectives
        2. Build concepts progressively from fundamentals to advanced
        3. Use concrete examples and analogies where appropriate
        4. Include mathematical formulations with clear explanations
        5. Reference specific parts of the paper with page numbers
        6. Connect concepts to broader research landscape
        7. Explain the "why" behind technical choices
        8. Highlight innovations and novel contributions
        
        FORMATTING REQUIREMENTS:
        - Use markdown with proper headings, lists, and emphasis
        - Include LaTeX math: $inline$ and $$display$$ equations
        - Use code blocks for algorithms or pseudocode
        - Include specific figure/table references from the paper
        - Add page number citations throughout
        - Use clear paragraph structure with logical flow
        
        LATEX FORMATTING GUIDELINES (CRITICAL - KATEX ONLY):
        - Use single $ for inline math: $E = mc^2$
        - Use double $$ for display equations: $$\\int_0^\\infty e^{-x} dx = 1$$
        - Use ONLY KaTeX-supported functions and commands
        - For fractions: $\\frac{a}{b}$
        - For summations: $\\sum_{i=1}^n$
        - For integrals: $\\int_a^b$
        - For Greek letters: $\\alpha$, $\\beta$, $\\gamma$, $\\delta$, $\\epsilon$, $\\theta$, $\\lambda$, $\\mu$, $\\pi$, $\\sigma$, $\\phi$, $\\omega$
        - For operators: $\\cdot$, $\\times$, $\\div$, $\\pm$, $\\mp$
        - For relations: $\\leq$, $\\geq$, $\\neq$, $\\approx$, $\\equiv$
        - For arrows: $\\rightarrow$, $\\leftarrow$, $\\leftrightarrow$
        - For sets: $\\in$, $\\subset$, $\\cup$, $\\cap$, $\\emptyset$
        - For calculus: $\\partial$, $\\nabla$, $\\infty$, $\\lim$
        - For matrices: $$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$
        - For aligned equations: $$\\begin{align} x &= y + z \\\\ a &= b + c \\end{align}$$
        - NEVER use unsupported LaTeX packages or commands
        - Test all math expressions for KaTeX compatibility
        
        EDUCATIONAL QUALITY STANDARDS:
        - Explain technical terms when first introduced
        - Provide intuitive explanations before diving into details
        - Include real-world applications and implications
        - Address potential confusion points
        - Connect to related concepts in other sections
        - Maintain academic rigor while being accessible
        """
        
        prompt = f"""
        Create comprehensive educational content for the section: "{section_title}"
        
        CONTEXT: This section is part of a larger educational breakdown of a research paper.
        The initial content outline is: "{section_content}"
        
        YOUR TASK: Expand this into a detailed, educational explanation that:
        
        1. **INTRODUCTION** (1-2 paragraphs)
           - Clearly state what this section covers
           - Explain why this topic is important for understanding the paper
           - Provide context for how it fits into the broader research
        
        2. **CORE CONTENT** (3-5 paragraphs)
           - Explain key concepts with clear definitions
           - Include mathematical formulations where relevant
           - Reference specific figures, tables, or equations from the paper
           - Use examples to illustrate complex ideas
           - Explain the reasoning behind methodological choices
        
        3. **TECHNICAL DETAILS** (2-3 paragraphs)
           - Dive deeper into implementation specifics
           - Include algorithms, pseudocode, or detailed procedures
           - Explain parameter choices and design decisions
           - Reference specific page numbers and sections of the paper
        
        4. **SIGNIFICANCE & CONNECTIONS** (1-2 paragraphs)
           - Explain why this approach is novel or important
           - Connect to related work and broader research context
           - Highlight key innovations or contributions
           - Explain implications for the field
        
        SPECIFIC REQUIREMENTS:
        - Include at least 3-5 specific page references (e.g., "As shown on page 7...")
        - Reference at least 2-3 figures or tables if they exist (e.g., "Figure 3 illustrates...")
        - Use LaTeX notation for any mathematical expressions
        - Include code blocks for algorithms or important equations
        - Explain any technical jargon or domain-specific terms
        - Make connections to other sections when relevant
        
        MATHEMATICAL CONTENT REQUIREMENTS:
        - Convert ALL mathematical expressions to proper KaTeX-compatible LaTeX format
        - Use inline math $...$ for variables and simple expressions
        - Use display math $$...$$ for complex equations and formulas
        - Ensure proper escaping of LaTeX commands (\\alpha, \\beta, etc.)
        - Include mathematical derivations where relevant
        - Explain the meaning of mathematical symbols and variables
        - Show step-by-step mathematical reasoning when applicable
        - Test all LaTeX expressions for KaTeX compatibility
        - Use only KaTeX-supported functions and environments
        - Avoid deprecated or unsupported LaTeX commands
        - Use proper spacing and formatting for mathematical expressions
        - Include units and dimensions where appropriate using \\text{...}
        - Use \\operatorname{...} for custom function names
        - Ensure all Greek letters use proper LaTeX commands
        - Use standard mathematical notation conventions
        
        EXAMPLE STRUCTURE:
        ```markdown
        ## Understanding [Concept Name]
        
        This section explores [brief overview]. Understanding this concept is crucial because [importance].
        
        ### Core Methodology
        
        The authors propose [main idea]. As detailed on page X, this approach [explanation].
        
        The mathematical foundation can be expressed as:
        $$equation$$
        
        Where [variable explanations].
        
        ### Implementation Details
        
        Figure Y on page Z illustrates the [specific aspect]. The algorithm proceeds as follows:
        
        ```
        Algorithm pseudocode
        ```
        
        ### Significance
        
        This approach represents a significant advance because [reasons].
        ```
        
        PAPER TEXT FOR REFERENCE:
        {paper_text[:30000]}

        
        Generate educational content that makes this section accessible and engaging while maintaining technical accuracy.
        """
        
        print(f"Generating content for section/subsection: {section_title}")
        try:
            result = self._call_perplexity_api(prompt, system_prompt, model="sonar-reasoning-pro")
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

    def _sanitize_json_string(self, json_str: str) -> str:
        """
        Sanitize a JSON string to fix common issues like invalid escape sequences.
        """
        try:
            # Remove any markdown code block markers
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
            
            # Remove any leading/trailing text that's not JSON
            json_str = json_str.strip()
            
            # Find the actual JSON content (should start with [ or {)
            start_idx = -1
            for i, char in enumerate(json_str):
                if char in '[{':
                    start_idx = i
                    break
            
            if start_idx > 0:
                json_str = json_str[start_idx:]
            
            # Find the end of JSON content
            bracket_count = 0
            end_idx = len(json_str)
            for i, char in enumerate(json_str):
                if char in '[{':
                    bracket_count += 1
                elif char in ']}':
                    bracket_count -= 1
                    if bracket_count == 0:
                        end_idx = i + 1
                        break
            
            json_str = json_str[:end_idx]
            
            # Remove JavaScript-style comments first
            json_str = re.sub(r'//.*$', '', json_str, flags=re.MULTILINE)
            
            # Fix trailing commas before closing brackets
            json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
            
            # More aggressive escape sequence fixing
            # First, protect already properly escaped sequences
            json_str = json_str.replace('\\"', '___ESCAPED_QUOTE___')
            json_str = json_str.replace('\\\\', '___ESCAPED_BACKSLASH___')
            json_str = json_str.replace('\\/', '___ESCAPED_SLASH___')
            json_str = json_str.replace('\\n', '___ESCAPED_NEWLINE___')
            json_str = json_str.replace('\\r', '___ESCAPED_RETURN___')
            json_str = json_str.replace('\\t', '___ESCAPED_TAB___')
            json_str = json_str.replace('\\b', '___ESCAPED_BACKSPACE___')
            json_str = json_str.replace('\\f', '___ESCAPED_FORMFEED___')
            
            # Now fix any remaining backslashes that aren't part of valid escape sequences
            # This handles cases like \{ \} \$ etc.
            try:
                json_str = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', json_str)
            except Exception as regex_error:
                print(f"Regex error in backslash fixing: {regex_error}")
                pass
            
            # Handle LaTeX-style escapes that shouldn't be escaped in JSON
            json_str = json_str.replace('\\\\{', '{').replace('\\\\}', '}')
            json_str = json_str.replace('\\\\$', '$')
            
            # Restore the properly escaped sequences
            json_str = json_str.replace('___ESCAPED_QUOTE___', '\\"')
            json_str = json_str.replace('___ESCAPED_BACKSLASH___', '\\\\')
            json_str = json_str.replace('___ESCAPED_SLASH___', '\\/')
            json_str = json_str.replace('___ESCAPED_NEWLINE___', '\\n')
            json_str = json_str.replace('___ESCAPED_RETURN___', '\\r')
            json_str = json_str.replace('___ESCAPED_TAB___', '\\t')
            json_str = json_str.replace('___ESCAPED_BACKSPACE___', '\\b')
            json_str = json_str.replace('___ESCAPED_FORMFEED___', '\\f')
            
            return json_str
        except Exception as e:
            print(f"Error in _sanitize_json_string: {str(e)}")
            import traceback
            traceback.print_exc()
            return json_str

    def _repair_json(self, json_str: str) -> str:
        """
        Attempt to repair malformed JSON by fixing common issues.
        """
        # Start with sanitization
        json_str = self._sanitize_json_string(json_str)
        
        # Fix unescaped quotes within string values
        # This is a more sophisticated approach to handle quotes in content
        lines = json_str.split('\n')
        fixed_lines = []
        
        for line in lines:
            line = line.strip()
            if not line or line in ['{', '}', '[', ']', ',']:
                fixed_lines.append(line)
                continue
            
            # Handle lines with key-value pairs
            if ':' in line and '"' in line:
                # Find the colon that separates key from value
                colon_idx = line.find(':')
                key_part = line[:colon_idx]
                value_part = line[colon_idx + 1:].strip()
                
                # If the value is a string (starts and ends with quotes)
                if value_part.startswith('"'):
                    # Find the closing quote, accounting for trailing comma
                    trailing_comma = value_part.rstrip().endswith(',')
                    if trailing_comma:
                        value_content = value_part[1:-2]  # Remove quotes and comma
                    else:
                        value_content = value_part[1:-1]  # Remove quotes
                    
                    # Escape any unescaped quotes in the content
                    # First protect already escaped quotes
                    value_content = value_content.replace('\\"', '___TEMP_ESCAPED___')
                    # Escape unescaped quotes
                    value_content = value_content.replace('"', '\\"')
                    # Restore the protected quotes
                    value_content = value_content.replace('___TEMP_ESCAPED___', '\\"')
                    
                    # Reconstruct the line
                    comma = ',' if trailing_comma else ''
                    line = f'{key_part}: "{value_content}"{comma}'
            
            fixed_lines.append(line)
        
        return '\n'.join(fixed_lines)

    def _parse_json_with_ast(self, json_str: str) -> dict:
        """
        Attempt to parse JSON using a more robust AST-based approach.
        This is a last resort method that tries to extract structured data even from malformed JSON.
        """
        try:
            # Clean the string first
            json_str = self._repair_json(json_str)
            
            # Try to use ast.literal_eval for Python-like structures
            import ast
            # Replace JSON booleans with Python booleans
            json_str = json_str.replace('true', 'True').replace('false', 'False').replace('null', 'None')
            
            result = ast.literal_eval(json_str)
            return result
        except:
            # If AST parsing fails, try to manually extract the structure
            try:
                # This is a very basic fallback - extract what we can
                lines = json_str.split('\n')
                sections = []
                current_section = {}
                
                for line in lines:
                    line = line.strip()
                    if '"id":' in line:
                        if current_section:
                            sections.append(current_section)
                        current_section = {}
                        # Extract ID
                        id_match = re.search(r'"id":\s*"([^"]*)"', line)
                        if id_match:
                            current_section['id'] = id_match.group(1)
                    elif '"title":' in line:
                        # Extract title
                        title_match = re.search(r'"title":\s*"([^"]*)"', line)
                        if title_match:
                            current_section['title'] = title_match.group(1)
                    elif '"content":' in line:
                        # Extract content (this is simplified)
                        content_match = re.search(r'"content":\s*"([^"]*)"', line)
                        if content_match:
                            current_section['content'] = content_match.group(1)
                        else:
                            current_section['content'] = "Content extraction failed"
                    elif '"page_number":' in line:
                        # Extract page number
                        page_match = re.search(r'"page_number":\s*(\d+)', line)
                        if page_match:
                            current_section['page_number'] = int(page_match.group(1))
                
                if current_section:
                    sections.append(current_section)
                
                # Ensure each section has required fields
                for section in sections:
                    if 'citations' not in section:
                        section['citations'] = []
                    if 'subsections' not in section:
                        section['subsections'] = []
                    if 'content' not in section:
                        section['content'] = "Content could not be extracted"
                    if 'page_number' not in section:
                        section['page_number'] = 1
                
                return sections if sections else None
            except:
                return None 