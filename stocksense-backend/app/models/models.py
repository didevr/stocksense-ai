from sqlalchemy import Column, Integer, String, Float, ForeignKey, UniqueConstraint
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    plan = Column(String, default="Free")


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, index=True, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "symbol", name="uq_user_watchlist_symbol"),)


class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, index=True, nullable=False)
    shares = Column(Float, default=0.0)
    avg_price = Column(Float, default=0.0)

    __table_args__ = (UniqueConstraint("user_id", "symbol", name="uq_user_portfolio_symbol"),)
