import sqlite3
import os
from datetime import datetime

def migrate_database():
    """Migrate existing database to add admin functionality columns"""
    db_path = 'deeprxiv.db'
    backup_path = f'deeprxiv_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db'
    
    if not os.path.exists(db_path):
        print("❌ Database file does not exist")
        return False
        
    try:
        # Create backup
        print("📋 Creating database backup...")
        import shutil
        shutil.copy2(db_path, backup_path)
        print(f"✅ Backup created: {backup_path}")
        
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Add missing columns to users table
        print("🔧 Adding missing columns to users table...")
        
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN hashed_password VARCHAR")
            print("  ✅ Added hashed_password column")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  ⚠️ hashed_password column already exists")
            else:
                raise
                
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN full_name VARCHAR")
            print("  ✅ Added full_name column")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  ⚠️ full_name column already exists")
            else:
                raise
                
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN avatar_url VARCHAR")
            print("  ✅ Added avatar_url column")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  ⚠️ avatar_url column already exists")
            else:
                raise
                
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0")
            print("  ✅ Added is_admin column")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  ⚠️ is_admin column already exists")
            else:
                raise
                
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0")
            print("  ✅ Added is_verified column")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  ⚠️ is_verified column already exists")
            else:
                raise
                
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN last_login DATETIME")
            print("  ✅ Added last_login column")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  ⚠️ last_login column already exists")
            else:
                raise
        
        # Create new tables if they don't exist
        print("\n🔧 Creating new admin tables...")
        
        # User auth providers table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_auth_providers (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                provider VARCHAR NOT NULL,
                provider_user_id VARCHAR NOT NULL,
                provider_email VARCHAR,
                provider_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        print("  ✅ Created user_auth_providers table")
        
        # User feedback table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_feedback (
                id INTEGER PRIMARY KEY,
                user_id INTEGER,
                session_id VARCHAR,
                feedback_type VARCHAR NOT NULL,
                title VARCHAR,
                content TEXT NOT NULL,
                rating INTEGER,
                page_url VARCHAR,
                user_agent VARCHAR,
                status VARCHAR DEFAULT 'open',
                admin_response TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        print("  ✅ Created user_feedback table")
        
        # Paper analytics table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS paper_analytics (
                id INTEGER PRIMARY KEY,
                paper_id INTEGER NOT NULL,
                event_type VARCHAR NOT NULL,
                user_id INTEGER,
                session_id VARCHAR,
                ip_address VARCHAR,
                user_agent VARCHAR,
                referrer VARCHAR,
                event_metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (paper_id) REFERENCES papers (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        print("  ✅ Created paper_analytics table")
        
        # System analytics table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS system_analytics (
                id INTEGER PRIMARY KEY,
                event_type VARCHAR NOT NULL,
                user_id INTEGER,
                session_id VARCHAR,
                ip_address VARCHAR,
                user_agent VARCHAR,
                endpoint VARCHAR,
                response_time REAL,
                status_code INTEGER,
                error_message TEXT,
                event_metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        print("  ✅ Created system_analytics table")
        
        # Admin settings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS admin_settings (
                id INTEGER PRIMARY KEY,
                key VARCHAR UNIQUE NOT NULL,
                value TEXT,
                description TEXT,
                setting_type VARCHAR DEFAULT 'string',
                updated_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (updated_by) REFERENCES users (id)
            )
        ''')
        print("  ✅ Created admin_settings table")
        
        conn.commit()
        conn.close()
        
        print("\n✅ Database migration completed successfully!")
        print(f"📋 Backup saved as: {backup_path}")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

if __name__ == "__main__":
    migrate_database() 