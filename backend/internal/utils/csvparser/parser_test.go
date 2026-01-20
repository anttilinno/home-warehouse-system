package csvparser

import (
	"errors"
	"maps"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testdataPath(filename string) string {
	return filepath.Join("testdata", filename)
}

// =============================================================================
// Constructor Tests
// =============================================================================

func TestNewCSVParser(t *testing.T) {
	parser := NewCSVParser("test.csv")

	assert.NotNil(t, parser)
	assert.Equal(t, "test.csv", parser.filePath)
	assert.Nil(t, parser.headers)
}

// =============================================================================
// Basic Parsing Tests
// =============================================================================

func TestParse_ValidCSV(t *testing.T) {
	parser := NewCSVParser(testdataPath("valid.csv"))
	rows, err := parser.Parse()

	require.NoError(t, err)
	require.Len(t, rows, 3)

	// Check first row
	assert.Equal(t, "John Doe", rows[0]["name"])
	assert.Equal(t, "john@example.com", rows[0]["email"])
	assert.Equal(t, "30", rows[0]["age"])
	assert.Equal(t, "true", rows[0]["active"])

	// Check second row
	assert.Equal(t, "Jane Smith", rows[1]["name"])
	assert.Equal(t, "jane@example.com", rows[1]["email"])
	assert.Equal(t, "25", rows[1]["age"])
	assert.Equal(t, "false", rows[1]["active"])

	// Check third row
	assert.Equal(t, "Bob Wilson", rows[2]["name"])
	assert.Equal(t, "bob@example.com", rows[2]["email"])
	assert.Equal(t, "45", rows[2]["age"])
	assert.Equal(t, "true", rows[2]["active"])
}

func TestParse_QuotedFields(t *testing.T) {
	parser := NewCSVParser(testdataPath("quoted.csv"))
	rows, err := parser.Parse()

	require.NoError(t, err)
	require.Len(t, rows, 3)

	// Simple quoted field
	assert.Equal(t, "Simple Product", rows[0]["name"])
	assert.Equal(t, "A simple description", rows[0]["description"])
	assert.Equal(t, "10.99", rows[0]["price"])

	// Escaped quotes within quoted field
	assert.Equal(t, `Product with "quotes"`, rows[1]["name"])
	assert.Equal(t, `Description with "quoted" text`, rows[1]["description"])

	// Newlines within quoted field
	assert.Equal(t, "Multiline\nProduct", rows[2]["name"])
	assert.Equal(t, "Description with\nmultiple lines", rows[2]["description"])
}

func TestParse_TypesCSV(t *testing.T) {
	parser := NewCSVParser(testdataPath("types.csv"))
	rows, err := parser.Parse()

	require.NoError(t, err)
	require.Len(t, rows, 3)

	// All values are returned as strings - caller handles conversion
	assert.Equal(t, "550e8400-e29b-41d4-a716-446655440000", rows[0]["id"])
	assert.Equal(t, "Widget", rows[0]["name"])
	assert.Equal(t, "100", rows[0]["quantity"])
	assert.Equal(t, "19.99", rows[0]["price"])
	assert.Equal(t, "true", rows[0]["active"])
	assert.Equal(t, "2024-01-15", rows[0]["created_at"])
}

// =============================================================================
// Header Handling Tests
// =============================================================================

func TestParse_HeadersNormalized(t *testing.T) {
	parser := NewCSVParser(testdataPath("mixed_case_headers.csv"))
	rows, err := parser.Parse()

	require.NoError(t, err)
	require.Len(t, rows, 2)

	// Headers are normalized to lowercase
	assert.Equal(t, "John", rows[0]["name"])
	assert.Equal(t, "john@test.com", rows[0]["email"])
	assert.Equal(t, "30", rows[0]["age"])
	assert.Equal(t, "true", rows[0]["isactive"])
}

func TestHeaders_ReturnsNormalizedHeaders(t *testing.T) {
	parser := NewCSVParser(testdataPath("mixed_case_headers.csv"))
	_, err := parser.Parse()

	require.NoError(t, err)

	headers := parser.Headers()
	assert.Equal(t, []string{"name", "email", "age", "isactive"}, headers)
}

func TestHeaders_BeforeParse(t *testing.T) {
	parser := NewCSVParser(testdataPath("valid.csv"))

	// Headers are nil before Parse is called
	assert.Nil(t, parser.Headers())
}

func TestParse_HeadersOnlyFile(t *testing.T) {
	parser := NewCSVParser(testdataPath("headers_only.csv"))
	rows, err := parser.Parse()

	require.NoError(t, err)
	assert.Empty(t, rows)
	assert.Equal(t, []string{"name", "email", "age"}, parser.Headers())
}

// =============================================================================
// Whitespace Handling Tests
// =============================================================================

func TestParse_WhitespaceTrimmed(t *testing.T) {
	parser := NewCSVParser(testdataPath("whitespace.csv"))
	rows, err := parser.Parse()

	require.NoError(t, err)
	require.Len(t, rows, 2)

	// Headers are trimmed
	headers := parser.Headers()
	assert.Equal(t, []string{"name", "email", "age"}, headers)

	// Values are trimmed
	assert.Equal(t, "John", rows[0]["name"])
	assert.Equal(t, "john@test.com", rows[0]["email"])
	assert.Equal(t, "30", rows[0]["age"])
}

// =============================================================================
// Unicode Tests
// =============================================================================

func TestParse_UnicodeCharacters(t *testing.T) {
	parser := NewCSVParser(testdataPath("unicode.csv"))
	rows, err := parser.Parse()

	require.NoError(t, err)
	require.Len(t, rows, 3)

	// German with umlauts
	assert.Equal(t, "Müller", rows[0]["name"])
	assert.Equal(t, "München", rows[0]["city"])
	assert.Equal(t, "Größe: 42", rows[0]["notes"])

	// Japanese characters
	assert.Equal(t, "田中太郎", rows[1]["name"])
	assert.Equal(t, "東京", rows[1]["city"])
	assert.Equal(t, "日本語テスト", rows[1]["notes"])

	// Portuguese/Spanish with accents
	assert.Equal(t, "José García", rows[2]["name"])
	assert.Equal(t, "São Paulo", rows[2]["city"])
	assert.Equal(t, "Olá mundo", rows[2]["notes"])
}

// =============================================================================
// Error Handling Tests
// =============================================================================

func TestParse_FileNotFound(t *testing.T) {
	parser := NewCSVParser("nonexistent.csv")
	rows, err := parser.Parse()

	assert.Nil(t, rows)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to open file")
}

func TestParse_EmptyFile(t *testing.T) {
	// Create empty temp file
	tmpFile, err := os.CreateTemp("", "empty*.csv")
	require.NoError(t, err)
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	parser := NewCSVParser(tmpFile.Name())
	rows, err := parser.Parse()

	assert.Nil(t, rows)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to read headers")
}

func TestParse_MalformedCSV(t *testing.T) {
	parser := NewCSVParser(testdataPath("malformed.csv"))
	rows, err := parser.Parse()

	assert.Nil(t, rows)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "error reading row")
}

