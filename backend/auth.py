import os
import jwt
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db

SECRET_KEY = os.getenv("JWT_SECRET", "resqnet_super_secret_jwt_key_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_password_hash(password: str) -> str:
    # Use SHA-256 + salt for clean cross-platform hashing without bcrypt 72-byte limit
    salted = f"{password}{SECRET_KEY}"
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return get_password_hash(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from models import User
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

def require_role(allowed_roles: list[str]):
    def role_checker(current_user = Depends(get_current_user)):
        if current_user.role not in allowed_roles and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action restricted to roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
