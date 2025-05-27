# DeepRxiv Admin Dashboard Setup Guide

This guide will help you set up the admin dashboard for DeepRxiv with comprehensive analytics, user management, and multi-provider authentication.

## Features

### 🔐 Authentication
- **Email/Password Authentication** with secure bcrypt hashing
- **Google OAuth** integration
- **GitHub OAuth** integration
- **JWT tokens** with refresh mechanism
- **Admin role-based access control**

### 📊 Analytics & Monitoring
- **PostHog integration** for advanced analytics
- **User behavior tracking** (registrations, logins, page views)
- **Paper analytics** (views, downloads, chat interactions)
- **System performance monitoring** (response times, error rates)
- **Real-time dashboard** with key metrics

### 👥 User Management
- **User listing and search**
- **Role management** (admin/regular users)
- **Account verification status**
- **Authentication provider tracking**

### 💬 Feedback Management
- **User feedback collection**
- **Admin response system**
- **Feedback categorization and status tracking**
- **Rating system**

### ⚙️ System Administration
- **System health monitoring**
- **Database statistics**
- **Configuration management**
- **Error tracking and reporting**

## Prerequisites

- Python 3.8+
- Node.js 16+
- PostgreSQL (recommended) or SQLite (development)
- Redis (optional, for caching)

## Backend Setup

### 1. Install Dependencies

```bash
cd deeprxiv-backend
pip install -r requirements.txt
```

### 2. Environment Configuration

Copy the environment template and configure your settings:

```bash
cp env_template.txt .env.local
```

Edit `.env.local` with your configuration:

```env
# Database - Use PostgreSQL in production
DATABASE_URL=postgresql://username:password@localhost/deeprxiv
# or for development with SQLite:
# DATABASE_URL=sqlite:///./deeprxiv.db

# Authentication - Generate a strong secret key
SECRET_KEY=your-super-secret-jwt-key-here-change-this

# Google OAuth (Get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth (Get from GitHub Developer Settings)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# PostHog Analytics (Get from PostHog dashboard)
POSTHOG_API_KEY=phc_your-posthog-api-key
POSTHOG_HOST=https://app.posthog.com

# Your existing API keys
GEMINI_API_KEY=your-gemini-api-key
PERPLEXITY_API_KEY=your-perplexity-api-key
```

### 3. Database Setup

Initialize the database and create the first admin user:

```bash
python init_admin.py
```

You'll be prompted to enter:
- Admin email address
- Admin password
- Admin full name (optional)

### 4. OAuth Setup (Optional but Recommended)

#### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/auth/callback/google` (development)
   - `https://yourdomain.com/auth/callback/google` (production)

#### GitHub OAuth Setup
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set authorization callback URL:
   - `http://localhost:3000/auth/callback/github` (development)
   - `https://yourdomain.com/auth/callback/github` (production)

### 5. PostHog Analytics Setup (Optional)

