# OAuth Setup Guide for DeepRxiv

This guide will help you set up Google and GitHub OAuth authentication for DeepRxiv.

## 🔧 **Environment Variables Required**

Add these to your `.env` file in the `deeprxiv-backend` directory:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback/google

# GitHub OAuth  
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_REDIRECT_URI=http://localhost:3000/auth/callback/github
```

## 🔵 **Google OAuth Setup**

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API (or Google Identity API)

### Step 2: Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type
3. Fill in required fields:
   - App name: `DeepRxiv`
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes: `email`, `profile`, `openid`
5. Add test users (your email) if in testing mode

### Step 3: Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client IDs**
3. Application type: **Web application**
4. Name: `DeepRxiv Web Client`
5. **Authorized redirect URIs**:
   ```
   http://localhost:3000/auth/callback/google
   ```
6. Copy the **Client ID** and **Client Secret**

### Step 4: Update Environment Variables
```env
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
```

## ⚫ **GitHub OAuth Setup**

### Step 1: Create GitHub OAuth App
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the form:
   - **Application name**: `DeepRxiv`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/auth/callback/github`
4. Click **Register application**

### Step 2: Get Client Credentials
1. Copy the **Client ID**
2. Click **Generate a new client secret**
3. Copy the **Client Secret** (save it immediately, you won't see it again)

### Step 3: Update Environment Variables
```env
GITHUB_CLIENT_ID=Iv1.abcdefghijklmnop
GITHUB_CLIENT_SECRET=abcdefghijklmnopqrstuvwxyz1234567890abcdef
```

## 🚀 **Testing OAuth Integration**

### 1. Start the Backend
```bash
cd deeprxiv-backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start the Frontend
```bash
cd deeprxiv-frontend
npm run dev
```

### 3. Test OAuth URLs
Visit these URLs to test OAuth URL generation:
- Google: http://localhost:8000/admin/auth/oauth/google/url
- GitHub: http://localhost:8000/admin/auth/oauth/github/url

### 4. Test Login/Signup Flow
1. Go to http://localhost:3000/login
2. Click **Google** or **GitHub** button
3. Complete OAuth flow
4. Should redirect back and log you in

## 🔍 **Troubleshooting**

### Common Issues

#### "OAuth not configured" Error
- Check that environment variables are set correctly
- Restart the backend server after adding variables
- Verify variable names match exactly

#### "Redirect URI mismatch" Error
- Ensure redirect URIs in OAuth apps match exactly:
  - Google: `http://localhost:3000/auth/callback/google`
  - GitHub: `http://localhost:3000/auth/callback/github`

#### "Invalid client" Error
- Double-check Client ID and Client Secret
- Ensure OAuth app is not suspended
- For Google: Check if APIs are enabled

#### CORS Issues
- Backend should allow `http://localhost:3000` origin
- Check CORS configuration in `main.py`

### Debug Steps
1. Check backend logs for detailed error messages
2. Verify environment variables are loaded:
   ```python
   import os
   print(os.getenv('GOOGLE_CLIENT_ID'))
   ```
3. Test OAuth URLs directly in browser
4. Check browser network tab for failed requests

## 🔒 **Security Notes**

1. **Never commit secrets to git**
   - Add `.env` to `.gitignore`
   - Use environment variables in production

2. **Production Setup**
   - Update redirect URIs for production domain
   - Use HTTPS in production
   - Rotate secrets regularly

3. **Scope Permissions**
   - Only request necessary scopes
   - Current scopes: `email`, `profile`, `openid`

## 📝 **OAuth Flow Summary**

1. User clicks OAuth button
2. Frontend requests OAuth URL from backend
3. User redirected to OAuth provider
4. User authorizes application
5. Provider redirects to callback URL with code
6. Frontend sends code to backend callback endpoint
7. Backend exchanges code for access token
8. Backend gets user info from provider
9. Backend creates/updates user in database
10. Backend returns JWT tokens to frontend
11. Frontend stores tokens and redirects user

## ✅ **Verification Checklist**

- [ ] Google Cloud project created
- [ ] Google OAuth consent screen configured
- [ ] Google OAuth credentials created
- [ ] GitHub OAuth app created
- [ ] Environment variables set
- [ ] Backend server restarted
- [ ] OAuth URL endpoints working
- [ ] Login page OAuth buttons functional
- [ ] Signup page OAuth buttons functional
- [ ] Callback pages created
- [ ] Full OAuth flow tested

## 🆘 **Need Help?**

If you encounter issues:
1. Check the backend logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure OAuth apps are configured with correct redirect URIs
4. Test each step of the OAuth flow individually

The OAuth integration is now fully functional and ready for testing! 