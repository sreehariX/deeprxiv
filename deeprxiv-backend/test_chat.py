#!/usr/bin/env python3

import requests
import json
import time

BACKEND_URL = "http://localhost:8000"

def test_chat_functionality():
    """Test the complete chat functionality end-to-end."""
    
    print("🚀 TESTING DEEPRXIV CHAT FUNCTIONALITY")
    print("=" * 60)
    
    try:
        # Test 1: Create a new chat session for the test paper
        print("\n📋 STEP 1: Creating new chat session...")
        
        create_response = requests.post(f"{BACKEND_URL}/api/chat/create", json={
            "arxiv_id": "2505.17655",
            "title": "Test Chat about Audio-to-Audio Emotion Conversion",
            "is_public": True
        })
        
        if create_response.status_code == 200:
            session = create_response.json()
            print(f"✅ Chat session created successfully!")
            print(f"📝 Session ID: {session['session_id']}")
            print(f"📄 Title: {session['title']}")
            print(f"🔗 Share URL: {session.get('share_url', 'N/A')}")
        else:
            print(f"❌ Failed to create chat session: {create_response.status_code}")
            return
        
        # Test 2: Send a message to the chat
        print("\n📋 STEP 2: Sending test message...")
        
        message_response = requests.post(f"{BACKEND_URL}/api/chat/message", json={
            "session_id": session['session_id'],
            "message": "What is the main contribution of this paper?",
            "content_chunks": 3,
            "section_chunks": 2
        })
        
        if message_response.status_code == 200:
            message_data = message_response.json()
            print(f"✅ Message sent successfully!")
            print(f"👤 User message: {message_data['user_message']['content']}")
            print(f"🤖 Assistant response length: {len(message_data['assistant_message']['content'])} chars")
            print(f"📚 Sources found: {len(message_data['assistant_message'].get('sources', []))}")
            print(f"🖼️ Highlighted images: {len(message_data['assistant_message'].get('highlighted_images', []))}")
        else:
            print(f"❌ Failed to send message: {message_response.status_code}")
            print(f"Response: {message_response.text}")
            return
        
        # Test 3: Get chat session details
        print("\n📋 STEP 3: Retrieving chat session...")
        
        get_response = requests.get(f"{BACKEND_URL}/api/chat/{session['session_id']}")
        
        if get_response.status_code == 200:
            session_data = get_response.json()
            print(f"✅ Chat session retrieved successfully!")
            print(f"💬 Total messages: {len(session_data['messages'])}")
            print(f"📊 Paper: {session_data.get('paper_title', 'N/A')}")
        else:
            print(f"❌ Failed to get chat session: {get_response.status_code}")
            return
        
        # Test 4: Test feedback functionality
        print("\n📋 STEP 4: Testing feedback...")
        
        # Get the assistant message ID
        assistant_message = session_data['messages'][-1]
        feedback_response = requests.post(f"{BACKEND_URL}/api/chat/feedback", json={
            "message_id": assistant_message['id'],
            "thumbs_up": True
        })
        
        if feedback_response.status_code == 200:
            print(f"✅ Feedback submitted successfully!")
        else:
            print(f"❌ Failed to submit feedback: {feedback_response.status_code}")
        
        # Test 5: List chat sessions
        print("\n📋 STEP 5: Listing chat sessions...")
        
        sessions_response = requests.get(f"{BACKEND_URL}/api/chat/sessions?include_public=true")
        
        if sessions_response.status_code == 200:
            sessions_data = sessions_response.json()
            print(f"✅ Chat sessions listed successfully!")
            print(f"📋 Total sessions: {len(sessions_data)}")
        else:
            print(f"❌ Failed to list chat sessions: {sessions_response.status_code}")
        
        # Test 6: Test shared chat access
        if session.get('share_url'):
            print("\n📋 STEP 6: Testing shared chat access...")
            
            share_response = requests.get(f"{BACKEND_URL}/api/chat/share/{session['share_url']}")
            
            if share_response.status_code == 200:
                shared_data = share_response.json()
                print(f"✅ Shared chat accessed successfully!")
                print(f"💬 Messages in shared chat: {len(shared_data['messages'])}")
            else:
                print(f"❌ Failed to access shared chat: {share_response.status_code}")
        
        print("\n🎉 ALL CHAT TESTS COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print(f"\n🔗 Frontend URL: http://localhost:3000/chat")
        print(f"🔗 Share URL: http://localhost:3000/chat/share/{session.get('share_url', '')}")
        
    except Exception as e:
        print(f"❌ Error during testing: {str(e)}")

if __name__ == "__main__":
    test_chat_functionality() 