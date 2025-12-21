"""Containers domain repository."""

from warehouse.domain.containers.models import Container
from warehouse.lib.base import BaseRepository


class ContainerRepository(BaseRepository[Container]):
    """Container repository."""

    model_type = Container