// =============================================================================
// Extra Columns Handling Tests
// =============================================================================

func TestParse_ExtraColumnsIgnored(t *testing.T) {
	// Create temp file with more columns in a row than headers
	tmpFile, err := os.CreateTemp("", "extra_cols*.csv")
	require.NoError(t, err)
	defer os.Remove(tmpFile.Name())

	content := "name,email\nJohn,john@test.com,extra_value\n"
	_, err = tmpFile.WriteString(content)
	require.NoError(t, err)
	tmpFile.Close()

	parser := NewCSVParser(tmpFile.Name())

	// The Go CSV reader by default requires all rows to have the same number of fields
	// This will error with "wrong number of fields"
	rows, err := parser.Parse()

	// Standard Go CSV reader returns error for inconsistent field counts
	assert.Error(t, err)
	assert.Nil(t, rows)
}

func TestParse_FewerColumnsInRow(t *testing.T) {
	// Create temp file with fewer columns in a row than headers
	tmpFile, err := os.CreateTemp("", "fewer_cols*.csv")
	require.NoError(t, err)
	defer os.Remove(tmpFile.Name())

	content := "name,email,age\nJohn,john@test.com\n"
	_, err = tmpFile.WriteString(content)
	require.NoError(t, err)
	tmpFile.Close()

	parser := NewCSVParser(tmpFile.Name())
	rows, err := parser.Parse()

	// Standard Go CSV reader returns error for inconsistent field counts
	assert.Error(t, err)
	assert.Nil(t, rows)
}

// =============================================================================
// ParseStream Tests
// =============================================================================

func TestParseStream_ValidCSV(t *testing.T) {
	parser := NewCSVParser(testdataPath("valid.csv"))

	var collectedRows []map[string]string
	var rowNumbers []int

	err := parser.ParseStream(func(rowNum int, row map[string]string) error {
		rowNumbers = append(rowNumbers, rowNum)
		// Make a copy of the row
		rowCopy := make(map[string]string, len(row))
		maps.Copy(rowCopy, row)
		collectedRows = append(collectedRows, rowCopy)
		return nil
	})

	require.NoError(t, err)
	assert.Len(t, collectedRows, 3)
	assert.Equal(t, []int{1, 2, 3}, rowNumbers)

	// Verify data
	assert.Equal(t, "John Doe", collectedRows[0]["name"])
	assert.Equal(t, "Jane Smith", collectedRows[1]["name"])
	assert.Equal(t, "Bob Wilson", collectedRows[2]["name"])
}

