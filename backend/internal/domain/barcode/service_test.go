package barcode

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

func TestNewServiceWithURLs(t *testing.T) {
	svc := NewServiceWithURLs("http://food.test", "http://products.test")
	assert.NotNil(t, svc)
	assert.Equal(t, "http://food.test", svc.openFoodFactsURL)
	assert.Equal(t, "http://products.test", svc.openProductsDBURL)
}

func TestLookup_OpenFoodFactsSuccess(t *testing.T) {
	// Create mock server for Open Food Facts
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/1234567890123.json")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openFoodFactsResponse{
			Status: 1,
			Product: struct {
				ProductName string `json:"product_name"`
				Brands      string `json:"brands"`
				Categories  string `json:"categories"`
				ImageURL    string `json:"image_url"`
			}{
				ProductName: "Test Food Product",
				Brands:      "Test Brand",
				Categories:  "Test Category",
				ImageURL:    "https://example.com/image.jpg",
			},
		})
	}))
	defer server.Close()

	svc := NewServiceWithURLs(server.URL, "http://unused.test")
	product, err := svc.Lookup(context.Background(), "1234567890123")

	require.NoError(t, err)
	assert.True(t, product.Found)
	assert.Equal(t, "1234567890123", product.Barcode)
	assert.Equal(t, "Test Food Product", product.Name)
	assert.Equal(t, "Test Brand", *product.Brand)
	assert.Equal(t, "Test Category", *product.Category)
	assert.Equal(t, "https://example.com/image.jpg", *product.ImageURL)
}

func TestLookup_OpenFoodFactsNotFound_FallbackToOpenProductsDB(t *testing.T) {
	// Mock Open Food Facts returning not found
	foodServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openFoodFactsResponse{Status: 0})
	}))
	defer foodServer.Close()

	// Mock Open Products DB returning success
	productsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openProductsDBResponse{
			Status: struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			}{Code: 200, Message: "OK"},
			Product: struct {
				Name     string `json:"name"`
				Brand    string `json:"brand"`
				Category string `json:"category"`
				Image    string `json:"image"`
			}{
				Name:     "Electronics Product",
				Brand:    "Sony",
				Category: "Electronics",
				Image:    "https://example.com/sony.jpg",
			},
		})
	}))
	defer productsServer.Close()

	svc := NewServiceWithURLs(foodServer.URL, productsServer.URL)
	product, err := svc.Lookup(context.Background(), "9876543210123")

	require.NoError(t, err)
	assert.True(t, product.Found)
	assert.Equal(t, "9876543210123", product.Barcode)
	assert.Equal(t, "Electronics Product", product.Name)
	assert.Equal(t, "Sony", *product.Brand)
}

func TestLookup_BothAPIsFail_ReturnsNotFound(t *testing.T) {
	// Both servers return not found
	foodServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openFoodFactsResponse{Status: 0})
	}))
	defer foodServer.Close()

	productsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openProductsDBResponse{
			Status: struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			}{Code: 404, Message: "Not Found"},
		})
	}))
	defer productsServer.Close()

	svc := NewServiceWithURLs(foodServer.URL, productsServer.URL)
	product, err := svc.Lookup(context.Background(), "0000000000000")

	require.NoError(t, err)
	assert.False(t, product.Found)
	assert.Equal(t, "0000000000000", product.Barcode)
}

func TestLookup_OpenFoodFactsNon200Status(t *testing.T) {
	// Open Food Facts returns 500, should fallback
	foodServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer foodServer.Close()

	productsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openProductsDBResponse{
			Status: struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			}{Code: 200, Message: "OK"},
			Product: struct {
				Name     string `json:"name"`
				Brand    string `json:"brand"`
				Category string `json:"category"`
				Image    string `json:"image"`
			}{Name: "Fallback Product"},
		})
	}))
	defer productsServer.Close()

	svc := NewServiceWithURLs(foodServer.URL, productsServer.URL)
	product, err := svc.Lookup(context.Background(), "1234567890123")

	require.NoError(t, err)
	assert.True(t, product.Found)
	assert.Equal(t, "Fallback Product", product.Name)
}

func TestLookup_OpenFoodFactsInvalidJSON(t *testing.T) {
	// Open Food Facts returns invalid JSON
	foodServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("not valid json"))
	}))
	defer foodServer.Close()

	productsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openProductsDBResponse{
			Status: struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			}{Code: 200, Message: "OK"},
			Product: struct {
				Name     string `json:"name"`
				Brand    string `json:"brand"`
				Category string `json:"category"`
				Image    string `json:"image"`
			}{Name: "Valid Product"},
		})
	}))
	defer productsServer.Close()

	svc := NewServiceWithURLs(foodServer.URL, productsServer.URL)
	product, err := svc.Lookup(context.Background(), "1234567890123")

	require.NoError(t, err)
	assert.True(t, product.Found)
	assert.Equal(t, "Valid Product", product.Name)
}

