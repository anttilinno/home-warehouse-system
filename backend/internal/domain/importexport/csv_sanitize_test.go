package importexport

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSanitizeCSVCell(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"empty string", "", ""},
		{"plain text", "Hammer", "Hammer"},
		{"text with embedded equals", "a=b", "a=b"},
		{"formula equals", "=cmd|'/c calc'!A1", "'=cmd|'/c calc'!A1"},
		{"formula plus", "+1+1", "'+1+1"},
		{"formula minus", "-1+1", "'-1+1"},
		{"formula at", "@SUM(A1)", "'@SUM(A1)"},
		{"leading tab", "\t=1+1", "'\t=1+1"},
		{"leading carriage return", "\r=1+1", "'\r=1+1"},
		{"uuid untouched", "0b09a51e-7f3a-4cf4-9c5a-000000000001", "0b09a51e-7f3a-4cf4-9c5a-000000000001"},
		{"timestamp untouched", "2026-06-11T00:00:00Z", "2026-06-11T00:00:00Z"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, sanitizeCSVCell(tt.input))
		})
	}
}

func TestSanitizeCSVRow(t *testing.T) {
	row := []string{"=evil", "safe", "+also evil"}
	assert.Equal(t, []string{"'=evil", "safe", "'+also evil"}, sanitizeCSVRow(row))
}

// End-to-end: a malicious item name must come out of the CSV export neutralized.
func TestToCSV_NeutralizesFormulaInjection(t *testing.T) {
	svc := &Service{}
	items := []ItemExport{{
		ID:   "id-1",
		Name: "=cmd|'/c calc'!A1",
	}}

	out, err := svc.toCSV(items, EntityTypeItem)
	assert.NoError(t, err)
	assert.Contains(t, string(out), "'=cmd|")
	assert.NotContains(t, string(out), "\n=cmd|")
}
