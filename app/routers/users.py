from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])

@router.post("/register", response_model=schemas.Token)
def register(data: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(400, "Почта занята")
    user = models.User(email=data.email, password=auth.hash_password(data.password))
    db.add(user); db.commit(); db.refresh(user)
    return {"access_token": auth.create_token({"sub": str(user.id)}), "token_type": "bearer", "is_admin": bool(user.is_admin)}

@router.post("/login", response_model=schemas.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not auth.verify_password(form.password, user.password):
        raise HTTPException(401, "Неверный логин или пароль")
    return {"access_token": auth.create_token({"sub": str(user.id)}), "token_type": "bearer", "is_admin": bool(user.is_admin)}