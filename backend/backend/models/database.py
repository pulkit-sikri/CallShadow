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
    voiceprint = relationship("Voiceprint", back_populates="user", uselist=False, cascade="all, delete-orphan")

class SessionToken(Base):
    __tablename__ = "session_tokens"

    token = Column(String(255), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="sessions")

class Voiceprint(Base):
    __tablename__ = "voiceprints"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    embedding = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="voiceprint")

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

            # Clean up / migrate legacy unhashed session tokens (SHA-256 hex is exactly 64 characters)
            cursor.execute("DELETE FROM session_tokens WHERE length(token) != 64;")
            cursor.execute("UPDATE users SET reset_token = NULL WHERE reset_token IS NOT NULL AND length(reset_token) != 64;")
            conn.connection.commit()

            # Safe migration and deduplication for voiceprints table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS voiceprints (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    embedding TEXT NOT NULL,
                    created_at DATETIME,
                    updated_at DATETIME
                );
            """)
            cursor.execute("""
                DELETE FROM voiceprints 
                WHERE id NOT IN (
                    SELECT MAX(id) FROM voiceprints GROUP BY user_id
                );
            """)
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_voiceprints_user_id ON voiceprints(user_id);")
            conn.connection.commit()
    except Exception as exc:
        print(f"[DB Notice] Schema migration check: {exc}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


