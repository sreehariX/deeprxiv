from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
from pydantic import BaseModel, EmailStr

from database import get_db, User, UserFeedback, AdminSettings, Paper, ChatSession
from auth_service import (
    get_current_admin_user, authenticate_user, create_user_with_email, 
    get_or_create_oauth_user, create_tokens_for_user, track_auth_event,
    UserCreate, UserLogin, OAuthUser, Token, get_google_user_info, get_github_user_info
)
from analytics_service import AnalyticsService

router = APIRouter(prefix="/admin", tags=["admin"])
security = HTTPBearer()

# Pydantic models
class FeedbackResponse(BaseModel):
    feedback_id: int
    response: str
    status: str = "closed"

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_admin: Optional[bool] = None
    is_verified: Optional[bool] = None

class AdminSettingUpdate(BaseModel):
    key: str
    value: str
    description: Optional[str] = None
    setting_type: str = "string"

# Authentication routes
@router.post("/auth/signup", response_model=Token)
@router.post("/auth/register", response_model=Token)
async def register(
    user_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Register a new user with email/password"""
    try:
        user = create_user_with_email(user_data, db)
        
        # Track registration event
        track_auth_event("register", user.id, request, {"provider": "email"}, db)
        
        # Create tokens
        tokens = create_tokens_for_user(user)
        return tokens
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )

@router.post("/auth/login", response_model=Token)
async def login(
    user_data: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    """Login with email/password"""
    user = authenticate_user(user_data.email, user_data.password, db)
    if not user:
        track_auth_event("login_failed", None, request, {"email": user_data.email}, db)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Track login event
    track_auth_event("login", user.id, request, {"provider": "email"}, db)
    
    # Create tokens
    tokens = create_tokens_for_user(user)
    return tokens

@router.post("/auth/oauth/google", response_model=Token)
async def google_oauth(
    access_token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Login/register with Google OAuth"""
    try:
        oauth_user = await get_google_user_info(access_token)
        user = await get_or_create_oauth_user(oauth_user, db)
        
        # Track login event
        track_auth_event("login", user.id, request, {"provider": "google"}, db)
        
        # Create tokens
        tokens = create_tokens_for_user(user)
        return tokens
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google OAuth failed: {str(e)}"
        )

@router.post("/auth/oauth/github", response_model=Token)
async def github_oauth(
    access_token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Login/register with GitHub OAuth"""
    try:
        oauth_user = await get_github_user_info(access_token)
        user = await get_or_create_oauth_user(oauth_user, db)
        
        # Track login event
        track_auth_event("login", user.id, request, {"provider": "github"}, db)
        
        # Create tokens
        tokens = create_tokens_for_user(user)
        return tokens
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub OAuth failed: {str(e)}"
        )

# OAuth URL generation routes
@router.get("/auth/oauth/google/url")
async def get_google_oauth_url():
    """Get Google OAuth authorization URL"""
    import os
    from urllib.parse import urlencode
    
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth not configured"
        )
    
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/auth/callback/google")
    scope = "openid email profile"
    
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope,
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent"
    }
    
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    
    return {"auth_url": auth_url}

@router.get("/auth/oauth/github/url")
async def get_github_oauth_url():
    """Get GitHub OAuth authorization URL"""
    import os
    from urllib.parse import urlencode
    
    client_id = os.getenv("GITHUB_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth not configured"
        )
    
    redirect_uri = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:3000/auth/callback/github")
    scope = "user:email"
    
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope,
        "response_type": "code"
    }
    
    auth_url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    
    return {"auth_url": auth_url}

@router.post("/auth/oauth/google/callback")
async def google_oauth_callback(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Google OAuth callback"""
    import os
    import httpx
    
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/auth/callback/google")
    
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth not configured"
        )
    
    try:
        # Get code from request body
        body = await request.json()
        code = body.get("code")
        
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Authorization code is required"
            )
        
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )
            token_response.raise_for_status()
            token_data = token_response.json()
            
            access_token = token_data["access_token"]
            
            # Get user info and create/login user
            oauth_user = await get_google_user_info(access_token)
            user = await get_or_create_oauth_user(oauth_user, db)
            
            # Track login event
            track_auth_event("login", user.id, request, {"provider": "google"}, db)
            
            # Create tokens
            tokens = create_tokens_for_user(user)
            return tokens
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google OAuth callback failed: {str(e)}"
        )

