#!/usr/bin/env python3
"""
Simple test for system analytics endpoint
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "sreeharixe@gmail.com"
ADMIN_PASSWORD = "Hari@cnp7224"

def test_system_analytics():
    session = requests.Session()
    
    print("🔑 Logging in...")
    # Login first
    login_data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    response = session.post(
        f"{BASE_URL}/admin/auth/login",
        json=login_data,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        return
    
    data = response.json()
    token = data.get("access_token")
    print(f"✅ Login successful")
    
    # Set authorization header
    session.headers.update({
        "Authorization": f"Bearer {token}"
    })
    
    print("🔍 Testing system analytics endpoint...")
    
    # Test system analytics
    response = session.get(f"{BASE_URL}/admin/analytics/system")
    
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ System analytics working!")
        print(json.dumps(data, indent=2))
    else:
        print("❌ System analytics failed")

if __name__ == "__main__":
    test_system_analytics() 