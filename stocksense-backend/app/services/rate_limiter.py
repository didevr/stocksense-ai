import datetime
from typing import Dict
from app.config import get_settings
from app.services.stock_service import get_redis

settings = get_settings()

# In-memory dictionary fallback to track daily query limits when Redis is down/unavailable
# Format: { "chat_limit:<user_id>:<date_str>": count }
_memory_limits: Dict[str, int] = {}


async def is_rate_limited(user_id: str, plan: str) -> bool:
    """
    Check if the user has reached their daily query limit based on their plan.
    Free plan: 10 queries/day
    Pro plan: 100 queries/day
    Analyst plan: Unlimited queries
    
    Uses Redis when available, falling back gracefully to in-memory dictionary tracking.
    """
    plan_lower = plan.lower().strip()
    if plan_lower == "analyst":
        return False

    # Determine query limit (fallback to Free limit if invalid plan)
    limit = settings.free_daily_limit if plan_lower == "free" else settings.pro_daily_limit
    
    today_str = datetime.date.today().isoformat()
    key = f"chat_limit:{user_id}:{today_str}"

    # Try Redis first
    redis_client = await get_redis()
    if redis_client is not None:
        try:
            count_str = await redis_client.get(key)
            if count_str is not None:
                count = int(count_str)
                if count >= limit:
                    return True
            
            # Increment the counter
            await redis_client.incr(key)
            if count_str is None:
                # Set 24 hour expiry on new key creation
                await redis_client.expire(key, 86400)
            return False
        except Exception:
            # Fallback to memory tracking if Redis fails mid-operation
            pass

    # Memory fallback
    count = _memory_limits.get(key, 0)
    if count >= limit:
        return True
        
    _memory_limits[key] = count + 1
    return False
