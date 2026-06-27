from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.models import User
from app.services.security import hash_password, verify_password, create_access_token, verify_access_token

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    plan: str = "Free"


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    email_clean = req.email.strip().lower()
    if "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email format.")

    # Check if user already exists
    exists = db.query(User).filter(User.email == email_clean).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    hashed = hash_password(req.password)
    plan_clean = req.plan.strip().capitalize() if req.plan else "Free"
    if plan_clean not in ["Free", "Pro", "Analyst"]:
        plan_clean = "Free"
    
    user = User(name=req.name.strip(), email=email_clean, password_hash=hashed, plan=plan_clean)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.email})
    return {
        "ok": True,
        "access_token": token,
        "token_type": "bearer",
        "message": "Registration successful!"
    }


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    email_clean = req.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = create_access_token(data={"sub": user.email})
    return {
        "ok": True,
        "access_token": token,
        "token_type": "bearer",
        "message": "Login successful!"
    }


def get_current_user(
    auth: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    email = verify_access_token(auth.credentials)
    if email is None:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user
