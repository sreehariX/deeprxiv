#!/usr/bin/env python3
"""
Initialize admin dashboard database tables and create the first admin user.
Run this script after setting up the environment variables.
"""

import os
import sys
from sqlalchemy.orm import Session
from database import create_tables, get_db, User, UserAuthProvider, get_password_hash
from datetime import datetime

def create_admin_user(email: str, password: str, full_name: str = "Admin User"):
    """Create the first admin user."""
    print(f"Creating admin user with email: {email}")
    
    # Get database session
    db = next(get_db())
    
    try:
        # Check if admin user already exists
        existing_auth = db.query(UserAuthProvider).filter(
            UserAuthProvider.provider == "email",
            UserAuthProvider.provider_email == email
        ).first()
        
        if existing_auth:
            print(f"❌ User with email {email} already exists!")
            return False
        
        # Create admin user
        admin_user = User(
            email=email,
            full_name=full_name,
            hashed_password=get_password_hash(password),
            is_anonymous=False,
            is_admin=True,
            is_verified=True,
            created_at=datetime.utcnow()
        )
        
        db.add(admin_user)
        db.flush()
        
        # Create auth provider record
        auth_provider = UserAuthProvider(
            user_id=admin_user.id,
            provider="email",
            provider_user_id=email,
            provider_email=email,
            created_at=datetime.utcnow()
        )
        
        db.add(auth_provider)
        db.commit()
        
        print(f"✅ Admin user created successfully!")
        print(f"   Email: {email}")
        print(f"   Admin: {admin_user.is_admin}")
        print(f"   User ID: {admin_user.id}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def main():
    print("🚀 Initializing DeepRxiv Admin Dashboard...")
    
    # Create all database tables
    print("📋 Creating database tables...")
    try:
        create_tables()
        print("✅ Database tables created successfully!")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        sys.exit(1)
    
    # Create admin user
    print("\n👤 Creating admin user...")
    
    # Get admin credentials from environment or prompt
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    admin_name = os.getenv("ADMIN_NAME", "Admin User")
    
    if not admin_email or not admin_password:
        print("Please provide admin credentials:")
        admin_email = input("Admin email: ").strip()
        admin_password = input("Admin password: ").strip()
        admin_name = input("Admin full name (optional): ").strip() or "Admin User"
    
    if not admin_email or not admin_password:
        print("❌ Email and password are required!")
        sys.exit(1)
    
    success = create_admin_user(admin_email, admin_password, admin_name)
    
    if success:
        print("\n🎉 Admin dashboard initialization completed!")
        print("\nNext steps:")
        print("1. Start the backend server: python run.py")
        print("2. Start the frontend server: cd ../deeprxiv-frontend && npm run dev")
        print(f"3. Visit http://localhost:3000/login and login with:")
        print(f"   Email: {admin_email}")
        print(f"   Password: [your password]")
        print("4. Go to http://localhost:3000/admin to access the admin dashboard")
    else:
        print("❌ Failed to initialize admin dashboard!")
        sys.exit(1)

if __name__ == "__main__":
    main() 