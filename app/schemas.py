from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    is_admin: int
    class Config: from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    is_admin: bool

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None

class ProductOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    price: float
    image_url: Optional[str]
    class Config: from_attributes = True

class OrderCreate(BaseModel):
    product_ids: List[int]

class OrderItemOut(BaseModel):
    product_name: str = ""
    quantity: int
    price: float
    class Config: from_attributes = True

class OrderOut(BaseModel):
    id: int
    total: float
    created_at: datetime
    items: List[OrderItemOut] = [] 
    class Config: from_attributes = True


# Схемы для Блога
class BlogPostCreate(BaseModel):
    title: str
    content: str

class BlogPostOut(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime
    class Config: from_attributes = True


