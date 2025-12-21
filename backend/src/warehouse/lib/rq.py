"""RQ (Redis Queue) utilities."""

from redis import Redis
from rq import Queue

from warehouse.config import Config


def get_redis_connection(config: Config) -> Redis:
    """Get Redis connection using the provided configuration."""
    return Redis.from_url(config.redis_url)


def get_queue(config: Config, name: str = "loans") -> Queue:
    """Get RQ Queue instance for the given name."""
    redis_conn = get_redis_connection(config)
    return Queue(name, connection=redis_conn)