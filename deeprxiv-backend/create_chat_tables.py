#!/usr/bin/env python3

from database import create_tables, SessionLocal, User, ChatSession, ChatMessage
import sys

def main():
    """Create the new chat-related tables in the database."""
    try:
        print("Creating database tables...")
        
        # This will create all tables defined in the models
        create_tables()
        
        print("✅ Chat tables created successfully!")
        print("\nThe following tables were created/updated:")
        print("- users")
        print("- chat_sessions") 
        print("- chat_messages")
        print("\nYou can now start using the chat functionality!")
        
    except Exception as e:
        print(f"❌ Error creating tables: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 