@router.post("/auth/oauth/github/callback")
async def github_oauth_callback(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle GitHub OAuth callback"""
    import os
    import httpx
    
    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")
    redirect_uri = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:3000/auth/callback/github")
    
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth not configured"
        )
    
    try:
        # Get code from request body
        body = await request.json()
        code = body.get("code")
        
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Authorization code is required"
            )
        
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri
                },
                headers={"Accept": "application/json"}
            )
            token_response.raise_for_status()
            token_data = token_response.json()
            
            access_token = token_data["access_token"]
            
            # Get user info and create/login user
            oauth_user = await get_github_user_info(access_token)
            user = await get_or_create_oauth_user(oauth_user, db)
            
            # Track login event
            track_auth_event("login", user.id, request, {"provider": "github"}, db)
            
            # Create tokens
            tokens = create_tokens_for_user(user)
            return tokens
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub OAuth callback failed: {str(e)}"
        )

# Analytics routes
@router.get("/analytics/overview")
async def get_analytics_overview(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get overview analytics for admin dashboard"""
    analytics = AnalyticsService(db)
    return analytics.get_dashboard_overview(days)

@router.get("/analytics/users")
async def get_user_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get user analytics"""
    analytics = AnalyticsService(db)
    return analytics.get_user_analytics(days)

@router.get("/analytics/papers")
async def get_paper_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get paper analytics"""
    analytics = AnalyticsService(db)
    return analytics.get_paper_analytics(days)

@router.get("/analytics/chats")
async def get_chat_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get chat analytics"""
    analytics = AnalyticsService(db)
    return analytics.get_chat_analytics(days)

@router.get("/analytics/feedback")
async def get_feedback_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get feedback analytics"""
    analytics = AnalyticsService(db)
    return analytics.get_feedback_analytics(days)

@router.get("/analytics/system")
async def get_system_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get system analytics"""
    analytics = AnalyticsService(db)
    return analytics.get_system_analytics(days)

# User management routes
@router.get("/users")
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get list of users"""
    query = db.query(User).filter(User.is_anonymous == False)
    
    if search:
        query = query.filter(
            (User.email.contains(search)) | 
            (User.full_name.contains(search)) |
            (User.username.contains(search))
        )
    
    total = query.count()
    users = query.offset(skip).limit(limit).all()
    
    return {
        "users": [
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "username": user.username,
                "avatar_url": user.avatar_url,
                "is_admin": user.is_admin,
                "is_verified": user.is_verified,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None
            }
            for user in users
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get detailed user information"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's auth providers
    auth_providers = [
        {
            "provider": provider.provider,
            "provider_email": provider.provider_email,
            "created_at": provider.created_at.isoformat()
        }
        for provider in user.auth_providers
    ]
    
    # Get user's chat sessions count
    chat_count = db.query(ChatSession).filter(ChatSession.user_id == user_id).count()
    
    # Get user's feedback count
    feedback_count = db.query(UserFeedback).filter(UserFeedback.user_id == user_id).count()
    
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "is_admin": user.is_admin,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat(),
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "auth_providers": auth_providers,
        "chat_sessions_count": chat_count,
        "feedback_count": feedback_count
    }

@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update user information"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update user fields
    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    if user_update.is_admin is not None:
        user.is_admin = user_update.is_admin
    if user_update.is_verified is not None:
        user.is_verified = user_update.is_verified
    
    db.commit()
    
    return {"message": "User updated successfully"}

# Feedback management routes
@router.get("/feedback")
async def get_feedback(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    feedback_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get user feedback"""
    query = db.query(UserFeedback)
    
    if status:
        query = query.filter(UserFeedback.status == status)
    if feedback_type:
        query = query.filter(UserFeedback.feedback_type == feedback_type)
    
    total = query.count()
    feedback = query.order_by(UserFeedback.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "feedback": [
            {
                "id": fb.id,
                "user_id": fb.user_id,
                "user_email": fb.user.email if fb.user else None,
                "feedback_type": fb.feedback_type,
                "title": fb.title,
                "content": fb.content,
                "rating": fb.rating,
                "status": fb.status,
                "admin_response": fb.admin_response,
                "page_url": fb.page_url,
                "created_at": fb.created_at.isoformat(),
                "updated_at": fb.updated_at.isoformat()
            }
            for fb in feedback
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.put("/feedback/{feedback_id}/respond")
async def respond_to_feedback(
    feedback_id: int,
    response_data: FeedbackResponse,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Respond to user feedback"""
    feedback = db.query(UserFeedback).filter(UserFeedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    feedback.admin_response = response_data.response
    feedback.status = response_data.status
    feedback.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Feedback response added successfully"}

# Settings management routes
@router.get("/settings")
async def get_admin_settings(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get admin settings"""
    settings = db.query(AdminSettings).all()
    
    return {
        "settings": [
            {
                "id": setting.id,
                "key": setting.key,
                "value": setting.value,
                "description": setting.description,
                "setting_type": setting.setting_type,
                "updated_at": setting.updated_at.isoformat()
            }
            for setting in settings
        ]
    }

@router.put("/settings")
async def update_admin_setting(
    setting_data: AdminSettingUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update admin setting"""
    setting = db.query(AdminSettings).filter(AdminSettings.key == setting_data.key).first()
    
    if setting:
        setting.value = setting_data.value
        setting.description = setting_data.description
        setting.setting_type = setting_data.setting_type
        setting.updated_by = current_user.id
        setting.updated_at = datetime.utcnow()
    else:
        setting = AdminSettings(
            key=setting_data.key,
            value=setting_data.value,
            description=setting_data.description,
            setting_type=setting_data.setting_type,
            updated_by=current_user.id
        )
        db.add(setting)
    
    db.commit()
    
    return {"message": "Setting updated successfully"}

# System information routes
@router.get("/system/info")
async def get_system_info(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get system information"""
    # Database stats
    total_papers = db.query(Paper).count()
    processed_papers = db.query(Paper).filter(Paper.processed == True).count()
    total_users = db.query(User).filter(User.is_anonymous == False).count()
    total_chats = db.query(ChatSession).count()
    
    return {
        "database_stats": {
            "total_papers": total_papers,
            "processed_papers": processed_papers,
            "total_users": total_users,
            "total_chats": total_chats
        },
        "system_health": {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat()
        }
    } 