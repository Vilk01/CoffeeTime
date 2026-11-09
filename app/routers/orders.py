from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, auth
from ..database import get_db
from collections import Counter

router = APIRouter(prefix="/api/orders", tags=["orders"])



@router.post("/")
def create_order(data: schemas.OrderCreate, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    counts = Counter(data.product_ids)
    products = db.query(models.Product).filter(models.Product.id.in_(counts.keys())).all()
    
    total = 0.0
    order = models.Order(user_id=user.id, total=0)
    db.add(order)
    db.flush() # Получаем ID заказа
    
    for p in products:
        qty = counts[p.id]
        total += p.price * qty
        order_item = models.OrderItem(
            order_id=order.id, 
            product_id=p.id, 
            quantity=qty, 
            price=p.price
        )
        db.add(order_item)
        
    order.total = total
    db.commit()
    return {"order_id": order.id, "total": total}


@router.get("/my")
def my_orders(db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    orders = db.query(models.Order).filter(models.Order.user_id == user.id).order_by(models.Order.created_at.desc()).all()
    
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