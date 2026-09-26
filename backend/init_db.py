from app.db.session import engine, Base
from app.models import user, destination

print("Creating tables...")
Base.metadata.create_all(bind=engine)
print("Tables created!")
