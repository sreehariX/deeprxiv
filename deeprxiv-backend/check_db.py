import sqlite3
import os

def check_database():
    db_path = 'deeprxiv.db'
    
    if not os.path.exists(db_path):
        print("❌ Database file does not exist")
        return
        
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if users table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if cursor.fetchone():
            print("✅ Users table exists")
            
            # Check users table schema
            cursor.execute("PRAGMA table_info(users)")
            columns = cursor.fetchall()
            print("\n📋 Users table columns:")
            for col in columns:
                print(f"  {col[1]} - {col[2]}")
                
            # Check if required columns exist
            column_names = [col[1] for col in columns]
            required_columns = ['hashed_password', 'is_admin', 'is_verified', 'last_login']
            missing_columns = [col for col in required_columns if col not in column_names]
            
            if missing_columns:
                print(f"\n❌ Missing columns: {missing_columns}")
                print("🔧 The database schema needs to be updated for admin functionality")
            else:
                print("\n✅ All required columns exist")
        else:
            print("❌ Users table does not exist")
            
        conn.close()
        
    except Exception as e:
        print(f"❌ Error checking database: {e}")

if __name__ == "__main__":
    check_database() 