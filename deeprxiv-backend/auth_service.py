from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import os
import json
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from authlib.integrations.httpx_client import AsyncOAuth2Client
import httpx
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from database import get_db, User, UserAuthProvider, SystemAnalytics, get_password_hash, verify_password
import secrets
import posthog

# Environment variables
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30

# OAuth settings
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

# PostHog setup
POSTHOG_API_KEY = os.getenv("POSTHOG_API_KEY")
POSTHOG_HOST = os.getenv("POSTHOG_HOST", "https://app.posthog.com")

if POSTHOG_API_KEY:
    posthog.api_key = POSTHOG_API_KEY
    posthog.host = POSTHOG_HOST

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Pydantic models
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    user: Dict[str, Any]

class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class OAuthUser(BaseModel):
    provider: str
    provider_user_id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    provider_data: Dict[str, Any] = {}

# Analytics helper
def track_auth_event(event_type: str, user_id: Optional[int], request: Request, 
                    metadata: Optional[Dict] = None, db: Session = None):
    """Track authentication events"""
    try:
        # Track in PostHog
        if POSTHOG_API_KEY and user_id:
            posthog.capture(
                distinct_id=str(user_id),
                event=f"auth_{event_type}",
                properties={
                    "ip": request.client.host if request.client else None,
                    "user_agent": request.headers.get("user-agent"),
                    **(metadata or {})
                }
            )
        
        # Track in database
        if db:
            analytics = SystemAnalytics(
                event_type=f"auth_{event_type}",
                user_id=user_id,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                event_metadata=json.dumps(metadata) if metadata else None
            )
            db.add(analytics)
            db.commit()
    except Exception as e:
        print(f"Error tracking auth event: {e}")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token_data = TokenData(user_id=user_id)
        return token_data
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token_data = verify_token(credentials.credentials)
    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

async def get_current_admin_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user but don't require authentication"""
    if not credentials:
        return None
    try:
        token_data = verify_token(credentials.credentials)
        user = db.query(User).filter(User.id == token_data.user_id).first()
        return user
    except HTTPException:
        return None

# Authentication functions
def authenticate_user(email: str, password: str, db: Session):
    # Find user with email auth provider
    auth_provider = db.query(UserAuthProvider).filter(
        UserAuthProvider.provider == "email",
        UserAuthProvider.provider_email == email
    ).first()
    
    if not auth_provider:
        return False
    
    user = auth_provider.user
    if not user or not verify_password(password, user.hashed_password):
        return False
    
    return user

def create_user_with_email(user_data: UserCreate, db: Session):
    # Check if user already exists
    existing_auth = db.query(UserAuthProvider).filter(
        UserAuthProvider.provider == "email",
        UserAuthProvider.provider_email == user_data.email
    ).first()
    
    if existing_auth:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        is_anonymous=False,
        is_verified=False
    )
    db.add(user)
    db.flush()
    
    # Create auth provider record
    auth_provider = UserAuthProvider(
        user_id=user.id,
        provider="email",
        provider_user_id=user_data.email,
        provider_email=user_data.email
    )
    db.add(auth_provider)
    db.commit()
    
    return user

async def get_or_create_oauth_user(oauth_user: OAuthUser, db: Session):
    # Check if user exists with this provider
    auth_provider = db.query(UserAuthProvider).filter(
        UserAuthProvider.provider == oauth_user.provider,
        UserAuthProvider.provider_user_id == oauth_user.provider_user_id
    ).first()
    
    if auth_provider:
        # Update user info
        user = auth_provider.user
        user.full_name = oauth_user.full_name or user.full_name
        user.avatar_url = oauth_user.avatar_url or user.avatar_url
        user.last_login = datetime.utcnow()
        auth_provider.provider_data = json.dumps(oauth_user.provider_data)
        db.commit()
        return user
    
    # Check if user exists with same email but different provider
    existing_user = db.query(User).filter(User.email == oauth_user.email).first()
    
    if existing_user:
        # Link new provider to existing user
        new_auth_provider = UserAuthProvider(
            user_id=existing_user.id,
            provider=oauth_user.provider,
            provider_user_id=oauth_user.provider_user_id,
            provider_email=oauth_user.email,
            provider_data=json.dumps(oauth_user.provider_data)
        )
        db.add(new_auth_provider)
        existing_user.last_login = datetime.utcnow()
        db.commit()
        return existing_user
    
    # Create new user
    user = User(
        email=oauth_user.email,
        full_name=oauth_user.full_name,
        avatar_url=oauth_user.avatar_url,
        is_anonymous=False,
        is_verified=True,  # OAuth users are considered verified
        last_login=datetime.utcnow()
    )
    db.add(user)
    db.flush()
    
    # Create auth provider record
    auth_provider = UserAuthProvider(
        user_id=user.id,
        provider=oauth_user.provider,
        provider_user_id=oauth_user.provider_user_id,
        provider_email=oauth_user.email,
        provider_data=json.dumps(oauth_user.provider_data)
    )
    db.add(auth_provider)
    db.commit()
    
    return user

# OAuth helpers
async def get_google_user_info(access_token: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        response.raise_for_status()
        user_data = response.json()
        
        return OAuthUser(
            provider="google",
            provider_user_id=user_data["id"],
            email=user_data["email"],
            full_name=user_data.get("name"),
            avatar_url=user_data.get("picture"),
            provider_data=user_data
        )

async def get_github_user_info(access_token: str):
    async with httpx.AsyncClient() as client:
        # Get user info
        user_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        user_response.raise_for_status()
        user_data = user_response.json()
        
        # Get user emails
        email_response = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        email_response.raise_for_status()
        emails = email_response.json()
        
        # Find primary email
        primary_email = next(
            (email["email"] for email in emails if email["primary"]),
            user_data.get("email")
        )
        
        return OAuthUser(
            provider="github",
            provider_user_id=str(user_data["id"]),
            email=primary_email,
            full_name=user_data.get("name"),
            avatar_url=user_data.get("avatar_url"),
            provider_data=user_data
        )

def create_tokens_for_user(user: User):
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email},
        expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id), "email": user.email}
    )
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "is_admin": user.is_admin,
            "is_verified": user.is_verified
        }
    ) 