1. Sign up at [PostHog](https://posthog.com/)
2. Create a new project
3. Copy your project API key
4. Add it to your `.env.local` file

### 6. Start Backend Server

```bash
python run.py
```

The backend will be available at `http://localhost:8000`

## Frontend Setup

### 1. Install Dependencies

```bash
cd deeprxiv-frontend
npm install
```

### 2. Environment Configuration

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_POSTHOG_KEY=phc_your-posthog-api-key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### 3. Start Frontend Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Accessing the Admin Dashboard

1. Visit `http://localhost:3000/login`
2. Sign in with your admin credentials
3. Navigate to `http://localhost:3000/admin`

## Admin Dashboard Features

### Overview Dashboard
- **User Statistics**: Total users, new registrations, active users
- **Paper Analytics**: Total papers, processing status, popular papers
- **Chat Metrics**: Total conversations, messages, user engagement
- **System Health**: Response times, error rates, uptime

### User Management (`/admin/users`)
- View all registered users
- Search users by email or name
- Edit user roles and verification status
- View user activity and statistics

### Feedback Management (`/admin/feedback`)
- Review user feedback and bug reports
- Respond to user inquiries
- Track feedback resolution status
- Analytics on feedback trends

### Analytics Dashboard (`/admin/analytics`)
- Detailed charts and graphs
- User engagement metrics
- Paper popularity analytics
- System performance monitoring
- Export capabilities

### System Settings (`/admin/settings`)
- Configure system-wide settings
- Manage feature flags
- Update configuration values
- Monitor system health

## Security Best Practices

### Authentication Security
- **JWT tokens** with short expiration times
- **Refresh token** mechanism for secure session management
- **Password hashing** using bcrypt with salt
- **Rate limiting** on authentication endpoints

### Database Security
- **SQL injection protection** via SQLAlchemy ORM
- **Input validation** using Pydantic models
- **Encrypted passwords** never stored in plain text
- **Audit logging** for admin actions

### API Security
- **CORS configuration** for frontend access
- **Role-based authorization** for admin endpoints
- **Request validation** and sanitization
- **Error handling** without information leakage

## Monitoring and Analytics

### PostHog Integration
The admin dashboard integrates with PostHog for comprehensive analytics:

- **User Journey Tracking**: Registration, login, feature usage
- **Custom Events**: Paper views, chat interactions, downloads
- **Funnel Analysis**: User onboarding and engagement
- **Cohort Analysis**: User retention and churn
- **A/B Testing**: Feature experimentation

### Database Analytics
Built-in analytics track:

- **User Behavior**: Login patterns, feature usage
- **Paper Metrics**: Views, popularity, processing times
- **Chat Analytics**: Conversation length, user satisfaction
- **System Performance**: Response times, error rates

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check DATABASE_URL in .env.local
   - Ensure PostgreSQL is running
   - Verify database credentials

2. **Authentication Failures**
   - Verify SECRET_KEY is set
   - Check OAuth credentials
   - Ensure JWT tokens haven't expired

3. **PostHog Not Tracking**
   - Verify POSTHOG_API_KEY is correct
   - Check browser console for errors
   - Ensure PostHog is not blocked by ad blockers

4. **CORS Errors**
   - Check frontend URL in CORS settings
   - Verify API_URL in frontend environment

### Logs and Debugging

- Backend logs: Check console output from `python run.py`
- Frontend logs: Check browser developer console
- Database logs: Check PostgreSQL logs if using PostgreSQL

## Production Deployment

### Backend Deployment
1. Use PostgreSQL instead of SQLite
2. Set strong SECRET_KEY
3. Configure proper CORS origins
4. Use environment variables for all secrets
5. Set up SSL/TLS certificates
6. Configure proper logging
7. Set up monitoring and alerting

### Frontend Deployment
1. Build for production: `npm run build`
2. Configure production API URL
3. Set up CDN for static assets
4. Configure proper caching headers
5. Set up SSL/TLS certificates

### Security Checklist
- [ ] Strong, unique SECRET_KEY
- [ ] PostgreSQL with encrypted connections
- [ ] OAuth redirect URIs properly configured
- [ ] CORS origins restricted to your domain
- [ ] All API keys in environment variables
- [ ] Admin access restricted to trusted IPs
- [ ] Regular security updates applied
- [ ] Backup strategy implemented

## API Documentation

Once the server is running, visit `http://localhost:8000/docs` for interactive API documentation.

### Key Admin Endpoints

- `POST /admin/auth/login` - Admin authentication
- `GET /admin/analytics/overview` - Dashboard overview
- `GET /admin/users` - User management
- `GET /admin/feedback` - Feedback management
- `GET /admin/analytics/*` - Detailed analytics

## Support and Maintenance

### Regular Maintenance Tasks
1. **Database Backups**: Set up automated backups
2. **Security Updates**: Keep dependencies updated
3. **Log Rotation**: Prevent log files from growing too large
4. **Performance Monitoring**: Track response times and resource usage
5. **User Feedback Review**: Regularly check and respond to feedback

### Monitoring Alerts
Set up alerts for:
- High error rates (>5%)
- Slow response times (>2 seconds)
- Failed login attempts
- Database connection issues
- High CPU/memory usage

## Contributing

When adding new features to the admin dashboard:

1. **Database Changes**: Update models in `database.py`
2. **API Endpoints**: Add routes in `admin_routes.py`
3. **Analytics**: Update `analytics_service.py`
4. **Frontend**: Add components and pages
5. **Documentation**: Update this README

## License

This admin dashboard is part of the DeepRxiv project and follows the same license terms. 