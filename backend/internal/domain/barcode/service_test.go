package barcode

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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


func TestLookup_ReturnsNotFoundWhenBothAPIsFail(t *testing.T) {
	// Create a service with a client that times out quickly
	svc := &Service{
		httpClient: &http.Client{Timeout: 1 * time.Millisecond},
	}

	ctx := context.Background()
	product, err := svc.Lookup(ctx, "1234567890123")

	// Should return not found when both APIs fail
	require.NoError(t, err)
	assert.Equal(t, "1234567890123", product.Barcode)
	assert.False(t, product.Found)
}

func TestLookup_ContextCancellation(t *testing.T) {
	svc := NewService()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	product, err := svc.Lookup(ctx, "1234567890123")

	// Should handle cancelled context gracefully
	require.NoError(t, err)
	assert.Equal(t, "1234567890123", product.Barcode)
	assert.False(t, product.Found)
}

func TestOpenFoodFactsResponse_Parsing(t *testing.T) {
	jsonData := `{
		"status": 1,
		"product": {
			"product_name": "Coca-Cola",
			"brands": "Coca-Cola",
			"categories": "Beverages",
			"image_url": "https://images.openfoodfacts.org/images/products/123/front.jpg"
		}
	}`

	var response openFoodFactsResponse
	err := json.Unmarshal([]byte(jsonData), &response)

	require.NoError(t, err)
	assert.Equal(t, 1, response.Status)
	assert.Equal(t, "Coca-Cola", response.Product.ProductName)
	assert.Equal(t, "Coca-Cola", response.Product.Brands)
	assert.Equal(t, "Beverages", response.Product.Categories)
	assert.Equal(t, "https://images.openfoodfacts.org/images/products/123/front.jpg", response.Product.ImageURL)
}

func TestOpenFoodFactsResponse_ParsingNotFound(t *testing.T) {
	jsonData := `{"status": 0}`

	var response openFoodFactsResponse
	err := json.Unmarshal([]byte(jsonData), &response)

	require.NoError(t, err)
	assert.Equal(t, 0, response.Status)
	assert.Empty(t, response.Product.ProductName)
}

func TestOpenProductsDBResponse_Parsing(t *testing.T) {
	jsonData := `{
		"status": {
			"code": 200,
			"message": "OK"
		},
		"product": {
			"name": "Sony Headphones",
			"brand": "Sony",
			"category": "Electronics",
			"image": "https://example.com/sony.jpg"
		}
	}`

	var response openProductsDBResponse
	err := json.Unmarshal([]byte(jsonData), &response)

	require.NoError(t, err)
	assert.Equal(t, 200, response.Status.Code)
	assert.Equal(t, "OK", response.Status.Message)
	assert.Equal(t, "Sony Headphones", response.Product.Name)
	assert.Equal(t, "Sony", response.Product.Brand)
	assert.Equal(t, "Electronics", response.Product.Category)
	assert.Equal(t, "https://example.com/sony.jpg", response.Product.Image)
}

func TestOpenProductsDBResponse_ParsingNotFound(t *testing.T) {
	jsonData := `{
		"status": {
			"code": 404,
			"message": "Not Found"
		},
		"product": {}
	}`

	var response openProductsDBResponse
	err := json.Unmarshal([]byte(jsonData), &response)

	require.NoError(t, err)
	assert.Equal(t, 404, response.Status.Code)
	assert.Empty(t, response.Product.Name)
}
