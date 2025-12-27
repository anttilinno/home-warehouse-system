"""File parsers for CSV and Excel import."""

import csv
import io
from typing import Any

import openpyxl


def parse_csv(file_content: bytes) -> list[dict[str, Any]]:
    """Parse CSV file content into list of dictionaries.

    Args:
        file_content: Raw bytes of the CSV file

    Returns:
        List of dictionaries, one per row, with header names as keys
    """
    # Try to decode with different encodings
    content = None
    for encoding in ["utf-8", "utf-8-sig", "latin-1", "cp1252"]:
        try:
            content = file_content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if content is None:
        raise ValueError("Unable to decode CSV file with supported encodings")

    reader = csv.DictReader(io.StringIO(content))
    rows = []

    for row in reader:
        # Clean up keys and values
        cleaned = {}
        for key, value in row.items():
            if key is None:
                continue
            clean_key = key.strip().lower().replace(" ", "_")
            clean_value = value.strip() if value else None
            # Convert empty strings to None
            if clean_value == "":
                clean_value = None
            cleaned[clean_key] = clean_value
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

    # First row is headers
    headers = [
        str(h).strip().lower().replace(" ", "_") if h else f"column_{i}"
        for i, h in enumerate(rows[0])
    ]

    result = []
    for row in rows[1:]:
        if all(cell is None for cell in row):
            continue  # Skip empty rows

        row_dict = {}
        for i, value in enumerate(row):
            if i < len(headers):
                key = headers[i]
                # Convert to string if needed, None stays None
                if value is not None:
                    clean_value = str(value).strip()
                    if clean_value == "":
                        clean_value = None
                else:
                    clean_value = None
                row_dict[key] = clean_value
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
