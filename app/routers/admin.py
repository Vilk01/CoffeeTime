import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile
from sqlalchemy.orm import Session
from typing import Optional, List
from .. import models, schemas, auth
from ..database import get_db
from sqlalchemy import func
from datetime import datetime, timedelta
from fastapi import Query


router = APIRouter(prefix="/api/admin", tags=["admin"])


# ================= ТОВАРЫ =================
@router.post("/products")
def add_product(
        name: str = Form(...),
        price: float = Form(...),
        description: Optional[str] = Form(None),
        file: Optional[UploadFile] = File(None),
        db: Session = Depends(get_db),
        admin: models.User = Depends(auth.get_current_admin)
):
    image_url = None
    if file:
        os.makedirs("uploads", exist_ok=True)
        file_location = f"uploads/{file.filename}"
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        image_url = f"/uploads/{file.filename}"

    p = models.Product(name=name, price=price, description=description, image_url=image_url)
    db.add(p)
    db.commit()
    return {"status": "ok"}


@router.put("/products/{id}")
def update_product(
        id: int,
        name: str = Form(...),
        price: float = Form(...),
        description: Optional[str] = Form(None),
        file: Optional[UploadFile] = File(None),
        db: Session = Depends(get_db),
        admin: models.User = Depends(auth.get_current_admin)
):
    p = db.query(models.Product).filter(models.Product.id == id).first()
    if not p:
        raise HTTPException(404, "Товар не найден")

    p.name = name
    p.price = price
    p.description = description

    # Если загрузили новую картинку — меняем, если нет — оставляем старую
    if file:
        os.makedirs("uploads", exist_ok=True)
        file_location = f"uploads/{file.filename}"
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        p.image_url = f"/uploads/{file.filename}"

    db.commit()
    return {"status": "ok"}


@router.delete("/products/{id}")
def delete_product(id: int, db: Session = Depends(get_db), admin: models.User = Depends(auth.get_current_admin)):
    db.query(models.Product).filter(models.Product.id == id).delete()
    db.commit()
    return {"status": "ok"}


# ================= БЛОГИ =================
@router.post("/blog")
def add_blog_post(data: schemas.BlogPostCreate, db: Session = Depends(get_db),
                  admin: models.User = Depends(auth.get_current_admin)):
    post = models.BlogPost(**data.dict())
    db.add(post)
    db.commit()
    return {"status": "ok"}


@router.put("/blog/{id}")
def update_blog_post(id: int, data: schemas.BlogPostCreate, db: Session = Depends(get_db),
                     admin: models.User = Depends(auth.get_current_admin)):
    post = db.query(models.BlogPost).filter(models.BlogPost.id == id).first()
    if not post:
        raise HTTPException(404, "Статья не найдена")

    post.title = data.title
    post.content = data.content
    db.commit()
    return {"status": "ok"}


@router.delete("/blog/{id}")
def delete_blog_post(id: int, db: Session = Depends(get_db), admin: models.User = Depends(auth.get_current_admin)):
    db.query(models.BlogPost).filter(models.BlogPost.id == id).delete()
    db.commit()
    return {"status": "ok"}


# ================= СТАТИСТИКА =================
@router.get("/stats")
def get_stats(
    start_date: str = Query(None), 
    end_date: str = Query(None),
    db: Session = Depends(get_db), 
    admin: models.User = Depends(auth.get_current_admin)
):
    # Общие показатели за все время
    total_orders = db.query(models.Order).count()
    revenue_query = db.query(func.sum(models.Order.total)).scalar()
    revenue = revenue_query if revenue_query else 0.0

    # Обработка дат для графика
    if start_date and end_date:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    else:
        # Если даты не выбраны, показываем последние 7 дней
        end = datetime.utcnow().date()
        start = end - timedelta(days=6)

    # Защита от слишком больших диапазонов (чтобы график не сломался)
    delta = (end - start).days
    if delta > 30:
        delta = 30 # Максимум 30 дней
        start = end - timedelta(days=30)

    labels = []
    chart_data = []

    # Проходимся по каждому дню в диапазоне
    for i in range(delta + 1):
        target_date = start + timedelta(days=i)
        labels.append(target_date.strftime("%d.%m")) # Формат: 01.11
        
        day_orders = db.query(func.sum(models.Order.total)).filter(
            func.date(models.Order.created_at) == target_date
        ).scalar()
        
        chart_data.append(day_orders if day_orders else 0)

    return {
        "total_orders": total_orders, 
        "revenue": revenue, 
        "chart_data": chart_data,
        "labels": labels,
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d")
    }

@router.get("/orders")
def get_all_orders(db: Session = Depends(get_db), admin: models.User = Depends(auth.get_current_admin)):
    orders = db.query(models.Order).order_by(models.Order.created_at.desc()).all()
    
    result = []
    for o in orders:
        items_list = []
        for item in o.items:
            items_list.append({
                "quantity": item.quantity,
                "price": item.price,
                "product_name": item.product.name if item.product else "Удален"
            })
            
        result.append({
            "id": o.id,
            "total": o.total,
            "created_at": o.created_at,
            "items": items_list
        })
    return result