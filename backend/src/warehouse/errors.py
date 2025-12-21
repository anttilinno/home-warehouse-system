"""Centralized error catalog."""

from __future__ import annotations

from enum import Enum
from typing import Any

from litestar.exceptions import HTTPException


class ErrorCode(Enum):
    """Application error codes."""

    AUTH_USERNAME_EXISTS = ("AUTH_USERNAME_EXISTS", "Username already exists")
    AUTH_EMAIL_EXISTS = ("AUTH_EMAIL_EXISTS", "Email already exists")
    AUTH_INVALID_CREDENTIALS = ("AUTH_INVALID_CREDENTIALS", "Invalid credentials")
    AUTH_INACTIVE_USER = ("AUTH_INACTIVE_USER", "User is inactive")
    AUTH_INVALID_TOKEN = ("AUTH_INVALID_TOKEN", "Invalid or expired token")

    CATEGORY_NOT_FOUND = ("CATEGORY_NOT_FOUND", "Category not found")

    ITEM_NOT_FOUND = ("ITEM_NOT_FOUND", "Item not found")
    ITEM_DUPLICATE_SKU = ("ITEM_DUPLICATE_SKU", "SKU already exists")

    INVENTORY_NOT_FOUND = ("INVENTORY_NOT_FOUND", "Inventory not found")
    INVENTORY_DUPLICATE = ("INVENTORY_DUPLICATE", "Inventory record already exists for this item and location")
    INVENTORY_STOCK_NEGATIVE = ("INVENTORY_STOCK_NEGATIVE", "Stock cannot be negative")

    LOCATION_NOT_FOUND = ("LOCATION_NOT_FOUND", "Location not found")

    CONTAINER_NOT_FOUND = ("CONTAINER_NOT_FOUND", "Container not found")

    BORROWER_NOT_FOUND = ("BORROWER_NOT_FOUND", "Borrower not found")
    BORROWER_HAS_LOANS = ("BORROWER_HAS_LOANS", "Borrower has existing loans")

    LOAN_NOT_FOUND = ("LOAN_NOT_FOUND", "Loan not found")
    LOAN_ALREADY_RETURNED = ("LOAN_ALREADY_RETURNED", "Loan already returned")

    WORKSPACE_REQUIRED = ("WORKSPACE_REQUIRED", "Workspace ID is required")
    WORKSPACE_INVALID = ("WORKSPACE_INVALID", "Invalid workspace ID")
    WORKSPACE_NOT_FOUND = ("WORKSPACE_NOT_FOUND", "Workspace not found")
    WORKSPACE_ACCESS_DENIED = ("WORKSPACE_ACCESS_DENIED", "Access to workspace denied")
    WORKSPACE_PERMISSION_DENIED = ("WORKSPACE_PERMISSION_DENIED", "Permission denied for this workspace")
    WORKSPACE_MEMBER_EXISTS = ("WORKSPACE_MEMBER_EXISTS", "User is already a member of this workspace")

    USER_NOT_FOUND = ("USER_NOT_FOUND", "User not found")

    GENERAL_BAD_REQUEST = ("BAD_REQUEST", "Request is invalid")

    @property
    def code(self) -> str:
        return self.value[0]

    @property
    def default_message(self) -> str:
        return self.value[1]


class AppError(Exception):
    """Domain error carrying a catalog code and HTTP status."""

    def __init__(self, code: ErrorCode, status_code: int = 400, message: str | None = None):
        self.code = code
        self.status_code = status_code
        self.message = message or code.default_message
        super().__init__(self.message)

    def to_http_exception(self) -> HTTPException:
        return HTTPException(
            status_code=self.status_code,
            detail=self.message,
        )

    def to_dict(self) -> dict[str, Any]:
        return {"code": self.code.code, "message": self.message, "status_code": self.status_code}
