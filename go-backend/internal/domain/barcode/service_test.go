package barcode

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStringPtrIfNotEmpty(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		expectNil bool
	}{
		{
			name:      "non-empty string returns pointer",
			input:     "test",
			expectNil: false,
		},
		{
			name:      "empty string returns nil",
			input:     "",
			expectNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := stringPtrIfNotEmpty(tt.input)
			if tt.expectNil {
				assert.Nil(t, result)
			} else {
				assert.NotNil(t, result)
				assert.Equal(t, tt.input, *result)
			}
		})
	}
}

func TestNewService(t *testing.T) {
	svc := NewService()
	assert.NotNil(t, svc)
	assert.NotNil(t, svc.httpClient)
}

func TestProduct_Structure(t *testing.T) {
	// Test product with all fields
	brand := "Test Brand"
	category := "Test Category"
	imageURL := "https://example.com/image.jpg"

	product := Product{
		Barcode:  "1234567890123",
		Name:     "Test Product",
		Brand:    &brand,
		Category: &category,
		ImageURL: &imageURL,
		Found:    true,
	}

	assert.Equal(t, "1234567890123", product.Barcode)
	assert.Equal(t, "Test Product", product.Name)
	assert.Equal(t, "Test Brand", *product.Brand)
	assert.Equal(t, "Test Category", *product.Category)
	assert.Equal(t, "https://example.com/image.jpg", *product.ImageURL)
	assert.True(t, product.Found)
}

func TestProduct_NotFound(t *testing.T) {
	product := Product{
		Barcode: "0000000000000",
		Found:   false,
	}

	assert.Equal(t, "0000000000000", product.Barcode)
	assert.Empty(t, product.Name)
	assert.Nil(t, product.Brand)
	assert.Nil(t, product.Category)
	assert.Nil(t, product.ImageURL)
	assert.False(t, product.Found)
}
