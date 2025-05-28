from sqlalchemy import create_engine, Column, Integer, String, LargeBinary, JSON, Text, Boolean, DateTime, ForeignKey, Float, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import os
from dotenv import load_dotenv
from datetime import datetime
import uuid
from passlib.context import CryptContext

# Load environment variables
load_dotenv()

# Get database URL from environment variable or use SQLite as fallback
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./deeprxiv.db")

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    arxiv_id = Column(String, unique=True, index=True)
    title = Column(String, nullable=True)
    authors = Column(String, nullable=True)
    abstract = Column(Text, nullable=True)
    pdf_url = Column(String, nullable=True)
    pdf_data = Column(LargeBinary, nullable=True)
    extracted_text = Column(Text, nullable=True)
    extracted_images = Column(Text, nullable=True)  # JSON string of image data
    sections_data = Column(Text, nullable=True)  # JSON string of sections and subsections
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    chat_sessions = relationship("ChatSession", back_populates="paper")
    analytics = relationship("PaperAnalytics", back_populates="paper")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=True)  # For email/password auth
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    is_anonymous = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # Relationships
    chat_sessions = relationship("ChatSession", back_populates="user")
    auth_providers = relationship("UserAuthProvider", back_populates="user")
    feedback = relationship("UserFeedback", back_populates="user")

class UserAuthProvider(Base):
    __tablename__ = "user_auth_providers"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    provider = Column(String, nullable=False)  # "google", "github", "email"
    provider_user_id = Column(String, nullable=False)  # External provider's user ID
    provider_email = Column(String, nullable=True)
    provider_data = Column(Text, nullable=True)  # JSON string of additional provider data
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="auth_providers")
    
    # Unique constraint for provider + provider_user_id
    __table_args__ = (Index('idx_provider_user', 'provider', 'provider_user_id', unique=True),)

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=True)
    paper_id = Column(Integer, ForeignKey("papers.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_public = Column(Boolean, default=True)  # Public by default for anonymous users
    share_url = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    paper = relationship("Paper", back_populates="chat_sessions")
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    chain_of_thought = Column(Text, nullable=True)  # For reasoning models
    query_data = Column(Text, nullable=True)  # JSON string of query parameters and results
    sources = Column(Text, nullable=True)  # JSON string of sources used
    citations = Column(Text, nullable=True)  # JSON string of citations
    images = Column(Text, nullable=True)  # JSON string of images
    highlighted_images = Column(Text, nullable=True)  # JSON string of highlighted images
    model_used = Column(String, nullable=True)  # Model name used for response
    thumbs_up = Column(Boolean, nullable=True)  # User feedback
    thumbs_down = Column(Boolean, nullable=True)  # User feedback
    suggested_answer = Column(Text, nullable=True)  # User suggested better answer
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session = relationship("ChatSession", back_populates="messages")

class UserFeedback(Base):
    __tablename__ = "user_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    session_id = Column(String, nullable=True)  # Anonymous session tracking
    feedback_type = Column(String, nullable=False)  # "bug", "feature", "general", "quality"
    title = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    rating = Column(Integer, nullable=True)  # 1-5 star rating
    page_url = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    status = Column(String, default="open")  # "open", "closed", "in_progress"
    admin_response = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="feedback")

class PaperAnalytics(Base):
    __tablename__ = "paper_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"), nullable=False)
    event_type = Column(String, nullable=False)  # "view", "chat_start", "chat_message", "download"
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    session_id = Column(String, nullable=True)  # For anonymous tracking
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    referrer = Column(String, nullable=True)
    event_metadata = Column(Text, nullable=True)  # JSON string for additional event data
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    paper = relationship("Paper", back_populates="analytics")
    
    # Index for analytics queries
    __table_args__ = (
        Index('idx_paper_analytics_date', 'paper_id', 'created_at'),
        Index('idx_analytics_event_date', 'event_type', 'created_at'),
    )

class SystemAnalytics(Base):
    __tablename__ = "system_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False)  # "login", "logout", "signup", "error", "api_call"
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    session_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    endpoint = Column(String, nullable=True)  # API endpoint called
    response_time = Column(Float, nullable=True)  # Response time in seconds
    status_code = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    event_metadata = Column(Text, nullable=True)  # JSON string for additional data
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Index for analytics queries
    __table_args__ = (
        Index('idx_system_analytics_date', 'event_type', 'created_at'),
        Index('idx_system_analytics_user', 'user_id', 'created_at'),
    )

class AdminSettings(Base):
    __tablename__ = "admin_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    setting_type = Column(String, default="string")  # "string", "boolean", "integer", "json"
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Create all tables in the database
def create_tables():
    Base.metadata.create_all(bind=engine)

# Get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper functions for password hashing
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password) 