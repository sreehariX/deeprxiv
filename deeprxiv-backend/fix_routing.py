#!/usr/bin/env python3

def fix_routing():
    """Fix the routing issue by removing duplicate endpoints."""
    
    # Read the main.py file
    with open('main.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find and remove the first models endpoint (around line 2498)
    lines = content.split('\n')
    
    # Find the first models endpoint and remove it
    new_lines = []
    skip_until_next_endpoint = False
    
    for i, line in enumerate(lines):
        # Skip the first models endpoint
        if '@app.get("/api/chat/models", response_model=AvailableModelsResponse)' in line and not skip_until_next_endpoint:
            skip_until_next_endpoint = True
            continue
        
        # Skip until we find the next endpoint
        if skip_until_next_endpoint:
            if line.strip().startswith('@app.') and 'models' not in line:
                skip_until_next_endpoint = False
                new_lines.append(line)
            continue
        
        new_lines.append(line)
    
    # Write the fixed content back
    with open('main.py', 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))
    
    print("✅ Fixed routing issue by removing duplicate models endpoint")

if __name__ == "__main__":
    fix_routing() 