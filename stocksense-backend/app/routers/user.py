from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.models import User, WatchlistItem, PortfolioHolding
from app.routers.auth import get_current_user

router = APIRouter(prefix="/user", tags=["user"])


class WatchlistAddRequest(BaseModel):
    symbol: str


class PortfolioUpdateRequest(BaseModel):
    symbol: str
    shares: float
    avg_price: float


@router.get("/profile")
def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user profile, including watchlist and portfolio holding symbols.
    """
    watchlist_items = db.query(WatchlistItem).filter(WatchlistItem.user_id == current_user.id).all()
    portfolio_items = db.query(PortfolioHolding).filter(PortfolioHolding.user_id == current_user.id).all()

    return {
        "ok": True,
        "user": {
            "name": current_user.name,
            "email": current_user.email,
            "plan": current_user.plan,
            "watchlists": [item.symbol for item in watchlist_items],
            "portfolio": [item.symbol for item in portfolio_items],
            "portfolio_holdings": [
                {"symbol": item.symbol, "shares": item.shares, "avg_price": item.avg_price}
                for item in portfolio_items
            ]
        }
    }


@router.post("/watchlist")
def add_to_watchlist(
    req: WatchlistAddRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a symbol to the user's watchlist.
    """
    symbol_upper = req.symbol.strip().upper()
    if not symbol_upper:
        raise HTTPException(status_code=400, detail="Symbol cannot be empty.")

    # Check if already exists
    exists = db.query(WatchlistItem).filter(
        WatchlistItem.user_id == current_user.id,
        WatchlistItem.symbol == symbol_upper
    ).first()

    if exists:
        return {"ok": True, "message": f"Symbol '{symbol_upper}' is already on the watchlist."}

    item = WatchlistItem(user_id=current_user.id, symbol=symbol_upper)
    db.add(item)
    db.commit()

    return {"ok": True, "message": f"Added '{symbol_upper}' to watchlist."}


@router.delete("/watchlist/{symbol}")
def remove_from_watchlist(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove a symbol from the user's watchlist.
    """
    symbol_upper = symbol.strip().upper()

    item = db.query(WatchlistItem).filter(
        WatchlistItem.user_id == current_user.id,
        WatchlistItem.symbol == symbol_upper
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"Symbol '{symbol_upper}' not found in watchlist."
        )

    db.delete(item)
    db.commit()

    return {"ok": True, "message": f"Removed '{symbol_upper}' from watchlist."}


@router.post("/portfolio")
def update_portfolio(
    req: PortfolioUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add or update a portfolio holding.
    Setting shares to 0 will delete the holding.
    """
    symbol_upper = req.symbol.strip().upper()
    if not symbol_upper:
        raise HTTPException(status_code=400, detail="Symbol cannot be empty.")

    holding = db.query(PortfolioHolding).filter(
        PortfolioHolding.user_id == current_user.id,
        PortfolioHolding.symbol == symbol_upper
    ).first()

    if req.shares <= 0:
        if holding:
            db.delete(holding)
            db.commit()
            return {"ok": True, "message": f"Deleted holding for '{symbol_upper}'."}
        return {"ok": True, "message": f"No active holding to delete for '{symbol_upper}'."}

    if holding:
        holding.shares = req.shares
        holding.avg_price = req.avg_price
    else:
        holding = PortfolioHolding(
            user_id=current_user.id,
            symbol=symbol_upper,
            shares=req.shares,
            avg_price=req.avg_price
        )
        db.add(holding)

    db.commit()
    return {"ok": True, "message": f"Updated holding for '{symbol_upper}'."}


class PlanUpgradeRequest(BaseModel):
    plan: str = "Pro"


@router.post("/upgrade")
def upgrade_user_plan(
    req: PlanUpgradeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upgrade current user's plan to Pro or Analyst.
    """
    plan_clean = req.plan.strip().capitalize()
    if plan_clean not in ["Free", "Pro", "Analyst"]:
        raise HTTPException(status_code=400, detail="Invalid plan selected.")
    current_user.plan = plan_clean
    db.commit()
    db.refresh(current_user)
    return {
        "ok": True,
        "message": f"Successfully upgraded to {plan_clean} Plan!",
        "plan": current_user.plan
    }

