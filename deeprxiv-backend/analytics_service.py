from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import json
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc
from database import (
    PaperAnalytics, SystemAnalytics, User, Paper, ChatSession, 
    ChatMessage, UserFeedback, UserAuthProvider
)
import posthog
import os

# PostHog setup
POSTHOG_API_KEY = os.getenv("POSTHOG_API_KEY")
POSTHOG_HOST = os.getenv("POSTHOG_HOST", "https://app.posthog.com")

if POSTHOG_API_KEY:
    posthog.api_key = POSTHOG_API_KEY
    posthog.host = POSTHOG_HOST

class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    def track_paper_event(
        self, 
        paper_id: int, 
        event_type: str, 
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        referrer: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """Track paper-related events"""
        try:
            # Track in database
            analytics = PaperAnalytics(
                paper_id=paper_id,
                event_type=event_type,
                user_id=user_id,
                session_id=session_id,
                ip_address=ip_address,
                user_agent=user_agent,
                referrer=referrer,
                event_metadata=json.dumps(metadata) if metadata else None
            )
            self.db.add(analytics)
            self.db.commit()

            # Track in PostHog
            if POSTHOG_API_KEY:
                distinct_id = str(user_id) if user_id else session_id or ip_address
                if distinct_id:
                    posthog.capture(
                        distinct_id=distinct_id,
                        event=f"paper_{event_type}",
                        properties={
                            "paper_id": paper_id,
                            "ip": ip_address,
                            "user_agent": user_agent,
                            "referrer": referrer,
                            **(metadata or {})
                        }
                    )
        except Exception as e:
            print(f"Error tracking paper event: {e}")

    def track_system_event(
        self,
        event_type: str,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        response_time: Optional[float] = None,
        status_code: Optional[int] = None,
        error_message: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """Track system-wide events"""
        try:
            # Track in database
            analytics = SystemAnalytics(
                event_type=event_type,
                user_id=user_id,
                session_id=session_id,
                ip_address=ip_address,
                user_agent=user_agent,
                endpoint=endpoint,
                response_time=response_time,
                status_code=status_code,
                error_message=error_message,
                event_metadata=json.dumps(metadata) if metadata else None
            )
            self.db.add(analytics)
            self.db.commit()

            # Track in PostHog
            if POSTHOG_API_KEY:
                distinct_id = str(user_id) if user_id else session_id or ip_address
                if distinct_id:
                    posthog.capture(
                        distinct_id=distinct_id,
                        event=f"system_{event_type}",
                        properties={
                            "endpoint": endpoint,
                            "response_time": response_time,
                            "status_code": status_code,
                            "ip": ip_address,
                            "user_agent": user_agent,
                            **(metadata or {})
                        }
                    )
        except Exception as e:
            print(f"Error tracking system event: {e}")

    def get_dashboard_overview(self, days: int = 30) -> Dict[str, Any]:
        """Get overview statistics for admin dashboard"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # User statistics
        total_users = self.db.query(User).filter(User.is_anonymous == False).count()
        new_users = self.db.query(User).filter(
            User.is_anonymous == False,
            User.created_at >= start_date
        ).count()

        # Paper statistics
        total_papers = self.db.query(Paper).count()
        processed_papers = self.db.query(Paper).filter(Paper.processed == True).count()

        # Chat statistics
        total_chats = self.db.query(ChatSession).count()
        active_chats = self.db.query(ChatSession).filter(
            ChatSession.updated_at >= start_date
        ).count()

        total_messages = self.db.query(ChatMessage).count()
        messages_period = self.db.query(ChatMessage).filter(
            ChatMessage.created_at >= start_date
        ).count()

        # Feedback statistics
        total_feedback = self.db.query(UserFeedback).count()
        pending_feedback = self.db.query(UserFeedback).filter(
            UserFeedback.status == "open"
        ).count()

        # Analytics events
        total_page_views = self.db.query(PaperAnalytics).filter(
            PaperAnalytics.event_type == "view"
        ).count()

        page_views_period = self.db.query(PaperAnalytics).filter(
            PaperAnalytics.event_type == "view",
            PaperAnalytics.created_at >= start_date
        ).count()

        # Error rate
        total_requests = self.db.query(SystemAnalytics).filter(
            SystemAnalytics.endpoint.isnot(None),
            SystemAnalytics.created_at >= start_date
        ).count()

        error_requests = self.db.query(SystemAnalytics).filter(
            SystemAnalytics.status_code >= 400,
            SystemAnalytics.created_at >= start_date
        ).count()

        error_rate = (error_requests / total_requests * 100) if total_requests > 0 else 0

        # Average response time
        avg_response_time = self.db.query(func.avg(SystemAnalytics.response_time)).filter(
            SystemAnalytics.response_time.isnot(None),
            SystemAnalytics.created_at >= start_date
        ).scalar() or 0

        return {
            "overview": {
                "total_users": total_users,
                "new_users_period": new_users,
                "total_papers": total_papers,
                "processed_papers": processed_papers,
                "total_chats": total_chats,
                "active_chats_period": active_chats,
                "total_messages": total_messages,
                "messages_period": messages_period,
                "total_feedback": total_feedback,
                "pending_feedback": pending_feedback,
                "total_page_views": total_page_views,
                "page_views_period": page_views_period,
                "error_rate": round(error_rate, 2),
                "avg_response_time": round(avg_response_time, 3) if avg_response_time else 0
            },
            "period_days": days
        }

    def get_user_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Get user analytics data"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Daily user registrations
        daily_registrations = self.db.query(
            func.date(User.created_at).label('date'),
            func.count(User.id).label('count')
        ).filter(
            User.is_anonymous == False,
            User.created_at >= start_date
        ).group_by(func.date(User.created_at)).all()

        # Authentication provider breakdown
        auth_providers = self.db.query(
            UserAuthProvider.provider,
            func.count(UserAuthProvider.id).label('count')
        ).group_by(UserAuthProvider.provider).all()

        # Active users (users who logged in recently)
        active_users = self.db.query(User).filter(
            User.last_login >= start_date,
            User.is_anonymous == False
        ).count()

        return {
            "daily_registrations": [
                {"date": str(reg.date), "count": reg.count} 
                for reg in daily_registrations
            ],
            "auth_providers": [
                {"provider": provider, "count": count} 
                for provider, count in auth_providers
            ],
            "active_users": active_users,
            "period_days": days
        }

    def get_paper_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Get paper analytics data"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Most viewed papers
        most_viewed = self.db.query(
            Paper.id,
            Paper.title,
            Paper.arxiv_id,
            func.count(PaperAnalytics.id).label('views')
        ).join(
            PaperAnalytics, Paper.id == PaperAnalytics.paper_id
        ).filter(
            PaperAnalytics.event_type == "view",
            PaperAnalytics.created_at >= start_date
        ).group_by(
            Paper.id, Paper.title, Paper.arxiv_id
        ).order_by(desc('views')).limit(10).all()

        # Daily paper views
        daily_views = self.db.query(
            func.date(PaperAnalytics.created_at).label('date'),
            func.count(PaperAnalytics.id).label('views')
        ).filter(
            PaperAnalytics.event_type == "view",
            PaperAnalytics.created_at >= start_date
        ).group_by(func.date(PaperAnalytics.created_at)).all()

        # Papers with most chats
        most_chatted = self.db.query(
            Paper.id,
            Paper.title,
            Paper.arxiv_id,
            func.count(ChatSession.id).label('chats')
        ).join(
            ChatSession, Paper.id == ChatSession.paper_id
        ).filter(
            ChatSession.created_at >= start_date
        ).group_by(
            Paper.id, Paper.title, Paper.arxiv_id
        ).order_by(desc('chats')).limit(10).all()

        return {
            "most_viewed": [
                {
                    "id": paper.id,
                    "title": paper.title or f"Paper {paper.arxiv_id}",
                    "arxiv_id": paper.arxiv_id,
                    "views": paper.views
                }
                for paper in most_viewed
            ],
            "daily_views": [
                {"date": str(view.date), "views": view.views}
                for view in daily_views
            ],
            "most_chatted": [
                {
                    "id": paper.id,
                    "title": paper.title or f"Paper {paper.arxiv_id}",
                    "arxiv_id": paper.arxiv_id,
                    "chats": paper.chats
                }
                for paper in most_chatted
            ],
            "period_days": days
        }

    def get_chat_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Get chat analytics data"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Daily chat sessions
        daily_chats = self.db.query(
            func.date(ChatSession.created_at).label('date'),
            func.count(ChatSession.id).label('chats')
        ).filter(
            ChatSession.created_at >= start_date
        ).group_by(func.date(ChatSession.created_at)).all()

        # Daily messages
        daily_messages = self.db.query(
            func.date(ChatMessage.created_at).label('date'),
            func.count(ChatMessage.id).label('messages')
        ).filter(
            ChatMessage.created_at >= start_date
        ).group_by(func.date(ChatMessage.created_at)).all()

        # Average messages per chat
        avg_messages = self.db.query(
            func.avg(
                self.db.query(func.count(ChatMessage.id))
                .filter(ChatMessage.session_id == ChatSession.id)
                .scalar_subquery()
            )
        ).filter(ChatSession.created_at >= start_date).scalar() or 0

        # Feedback stats
        positive_feedback = self.db.query(ChatMessage).filter(
            ChatMessage.thumbs_up == True,
            ChatMessage.created_at >= start_date
        ).count()

        negative_feedback = self.db.query(ChatMessage).filter(
            ChatMessage.thumbs_down == True,
            ChatMessage.created_at >= start_date
        ).count()

        return {
            "daily_chats": [
                {"date": str(chat.date), "chats": chat.chats}
                for chat in daily_chats
            ],
            "daily_messages": [
                {"date": str(msg.date), "messages": msg.messages}
                for msg in daily_messages
            ],
            "avg_messages_per_chat": round(avg_messages, 2),
            "positive_feedback": positive_feedback,
            "negative_feedback": negative_feedback,
            "period_days": days
        }

    def get_feedback_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Get feedback analytics data"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Feedback by type
        feedback_by_type = self.db.query(
            UserFeedback.feedback_type,
            func.count(UserFeedback.id).label('count')
        ).filter(
            UserFeedback.created_at >= start_date
        ).group_by(UserFeedback.feedback_type).all()

        # Feedback by status
        feedback_by_status = self.db.query(
            UserFeedback.status,
            func.count(UserFeedback.id).label('count')
        ).group_by(UserFeedback.status).all()

        # Average rating
        avg_rating = self.db.query(func.avg(UserFeedback.rating)).filter(
            UserFeedback.rating.isnot(None),
            UserFeedback.created_at >= start_date
        ).scalar() or 0

        # Recent feedback
        recent_feedback = self.db.query(UserFeedback).filter(
            UserFeedback.created_at >= start_date
        ).order_by(desc(UserFeedback.created_at)).limit(10).all()

        return {
            "feedback_by_type": [
                {"type": fb_type, "count": count}
                for fb_type, count in feedback_by_type
            ],
            "feedback_by_status": [
                {"status": status, "count": count}
                for status, count in feedback_by_status
            ],
            "avg_rating": round(avg_rating, 2),
            "recent_feedback": [
                {
                    "id": fb.id,
                    "type": fb.feedback_type,
                    "title": fb.title,
                    "content": fb.content[:100] + "..." if len(fb.content) > 100 else fb.content,
                    "rating": fb.rating,
                    "status": fb.status,
                    "created_at": fb.created_at.isoformat()
                }
                for fb in recent_feedback
            ],
            "period_days": days
        }

    def get_system_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Get system analytics data"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        try:
            # API endpoint usage
            endpoint_usage = self.db.query(
                SystemAnalytics.endpoint,
                func.count(SystemAnalytics.id).label('requests'),
                func.avg(SystemAnalytics.response_time).label('avg_response_time')
            ).filter(
                SystemAnalytics.endpoint.isnot(None),
                SystemAnalytics.created_at >= start_date
            ).group_by(SystemAnalytics.endpoint).order_by(desc('requests')).limit(10).all()

            # Error rate by day
            daily_errors = self.db.query(
                func.date(SystemAnalytics.created_at).label('date'),
                func.count(SystemAnalytics.id).label('total_requests'),
                func.sum(
                    func.case([(SystemAnalytics.status_code >= 400, 1)], else_=0)
                ).label('errors')
            ).filter(
                SystemAnalytics.endpoint.isnot(None),
                SystemAnalytics.created_at >= start_date
            ).group_by(func.date(SystemAnalytics.created_at)).all()

            # Recent errors
            recent_errors = self.db.query(SystemAnalytics).filter(
                SystemAnalytics.status_code >= 400,
                SystemAnalytics.created_at >= start_date
            ).order_by(desc(SystemAnalytics.created_at)).limit(10).all()

        except Exception as e:
            print(f"Error in system analytics query: {e}")
            # Return empty data if queries fail
            endpoint_usage = []
            daily_errors = []
            recent_errors = []

        return {
            "endpoint_usage": [
                {
                    "endpoint": endpoint or "unknown",
                    "requests": requests or 0,
                    "avg_response_time": round(avg_response_time, 3) if avg_response_time else 0
                }
                for endpoint, requests, avg_response_time in endpoint_usage
            ],
            "daily_errors": [
                {
                    "date": str(error.date),
                    "total_requests": error.total_requests or 0,
                    "errors": error.errors or 0,
                    "error_rate": round((error.errors / error.total_requests * 100), 2) if error.total_requests and error.total_requests > 0 else 0
                }
                for error in daily_errors
            ],
            "recent_errors": [
                {
                    "id": error.id,
                    "endpoint": error.endpoint or "unknown",
                    "status_code": error.status_code or 0,
                    "error_message": error.error_message or "No message",
                    "created_at": error.created_at.isoformat() if error.created_at else ""
                }
                for error in recent_errors
            ],
            "period_days": days
        } 