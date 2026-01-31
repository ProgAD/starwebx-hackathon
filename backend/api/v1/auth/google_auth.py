from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from starlette.middleware.sessions import SessionMiddleware
from starlette.applications import Starlette
from dotenv import load_dotenv
import os

# -------------------------------------------------
# Load ENV
# -------------------------------------------------

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

# -------------------------------------------------
# Router
# -------------------------------------------------

router = APIRouter(prefix="/auth/google", tags=["Google Auth"])

# -------------------------------------------------
# OAuth Setup
# -------------------------------------------------

oauth = OAuth(config)

oauth.register(
    name="google",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope": "openid email profile"
    }
)

# -------------------------------------------------
# LOGIN
# -------------------------------------------------

@router.get("/login")
async def google_login(request: Request):
    """
    Redirect user to Google login
    """
    redirect_uri = GOOGLE_REDIRECT_URI
    return await oauth.google.authorize_redirect(request, redirect_uri)


# -------------------------------------------------
# CALLBACK
# -------------------------------------------------

@router.get("/callback")
async def google_callback(request: Request):
    """
    Google redirects here after login
    """
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception:
        raise HTTPException(status_code=400, detail="Google authentication failed")

    user_info = token.get("userinfo")

    if not user_info:
        raise HTTPException(status_code=400, detail="Unable to fetch user info")

    # Example user object
    user = {
        "email": user_info.get("email"),
        "name": user_info.get("name"),
        "picture": user_info.get("picture"),
        "provider": "google"
    }

    # 🔐 Here you would:
    # 1. Check if user exists in DB
    # 2. Create if not exists
    # 3. Generate JWT

    return JSONResponse({
        "message": "Login successful",
        "user": user
    })
