package csvparser

import (
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strings"
)

type CSVParser struct {
	filePath string
	headers  []string
}

func NewCSVParser(filePath string) *CSVParser {
	return &CSVParser{filePath: filePath}
}

func (p *CSVParser) Parse() ([]map[string]string, error) {
	file, err := os.Open(p.filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true

	// Read header row
	headers, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read headers: %w", err)
	}

	// Normalize headers (lowercase, trim spaces)
	for i, h := range headers {
		headers[i] = strings.TrimSpace(strings.ToLower(h))
	}
	p.headers = headers

	// Read all rows
	var rows []map[string]string
	rowNum := 1
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("error reading row %d: %w", rowNum, err)
		}

		// Convert row to map
		rowMap := make(map[string]string)
		for i, value := range record {
			if i < len(headers) {
				rowMap[headers[i]] = strings.TrimSpace(value)
			}
		}

		rows = append(rows, rowMap)
		rowNum++
	}

	return rows, nil
}

func (p *CSVParser) ParseStream(callback func(rowNum int, row map[string]string) error) error {
	file, err := os.Open(p.filePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true

	// Read header row
	headers, err := reader.Read()
	if err != nil {
		return fmt.Errorf("failed to read headers: %w", err)
	}

	// Normalize headers
	for i, h := range headers {
		headers[i] = strings.TrimSpace(strings.ToLower(h))
	}
	p.headers = headers

	// Stream rows
	rowNum := 1
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("error reading row %d: %w", rowNum, err)
		}

		// Convert row to map
		rowMap := make(map[string]string)
		for i, value := range record {
			if i < len(headers) {
				rowMap[headers[i]] = strings.TrimSpace(value)
			}
		}

		// Call callback
		if err := callback(rowNum, rowMap); err != nil {
			return err
		}

		rowNum++
	}

	return nil
}

func (p *CSVParser) Headers() []string {
	return p.headers
}

func (p *CSVParser) CountRows() (int, error) {
	file, err := os.Open(p.filePath)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	reader := csv.NewReader(file)

	// Skip header
	if _, err := reader.Read(); err != nil {
		return 0, err
	}

	count := 0
	for {
		_, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, err
		}
		count++
	}

	return count, nil
}
