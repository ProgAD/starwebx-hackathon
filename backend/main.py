from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
import uvicorn

from database import get_db
from models import User, Notification, ActivityLog
from schemas import (
    GoogleAuthRequest, TokenResponse, UserResponse, 
    UserProfileUpdate, DashboardResponse, NotificationResponse
)
from auth import verify_google_token, create_access_token, verify_token

app = FastAPI(title="Coding Ka Big Boss - Hackathon Platform")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


# Dependency to get current user
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user


# Log activity helper
def log_activity(db: Session, user_id: int, activity_type: str, details: dict, request: Request):
    activity_log = ActivityLog(
        user_id=user_id,
        activity_type=activity_type,
        details=details,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    db.add(activity_log)
    db.commit()


# ============== AUTHENTICATION ROUTES ==============

@app.post("/api/auth/google", response_model=TokenResponse)
async def google_auth(
    auth_request: GoogleAuthRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """Authenticate user with Google OAuth token"""
    google_user = verify_google_token(auth_request.token)
    
    if not google_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )
    
    # Check if user exists
    user = db.query(User).filter(User.email == google_user['email']).first()
    
    if not user:
        # Create new user
        user = User(
            email=google_user['email'],
            full_name=google_user['name'],
            profile_picture_url=google_user.get('picture')
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create welcome notification
        notification = Notification(
            user_id=user.id,
            title="Welcome to Coding Ka Big Boss!",
            message="Complete your profile to get started with the hackathon.",
            type="welcome"
        )
        db.add(notification)
        db.commit()
    
    # Log login activity
    log_activity(db, user.id, "login", {"method": "google"}, request)
    
    # Create JWT token
    access_token = create_access_token(data={"user_id": user.id, "email": user.email})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.from_orm(user)
    )


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    return UserResponse.from_orm(current_user)


@app.put("/api/auth/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UserProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile information"""
    for field, value in profile_data.dict(exclude_unset=True).items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    
    # Log profile update
    log_activity(db, current_user.id, "profile_update", profile_data.dict(exclude_unset=True), request)
    
    return UserResponse.from_orm(current_user)


# ============== DASHBOARD ROUTE ==============

@app.get("/api/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user dashboard with stage status and results"""
    from models import Stage1Result, Stage2Project
    
    # Get Stage 1 result
    stage1_result = db.query(Stage1Result).filter(
        Stage1Result.user_id == current_user.id
    ).first()
    
    stage1_status = "not_started"
    if stage1_result:
        if stage1_result.completed_at:
            stage1_status = "completed"
        else:
            stage1_status = "in_progress"
    
    # Get Stage 2 project
    stage2_project = db.query(Stage2Project).filter(
        Stage2Project.user_id == current_user.id
    ).first()
    
    stage2_status = "locked"
    if stage1_result and stage1_result.is_qualified:
        if stage2_project and stage2_project.submitted_at:
            stage2_status = "submitted"
        else:
            stage2_status = "available"
    
    # Get unread notifications count
    notifications_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    
    return DashboardResponse(
        user=UserResponse.from_orm(current_user),
        stage1_status=stage1_status,
        stage1_result=stage1_result,
        stage2_status=stage2_status,
        stage2_project=stage2_project,
        notifications_count=notifications_count
    )


# ============== NOTIFICATIONS ROUTE ==============

@app.get("/api/notifications", response_model=list[NotificationResponse])
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user notifications"""
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(20).all()
    
    return notifications


@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark notification as read"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    db.commit()
    
    return {"status": "success"}


# ============== HEALTH CHECK ==============

@app.get("/")
async def root():
    return {
        "message": "Coding Ka Big Boss - Hackathon Platform API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/api/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint"""
    try:
        # Test database connection
        db.execute("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}


# ============== INCLUDE ROUTERS ==============
from stage1_routes import router as stage1_router

app.include_router(stage1_router)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)