func TestParseStream_CallbackError(t *testing.T) {
	parser := NewCSVParser(testdataPath("valid.csv"))

	callbackErr := errors.New("callback error")
	callCount := 0

	err := parser.ParseStream(func(rowNum int, row map[string]string) error {
		callCount++
		if rowNum == 2 {
			return callbackErr
		}
		return nil
	})

	assert.ErrorIs(t, err, callbackErr)
	assert.Equal(t, 2, callCount) // Stopped at row 2
}

func TestParseStream_FileNotFound(t *testing.T) {
	parser := NewCSVParser("nonexistent.csv")

	err := parser.ParseStream(func(rowNum int, row map[string]string) error {
		return nil
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to open file")
}

func TestParseStream_EmptyFile(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "empty_stream*.csv")
	require.NoError(t, err)
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	parser := NewCSVParser(tmpFile.Name())
	err = parser.ParseStream(func(rowNum int, row map[string]string) error {
		return nil
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to read headers")
}

func TestParseStream_HeadersOnlyFile(t *testing.T) {
	parser := NewCSVParser(testdataPath("headers_only.csv"))

	callCount := 0
	err := parser.ParseStream(func(rowNum int, row map[string]string) error {
		callCount++
		return nil
	})

	require.NoError(t, err)
	assert.Equal(t, 0, callCount) // No data rows
	assert.Equal(t, []string{"name", "email", "age"}, parser.Headers())
}

func TestParseStream_SetsHeaders(t *testing.T) {
	parser := NewCSVParser(testdataPath("mixed_case_headers.csv"))

	err := parser.ParseStream(func(rowNum int, row map[string]string) error {
		return nil
	})

	require.NoError(t, err)
	assert.Equal(t, []string{"name", "email", "age", "isactive"}, parser.Headers())
}

func TestParseStream_MalformedCSV(t *testing.T) {
	parser := NewCSVParser(testdataPath("malformed.csv"))

	err := parser.ParseStream(func(rowNum int, row map[string]string) error {
		return nil
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "error reading row")
}

// =============================================================================
// CountRows Tests
// =============================================================================

func TestCountRows_ValidCSV(t *testing.T) {
	parser := NewCSVParser(testdataPath("valid.csv"))
	count, err := parser.CountRows()

	require.NoError(t, err)
	assert.Equal(t, 3, count)
}

func TestCountRows_HeadersOnlyFile(t *testing.T) {
	parser := NewCSVParser(testdataPath("headers_only.csv"))
	count, err := parser.CountRows()

	require.NoError(t, err)
	assert.Equal(t, 0, count)
}

func TestCountRows_FileNotFound(t *testing.T) {
	parser := NewCSVParser("nonexistent.csv")
	count, err := parser.CountRows()

	assert.Error(t, err)
	assert.Equal(t, 0, count)
}

func TestCountRows_EmptyFile(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "empty_count*.csv")
	require.NoError(t, err)
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	parser := NewCSVParser(tmpFile.Name())
	count, err := parser.CountRows()

	assert.Error(t, err) // Can't read headers from empty file
	assert.Equal(t, 0, count)
}

func TestCountRows_QuotedFieldsWithNewlines(t *testing.T) {
	parser := NewCSVParser(testdataPath("quoted.csv"))
	count, err := parser.CountRows()

	require.NoError(t, err)
	assert.Equal(t, 3, count) // Newlines in quoted fields don't count as new rows
}

func TestCountRows_DoesNotAffectHeaders(t *testing.T) {
	parser := NewCSVParser(testdataPath("valid.csv"))

	// Headers should be nil before any operation
	assert.Nil(t, parser.Headers())

	// Count rows
	_, err := parser.CountRows()
	require.NoError(t, err)

	// CountRows doesn't set headers (it uses its own reader)
	assert.Nil(t, parser.Headers())
}

// =============================================================================
// BOM Handling Tests
// =============================================================================

func TestParse_UTF8BOM(t *testing.T) {
	parser := NewCSVParser(testdataPath("bom.csv"))
	rows, err := parser.Parse()

	require.NoError(t, err)
	require.Len(t, rows, 1)

	// Note: The standard Go CSV reader includes BOM in the first field
	// This test documents current behavior
	headers := parser.Headers()
	// The first header will have BOM prefix unless stripped
	assert.Contains(t, headers[0], "name")
}

// =============================================================================
// Table-Driven Tests for Various Scenarios
// =============================================================================

func TestParse_TableDriven(t *testing.T) {
	tests := []struct {
		name          string
		file          string
		expectedRows  int
		expectedError bool
		errorContains string
	}{
		{
			name:         "valid file",
			file:         "valid.csv",
			expectedRows: 3,
		},
		{
			name:         "quoted fields",
			file:         "quoted.csv",
			expectedRows: 3,
		},
		{
			name:         "types file",
			file:         "types.csv",
			expectedRows: 3,
		},
		{
			name:         "headers only",
			file:         "headers_only.csv",
			expectedRows: 0,
		},
		{
			name:         "unicode",
			file:         "unicode.csv",
			expectedRows: 3,
		},
		{
			name:          "malformed",
			file:          "malformed.csv",
			expectedError: true,
			errorContains: "error reading row",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewCSVParser(testdataPath(tt.file))
			rows, err := parser.Parse()

			if tt.expectedError {
				assert.Error(t, err)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
				return
			}

			require.NoError(t, err)
			assert.Len(t, rows, tt.expectedRows)
		})
	}
}

// =============================================================================
// Large File Simulation Tests
// =============================================================================

func TestParseStream_LargeFile(t *testing.T) {
	// Create a temp file with many rows
	tmpFile, err := os.CreateTemp("", "large*.csv")
	require.NoError(t, err)
	defer os.Remove(tmpFile.Name())

	// Write header
	_, err = tmpFile.WriteString("id,name,value\n")
	require.NoError(t, err)

	// Write 1000 rows
	rowCount := 1000
	for range rowCount {
		_, err = tmpFile.WriteString("id123,Test Name,12345\n")
		require.NoError(t, err)
	}
	tmpFile.Close()

	parser := NewCSVParser(tmpFile.Name())

	processedCount := 0
	err = parser.ParseStream(func(rowNum int, row map[string]string) error {
		processedCount++
		// Verify row data is correct
		assert.Equal(t, "id123", row["id"])
		assert.Equal(t, "Test Name", row["name"])
		assert.Equal(t, "12345", row["value"])
		return nil
	})

	require.NoError(t, err)
	assert.Equal(t, rowCount, processedCount)
}

func TestCountRows_LargeFile(t *testing.T) {
	// Create a temp file with many rows
	tmpFile, err := os.CreateTemp("", "large_count*.csv")
	require.NoError(t, err)
	defer os.Remove(tmpFile.Name())

	// Write header
	_, err = tmpFile.WriteString("id,name,value\n")
	require.NoError(t, err)

	// Write 1000 rows
	rowCount := 1000
	for range rowCount {
		_, err = tmpFile.WriteString("id123,Test Name,12345\n")
		require.NoError(t, err)
	}
	tmpFile.Close()

	parser := NewCSVParser(tmpFile.Name())
	count, err := parser.CountRows()

	require.NoError(t, err)
	assert.Equal(t, rowCount, count)
}

// =============================================================================
// Empty Values Tests
// =============================================================================

func TestParse_EmptyValues(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "empty_values*.csv")
	require.NoError(t, err)
	defer os.Remove(tmpFile.Name())

	content := "name,email,age\nJohn,,30\n,jane@test.com,\n"
	_, err = tmpFile.WriteString(content)
	require.NoError(t, err)
	tmpFile.Close()

	parser := NewCSVParser(tmpFile.Name())
	rows, err := parser.Parse()

	require.NoError(t, err)
	require.Len(t, rows, 2)

	// First row: empty email
	assert.Equal(t, "John", rows[0]["name"])
	assert.Equal(t, "", rows[0]["email"])
	assert.Equal(t, "30", rows[0]["age"])

	// Second row: empty name and age
	assert.Equal(t, "", rows[1]["name"])
	assert.Equal(t, "jane@test.com", rows[1]["email"])
	assert.Equal(t, "", rows[1]["age"])
}

// =============================================================================
// Multiple Parses Tests
// =============================================================================

func TestParse_MultipleCalls(t *testing.T) {
	parser := NewCSVParser(testdataPath("valid.csv"))

	// First parse
	rows1, err := parser.Parse()
	require.NoError(t, err)
	assert.Len(t, rows1, 3)

	// Second parse should also work (fresh file read)
	rows2, err := parser.Parse()
	require.NoError(t, err)
	assert.Len(t, rows2, 3)

	// Data should be the same
	assert.Equal(t, rows1[0]["name"], rows2[0]["name"])
}
