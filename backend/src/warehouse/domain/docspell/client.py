"""Docspell API client."""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx

from warehouse.domain.docspell.schemas import DocspellDocument, DocspellSearchResult, DocspellTag

logger = logging.getLogger(__name__)


@dataclass
class DocspellAuthToken:
    """Cached Docspell authentication token."""

    token: str
    expires_at: datetime


class DocspellClient:
    """HTTP client for Docspell REST API."""

    def __init__(self, base_url: str, collective: str, username: str, password: str):
        """Initialize Docspell client.

        Args:
            base_url: Docspell server URL (e.g., http://localhost:7880)
            collective: Docspell collective (organization) name
            username: Docspell username
            password: Docspell password
        """
        self.base_url = base_url.rstrip("/")
        self.collective = collective
        self.username = username
        self.password = password
        self._token: DocspellAuthToken | None = None

    async def _get_token(self) -> str:
        """Get or refresh authentication token.

        Returns:
            Valid authentication token

        Raises:
            Exception: If authentication fails
        """
        now = datetime.now(UTC)

        # Check if token still valid (with 30s margin)
        if self._token and self._token.expires_at > now + timedelta(seconds=30):
            return self._token.token

        # Authenticate
        url = f"{self.base_url}/api/v1/open/auth/login"
        payload = {
            "collective": self.collective,
            "account": self.username,
            "password": self.password,
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, timeout=10.0)
                if response.status_code != 200:
                    logger.error(f"Docspell auth failed: {response.status_code}")
                    raise Exception("Docspell authentication failed")

                data = response.json()
                self._token = DocspellAuthToken(
                    token=data["token"],
                    # Token expires in 5 minutes, refresh early
                    expires_at=now + timedelta(minutes=4, seconds=30),
                )
                return self._token.token

        except httpx.TimeoutException:
            logger.error("Docspell auth timeout")
            raise Exception("Docspell authentication timeout")

    async def _request(
        self, method: str, endpoint: str, **kwargs
    ) -> dict:
        """Make authenticated request to Docspell.

        Args:
            method: HTTP method (get, post, etc.)
            endpoint: API endpoint (without /api/v1/sec prefix)
            **kwargs: Additional arguments for httpx request

        Returns:
            JSON response as dict
        """
        token = await self._get_token()
        url = f"{self.base_url}/api/v1/sec{endpoint}"
        headers = {"X-Docspell-Auth": token}

        async with httpx.AsyncClient() as client:
            response = await getattr(client, method)(
                url, headers=headers, timeout=30.0, **kwargs
            )
            response.raise_for_status()
            return response.json()

    async def test_connection(self) -> tuple[bool, str, str | None]:
        """Test connection to Docspell.

        Returns:
            Tuple of (success, message, version)
        """
        try:
            await self._get_token()
            # Get version info
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.base_url}/api/info/version", timeout=10.0
                )
                version = resp.json().get("version") if resp.status_code == 200 else None
            return True, "Connection successful", version
        except Exception as e:
            return False, str(e), None

    async def search(
        self, query: str, limit: int = 20, offset: int = 0
    ) -> DocspellSearchResult:
        """Search for documents in Docspell.

        Args:
            query: Search query string
            limit: Maximum number of results
            offset: Offset for pagination

        Returns:
            Search results with documents
        """
        # Docspell search API uses POST with JSON body
        # Convert plain search terms to Docspell query syntax
        # Empty query returns all documents
        docspell_query = ""
        if query.strip():
            # If query doesn't contain a field prefix (like name: or content:),
            # use fulltext search which searches document content and metadata
            # Note: content search cannot be inside OR expressions
            if ":" not in query and "=" not in query:
                term = query.strip()
                docspell_query = f"content:{term}"
            else:
                docspell_query = query

        payload = {
            "offset": offset,
            "limit": limit,
            "query": docspell_query,
        }
        data = await self._request("post", "/item/search", json=payload)

        items = []
        for group in data.get("groups", []):
            for item in group.get("items", []):
                items.append(
                    DocspellDocument(
                        id=item["id"],
                        name=item.get("name", "Untitled"),
                        date=item.get("itemDate"),
                        correspondent=item.get("corrOrg", {}).get("name")
                        if item.get("corrOrg")
                        else None,
                        tags=[t["name"] for t in item.get("tags", [])],
                        preview_url=f"{self.base_url}/api/v1/sec/attachment/{item['id']}/preview"
                        if item.get("id")
                        else None,
                        detail_url=f"{self.base_url}/#/item/{item['id']}",
                    )
                )

        return DocspellSearchResult(items=items, total=data.get("count", len(items)))

    async def get_tags(self) -> list[DocspellTag]:
        """Get all tags from Docspell.

        Returns:
            List of tags
        """
        data = await self._request("get", "/tag")
        return [
            DocspellTag(
                id=tag["id"],
                name=tag["name"],
                category=tag.get("category"),
            )
            for tag in data.get("items", [])
        ]

    async def create_tag(self, name: str, category: str | None = None) -> DocspellTag:
        """Create a tag in Docspell.

        Args:
            name: Tag name
            category: Optional tag category

        Returns:
            Created tag
        """
        payload = {"name": name}
        if category:
            payload["category"] = category
        data = await self._request("post", "/tag", json=payload)
        return DocspellTag(id=data["id"], name=name, category=category)

    async def get_item(self, item_id: str) -> DocspellDocument | None:
        """Get a specific document by ID.

        Args:
            item_id: Docspell item ID

        Returns:
            Document if found, None otherwise
        """
        try:
            data = await self._request("get", f"/item/{item_id}")
            return DocspellDocument(
                id=data["id"],
                name=data.get("name", "Untitled"),
                date=data.get("itemDate"),
                correspondent=data.get("corrOrg", {}).get("name")
                if data.get("corrOrg")
                else None,
                tags=[t["name"] for t in data.get("tags", [])],
                detail_url=f"{self.base_url}/#/item/{item_id}",
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise
