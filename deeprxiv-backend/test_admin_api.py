#!/usr/bin/env python3
"""
Comprehensive Admin API Testing Script
Tests all admin dashboard functionality end-to-end
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "sreeharixe@gmail.com"
ADMIN_PASSWORD = "Hari@cnp7224"

class AdminAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.token = None
        self.user_data = None

    def print_header(self, title):
        print(f"\n{'='*60}")
        print(f"🧪 {title}")
        print(f"{'='*60}")

    def print_test(self, test_name, status="RUNNING"):
        if status == "RUNNING":
            print(f"🔄 Testing: {test_name}...")
        elif status == "SUCCESS":
            print(f"✅ {test_name} - SUCCESS")
        elif status == "FAILED":
            print(f"❌ {test_name} - FAILED")

    def test_server_health(self):
        """Test if the server is running"""
        self.print_header("SERVER HEALTH CHECK")
        
        try:
            response = self.session.get(f"{self.base_url}/api")
            if response.status_code == 200:
                self.print_test("Server Health Check", "SUCCESS")
                return True
            else:
                self.print_test("Server Health Check", "FAILED")
                print(f"   Status code: {response.status_code}")
                return False
        except Exception as e:
            self.print_test("Server Health Check", "FAILED")
            print(f"   Error: {e}")
            return False

    def test_admin_login(self):
        """Test admin authentication"""
        self.print_header("ADMIN AUTHENTICATION")
        
        try:
            self.print_test("Admin Login")
            
            # Login request
            login_data = {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
            
            response = self.session.post(
                f"{self.base_url}/admin/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.user_data = data.get("user")
                
                # Set authorization header for future requests
                self.session.headers.update({
                    "Authorization": f"Bearer {self.token}"
                })
                
                self.print_test("Admin Login", "SUCCESS")
                print(f"   Token: {self.token[:20]}...")
                print(f"   User: {self.user_data.get('email')}")
                print(f"   Admin: {self.user_data.get('is_admin')}")
                return True
            else:
                self.print_test("Admin Login", "FAILED")
                print(f"   Status code: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
        except Exception as e:
            self.print_test("Admin Login", "FAILED")
            print(f"   Error: {e}")
            return False

    def test_analytics_endpoints(self):
        """Test all analytics endpoints"""
        self.print_header("ANALYTICS ENDPOINTS")
        
        analytics_endpoints = [
            ("Overview Analytics", "/admin/analytics/overview"),
            ("User Analytics", "/admin/analytics/users"),
            ("Paper Analytics", "/admin/analytics/papers"), 
            ("Chat Analytics", "/admin/analytics/chats"),
            ("Feedback Analytics", "/admin/analytics/feedback"),
            ("System Analytics", "/admin/analytics/system")
        ]
        
        results = []
        for name, endpoint in analytics_endpoints:
            try:
                self.print_test(name)
                response = self.session.get(f"{self.base_url}{endpoint}")
                
                if response.status_code == 200:
                    data = response.json()
                    self.print_test(name, "SUCCESS")
                    print(f"   Data keys: {list(data.keys())}")
                    results.append(True)
                else:
                    self.print_test(name, "FAILED")
                    print(f"   Status code: {response.status_code}")
                    results.append(False)
                    
            except Exception as e:
                self.print_test(name, "FAILED")
                print(f"   Error: {e}")
                results.append(False)
        
        return all(results)

    def test_user_management(self):
        """Test user management endpoints"""
        self.print_header("USER MANAGEMENT")
        
        try:
            # Test get users
            self.print_test("Get Users List")
            response = self.session.get(f"{self.base_url}/admin/users")
            
            if response.status_code == 200:
                data = response.json()
                self.print_test("Get Users List", "SUCCESS")
                print(f"   Total users: {data.get('total', 0)}")
                
                users = data.get('users', [])
                if users:
                    user_id = users[0]['id']
                    
                    # Test get specific user
                    self.print_test("Get Specific User")
                    response = self.session.get(f"{self.base_url}/admin/users/{user_id}")
                    
                    if response.status_code == 200:
                        user_data = response.json()
                        self.print_test("Get Specific User", "SUCCESS")
                        print(f"   User ID: {user_data.get('id')}")
                        print(f"   Email: {user_data.get('email')}")
                        return True
                    else:
                        self.print_test("Get Specific User", "FAILED")
                        return False
                else:
                    print("   No users found for detailed testing")
                    return True
            else:
                self.print_test("Get Users List", "FAILED")
                print(f"   Status code: {response.status_code}")
                return False
                
        except Exception as e:
            self.print_test("User Management", "FAILED")
            print(f"   Error: {e}")
            return False

    def test_feedback_management(self):
        """Test feedback management endpoints"""
        self.print_header("FEEDBACK MANAGEMENT")
        
        try:
            self.print_test("Get Feedback List")
            response = self.session.get(f"{self.base_url}/admin/feedback")
            
            if response.status_code == 200:
                data = response.json()
                self.print_test("Get Feedback List", "SUCCESS")
                print(f"   Total feedback: {data.get('total', 0)}")
                return True
            else:
                self.print_test("Get Feedback List", "FAILED")
                print(f"   Status code: {response.status_code}")
                return False
                
        except Exception as e:
            self.print_test("Feedback Management", "FAILED")
            print(f"   Error: {e}")
            return False

    def test_settings_management(self):
        """Test settings management endpoints"""
        self.print_header("SETTINGS MANAGEMENT")
        
        try:
            self.print_test("Get Settings")
            response = self.session.get(f"{self.base_url}/admin/settings")
            
            if response.status_code == 200:
                data = response.json()
                self.print_test("Get Settings", "SUCCESS")
                print(f"   Settings count: {len(data.get('settings', []))}")
                return True
            else:
                self.print_test("Get Settings", "FAILED")
                print(f"   Status code: {response.status_code}")
                return False
                
        except Exception as e:
            self.print_test("Settings Management", "FAILED")
            print(f"   Error: {e}")
            return False

    def test_system_info(self):
        """Test system information endpoint"""
        self.print_header("SYSTEM INFORMATION")
        
        try:
            self.print_test("Get System Info")
            response = self.session.get(f"{self.base_url}/admin/system/info")
            
            if response.status_code == 200:
                data = response.json()
                self.print_test("Get System Info", "SUCCESS")
                print(f"   Database stats: {data.get('database_stats', {})}")
                return True
            else:
                self.print_test("Get System Info", "FAILED")
                print(f"   Status code: {response.status_code}")
                return False
                
        except Exception as e:
            self.print_test("System Information", "FAILED")
            print(f"   Error: {e}")
            return False

    def run_all_tests(self):
        """Run all admin API tests"""
        print(f"\n🚀 STARTING COMPREHENSIVE ADMIN API TESTS")
        print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🌐 Base URL: {self.base_url}")
        
        tests = [
            ("Server Health", self.test_server_health),
            ("Admin Authentication", self.test_admin_login),
            ("Analytics Endpoints", self.test_analytics_endpoints),
            ("User Management", self.test_user_management),
            ("Feedback Management", self.test_feedback_management),
            ("Settings Management", self.test_settings_management),
            ("System Information", self.test_system_info),
        ]
        
        results = []
        for test_name, test_func in tests:
            try:
                result = test_func()
                results.append((test_name, result))
            except Exception as e:
                print(f"❌ {test_name} - FAILED with exception: {e}")
                results.append((test_name, False))
            
            time.sleep(1)  # Brief pause between tests
        
        # Summary
        self.print_header("TEST SUMMARY")
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{status}: {test_name}")
        
        print(f"\n📊 Overall Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! Admin dashboard is working correctly.")
            return True
        else:
            print("⚠️ Some tests failed. Please check the errors above.")
            return False

def main():
    tester = AdminAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1) 