from app.database import SessionLocal, engine, Base
from app import models
from app.auth import hash_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()
if not db.query(models.User).filter(models.User.email == "admin@coffee.ru").first():
    db.add(models.User(email="admin@coffee.ru", password=hash_password("admin123"), is_admin=1))
    db.commit()
    print("✅ Админ создан: admin@coffee.ru / admin123")
else:
    print("⚠️ Админ уже существует.")
db.close()