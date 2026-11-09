import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database import Base, engine
from .routers import users, products, orders, admin, blog

Base.metadata.create_all(bind=engine)
app = FastAPI()

# Настройки CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ВАЖНО: Создаем папку для картинок и разрешаем к ней доступ
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Костыль для того, чтобы браузер не блокировал загрузку картинок с другого порта
@app.middleware("http")
async def add_corp_header(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/uploads/"):
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    return response

# Подключаем роутеры
app.include_router(users.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(admin.router)
app.include_router(blog.router)