#!/usr/bin/env python3

import requests
import json

def test_models_api():
    """Test the models API endpoint"""
    try:
        print("Testing models API endpoint...")
        response = requests.get("http://localhost:8000/api/chat/models")
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Models API working!")
            print(f"Available models: {list(data.get('models', {}).keys())}")
            return True
        else:
            print(f"❌ API Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return False

def test_health_check():
    """Test the health check endpoint"""
    try:
        print("\nTesting health check endpoint...")
        response = requests.get("http://localhost:8000/api")
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Health check working!")
            print(f"Response: {data}")
            return True
        else:
            print(f"❌ Health check failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return False

if __name__ == "__main__":
    print("=== Backend API Test ===")
    
    health_ok = test_health_check()
    models_ok = test_models_api()
    
    if health_ok and models_ok:
        print("\n✅ All tests passed!")
    else:
        print("\n❌ Some tests failed!") 