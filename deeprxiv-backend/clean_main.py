#!/usr/bin/env python3

def clean_main_file():
    """Clean the main.py file by removing duplicate endpoints and fixing routing."""
    
    # Read the current main.py
    with open('main.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    new_lines = []
    
    # Track which endpoints we've seen
    seen_endpoints = set()
    skip_until_next_endpoint = False
    
    for i, line in enumerate(lines):
        # Check if this is an endpoint definition
        if line.strip().startswith('@app.'):
            endpoint_signature = line.strip()
            
            # Skip duplicate endpoints
            if endpoint_signature in seen_endpoints:
                skip_until_next_endpoint = True
                continue
            
            # Special handling for models endpoint - only keep the one that comes after session_id
            if '/api/chat/models' in endpoint_signature:
                # Check if we've already seen the session_id endpoint
                session_endpoint_seen = any('/api/chat/{session_id}' in ep for ep in seen_endpoints)
                if not session_endpoint_seen:
                    # Skip this models endpoint, we'll keep the later one
                    skip_until_next_endpoint = True
                    continue
            
            seen_endpoints.add(endpoint_signature)
            skip_until_next_endpoint = False
            new_lines.append(line)
        
        elif skip_until_next_endpoint:
            # Skip lines until we find the next endpoint
            if line.strip().startswith('@app.'):
                skip_until_next_endpoint = False
                endpoint_signature = line.strip()
                if endpoint_signature not in seen_endpoints:
                    seen_endpoints.add(endpoint_signature)
                    new_lines.append(line)
            continue
        
        else:
            new_lines.append(line)
    
    # Write the cleaned content
    with open('main.py', 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))
    
    print("✅ Cleaned main.py file and fixed routing")

if __name__ == "__main__":
    clean_main_file() 