# Coding Ka Big Boss - Hackathon Platform

## Part 1: Foundation & Authentication ✅

### What's Completed:
- ✅ Database schema with SQLAlchemy ORM
- ✅ FastAPI backend with JWT authentication
- ✅ Google OAuth integration
- ✅ User registration and profile management
- ✅ Vue.js frontend with CDN setup
- ✅ Dashboard layout
- ✅ Notifications system
- ✅ Activity logging

## Setup Instructions

### 1. Database Setup

```bash
# Install MySQL (if not already installed)
# Create database
mysql -u root -p
CREATE DATABASE hackathon_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your credentials:
# - DATABASE_URL
# - SECRET_KEY (generate a secure random string)
# - GOOGLE_CLIENT_ID (from Google Cloud Console)
# - OPENAI_API_KEY

# Initialize database tables
python database.py

# Run the server
python main.py
```

The backend will run on `http://localhost:8000`

### 3. Frontend Setup

```bash
cd frontend

# Open index.html in your browser
# OR use a simple HTTP server:
python -m http.server 8080

# Then open: http://localhost:8080
```

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized JavaScript origins:
   - `http://localhost:8080`
   - `http://localhost:8000`
6. Copy the Client ID
7. Update `index.html` line with your Client ID:
   ```html
   data-client_id="YOUR_GOOGLE_CLIENT_ID"
   ```
8. Add the Client ID to `.env` file in backend

## API Endpoints Available

### Authentication
- `POST /api/auth/google` - Login with Google
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Dashboard
- `GET /api/dashboard` - Get dashboard data

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/{id}/read` - Mark as read

### Health
- `GET /` - API info
- `GET /api/health` - Health check

## Testing Part 1

1. Start the backend server
2. Open frontend in browser
3. Click "Sign in with Google"
4. Complete OAuth flow
5. You should see the dashboard
6. Try updating your profile
7. Check notifications

## Next Steps

**Part 2:** Stage 1 Exam Portal (MCQ + Coding Questions)

---

## Troubleshooting

### Database Connection Error
- Check MySQL is running
- Verify DATABASE_URL in .env
- Ensure database exists

### Google OAuth Error
- Verify GOOGLE_CLIENT_ID is correct
- Check authorized origins in Google Console
- Clear browser cache

### CORS Error
- Backend CORS is set to allow all origins
- If issues persist, add specific origin in main.py