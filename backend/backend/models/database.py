from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from config.settings import settings

engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    salt = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reset_token = Column(String(255), nullable=True, index=True)
    reset_token_expires = Column(DateTime, nullable=True)

    sessions = relationship("SessionToken", back_populates="user", cascade="all, delete-orphan")
    analyses = relationship("AnalysisLog", back_populates="user")

class SessionToken(Base):
    __tablename__ = "session_tokens"

    token = Column(String(255), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="sessions")

class AnalysisLog(Base):
    __tablename__ = "analysis_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    filename = Column(String, index=True)
    source_type = Column(String)  # "upload" or "live_mic"
    duration_seconds = Column(Float)
    classification = Column(String)
    ai_probability = Column(Float)
    human_probability = Column(Float)
    confidence = Column(Float)
    is_demo_mode = Column(Boolean)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="analyses")

def init_db():
    Base.metadata.create_all(bind=engine)
    # Safe, idempotent migration to add user_id column if missing in existing database
    try:
        with engine.connect() as conn:
            cursor = conn.connection.cursor()
            cursor.execute("PRAGMA table_info(analysis_logs);")
            columns = [row[1] for row in cursor.fetchall()]
            if "user_id" not in columns:
                cursor.execute("ALTER TABLE analysis_logs ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;")
                conn.connection.commit()
    except Exception as exc:
        print(f"[DB Notice] Schema migration check: {exc}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


