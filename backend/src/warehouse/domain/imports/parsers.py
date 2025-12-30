"""File parsers for CSV and Excel import."""

import csv
import io
from typing import Any

import openpyxl

# Supported encodings for CSV files
_CSV_ENCODINGS = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]


def _detect_encoding(content: bytes) -> str:
    """Detect encoding for file content.

    Args:
        content: Raw bytes to decode

    Returns:
        Detected encoding name

    Raises:
        ValueError: If no supported encoding works
    """
    for encoding in _CSV_ENCODINGS:
        try:
            content.decode(encoding)
            return encoding
        except UnicodeDecodeError:
            continue
    raise ValueError("Unable to decode file with supported encodings")


def _normalize_header(header: Any, index: int) -> str:
    """Normalize a column header.

    Args:
        header: Header value (may be None or any type)
        index: Column index for fallback naming

    Returns:
        Normalized header string (lowercase, underscores for spaces)
    """
    if header is None or str(header).strip() == "":
        return f"column_{index}"
    return str(header).strip().lower().replace(" ", "_")


def _normalize_value(value: Any) -> str | None:
    """Normalize a cell value.

    Args:
        value: Cell value (may be None or any type)

    Returns:
        Normalized string or None for empty values
    """
    if value is None:
        return None
    clean = str(value).strip()
    return clean if clean else None


def parse_csv(file_content: bytes) -> list[dict[str, Any]]:
    """Parse CSV file content into list of dictionaries.

    Args:
        file_content: Raw bytes of the CSV file

    Returns:
        List of dictionaries, one per row, with header names as keys
    """
    encoding = _detect_encoding(file_content)
    content = file_content.decode(encoding)
    reader = csv.DictReader(io.StringIO(content))

    rows = []
    for row in reader:
        cleaned = {
            _normalize_header(key, i): _normalize_value(value)
            for i, (key, value) in enumerate(row.items())
            if key is not None
        }
        rows.append(cleaned)

    return rows


def parse_excel(file_content: bytes) -> list[dict[str, Any]]:
    """Parse Excel file content into list of dictionaries.

    Args:
        file_content: Raw bytes of the Excel file (.xlsx)

    Returns:
        List of dictionaries, one per row, with header names as keys
    """
    workbook = openpyxl.load_workbook(io.BytesIO(file_content), read_only=True)
    sheet = workbook.active

    if sheet is None:
        return []

    rows = list(sheet.iter_rows(values_only=True))
    if len(rows) < 2:
        return []

    headers = [_normalize_header(h, i) for i, h in enumerate(rows[0])]

    result = []
    for row in rows[1:]:
        if all(cell is None for cell in row):
            continue

        row_dict = {
            headers[i]: _normalize_value(value)
            for i, value in enumerate(row)
            if i < len(headers)
        }
        result.append(row_dict)

    return result


def detect_file_type(filename: str) -> str:
    """Detect file type from filename.

    Args:
        filename: Name of the file

    Returns:
        "csv" or "excel"

    Raises:
        ValueError: If file type is not supported
    """
    lower_name = filename.lower()
    if lower_name.endswith(".csv"):
        return "csv"
    elif lower_name.endswith((".xlsx", ".xls")):
        return "excel"
    else:
        raise ValueError(f"Unsupported file type: {filename}")


def parse_file(file_content: bytes, filename: str) -> list[dict[str, Any]]:
    """Parse file based on its extension.

    Args:
        file_content: Raw bytes of the file
        filename: Name of the file

    Returns:
        List of dictionaries, one per row
    """
    file_type = detect_file_type(filename)
    if file_type == "csv":
        return parse_csv(file_content)
    else:
        return parse_excel(file_content)
