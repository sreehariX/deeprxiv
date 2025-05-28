#!/usr/bin/env python3

import sqlite3
import os

def add_missing_chat_columns():
    """Add missing columns to the chat_messages table"""
    
    db_path = "deeprxiv.db"
    
    if not os.path.exists(db_path):
        print(f"❌ Database file {db_path} not found!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check current schema
        cursor.execute("PRAGMA table_info(chat_messages)")
        existing_columns = [row[1] for row in cursor.fetchall()]
        print(f"📋 Existing columns: {existing_columns}")
        
        # Define columns to add
        new_columns = {
            'chain_of_thought': 'TEXT',
            'citations': 'TEXT',  # JSON string of citations
            'images': 'TEXT',     # JSON string of images
            'model_used': 'TEXT'  # Model name used for response
        }
        
        # Add missing columns
        for column_name, column_type in new_columns.items():
            if column_name not in existing_columns:
                try:
                    alter_sql = f"ALTER TABLE chat_messages ADD COLUMN {column_name} {column_type}"
                    cursor.execute(alter_sql)
                    print(f"✅ Added column: {column_name} ({column_type})")
                except sqlite3.Error as e:
                    print(f"❌ Error adding column {column_name}: {e}")
            else:
                print(f"ℹ️ Column {column_name} already exists")
        
        # Commit changes
        conn.commit()
        print("✅ Database migration completed successfully!")
        
        # Verify the new schema
        cursor.execute("PRAGMA table_info(chat_messages)")
        updated_columns = [row[1] for row in cursor.fetchall()]
        print(f"📋 Updated columns: {updated_columns}")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("🔧 Adding missing columns to chat_messages table...")
    add_missing_chat_columns() 