func TestLookup_OpenProductsDBNon200Status(t *testing.T) {
	// Both APIs return non-200
	foodServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer foodServer.Close()

	productsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer productsServer.Close()

	svc := NewServiceWithURLs(foodServer.URL, productsServer.URL)
	product, err := svc.Lookup(context.Background(), "1234567890123")

	require.NoError(t, err)
	assert.False(t, product.Found)
}

func TestLookup_OpenProductsDBInvalidJSON(t *testing.T) {
	// Food fails, Products returns invalid JSON
	foodServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openFoodFactsResponse{Status: 0})
	}))
	defer foodServer.Close()

	productsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("{invalid"))
	}))
	defer productsServer.Close()

	svc := NewServiceWithURLs(foodServer.URL, productsServer.URL)
	product, err := svc.Lookup(context.Background(), "1234567890123")

	require.NoError(t, err)
	assert.False(t, product.Found)
}

func TestLookup_OpenFoodFactsEmptyProductName(t *testing.T) {
	// Open Food Facts returns status 1 but empty product name
	foodServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openFoodFactsResponse{
			Status: 1,
			Product: struct {
				ProductName string `json:"product_name"`
				Brands      string `json:"brands"`
				Categories  string `json:"categories"`
				ImageURL    string `json:"image_url"`
			}{ProductName: ""}, // Empty name
		})
	}))
	defer foodServer.Close()

	productsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openProductsDBResponse{
			Status: struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			}{Code: 200, Message: "OK"},
			Product: struct {
				Name     string `json:"name"`
				Brand    string `json:"brand"`
				Category string `json:"category"`
				Image    string `json:"image"`
			}{Name: "Fallback Product"},
		})
	}))
	defer productsServer.Close()

	svc := NewServiceWithURLs(foodServer.URL, productsServer.URL)
	product, err := svc.Lookup(context.Background(), "1234567890123")

	require.NoError(t, err)
	assert.True(t, product.Found)
	assert.Equal(t, "Fallback Product", product.Name) // Should fallback
}

func TestLookup_OpenProductsDBEmptyProductName(t *testing.T) {
	// Both return empty product names
	foodServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openFoodFactsResponse{Status: 0})
	}))
	defer foodServer.Close()

	productsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openProductsDBResponse{
			Status: struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			}{Code: 200, Message: "OK"},
			Product: struct {
				Name     string `json:"name"`
				Brand    string `json:"brand"`
				Category string `json:"category"`
				Image    string `json:"image"`
			}{Name: ""}, // Empty name
		})
	}))
	defer productsServer.Close()

	svc := NewServiceWithURLs(foodServer.URL, productsServer.URL)
	product, err := svc.Lookup(context.Background(), "1234567890123")

	require.NoError(t, err)
	assert.False(t, product.Found)
}

func TestLookup_ProductWithPartialFields(t *testing.T) {
	// Test product with some optional fields empty
	foodServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openFoodFactsResponse{
			Status: 1,
			Product: struct {
				ProductName string `json:"product_name"`
				Brands      string `json:"brands"`
				Categories  string `json:"categories"`
				ImageURL    string `json:"image_url"`
			}{
				ProductName: "Product Without Extras",
				Brands:      "", // Empty
				Categories:  "", // Empty
				ImageURL:    "", // Empty
			},
		})
	}))
	defer foodServer.Close()

	svc := NewServiceWithURLs(foodServer.URL, "http://unused.test")
	product, err := svc.Lookup(context.Background(), "1234567890123")

	require.NoError(t, err)
	assert.True(t, product.Found)
	assert.Equal(t, "Product Without Extras", product.Name)
	assert.Nil(t, product.Brand)    // Should be nil for empty string
	assert.Nil(t, product.Category) // Should be nil for empty string
	assert.Nil(t, product.ImageURL) // Should be nil for empty string
}

func TestLookup_UserAgentHeader(t *testing.T) {
	var capturedUserAgent string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedUserAgent = r.Header.Get("User-Agent")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openFoodFactsResponse{
			Status: 1,
			Product: struct {
				ProductName string `json:"product_name"`
				Brands      string `json:"brands"`
				Categories  string `json:"categories"`
				ImageURL    string `json:"image_url"`
			}{ProductName: "Test"},
		})
	}))
	defer server.Close()

	svc := NewServiceWithURLs(server.URL, "http://unused.test")
	_, err := svc.Lookup(context.Background(), "1234567890123")

	require.NoError(t, err)
	assert.Contains(t, capturedUserAgent, "HomeWarehouse")
}
