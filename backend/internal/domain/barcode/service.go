package barcode

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Product represents product information from a barcode lookup.
type Product struct {
	Barcode  string  `json:"barcode"`
	Name     string  `json:"name"`
	Brand    *string `json:"brand,omitempty"`
	Category *string `json:"category,omitempty"`
	ImageURL *string `json:"image_url,omitempty"`
	Found    bool    `json:"found"`
}

// Service handles barcode lookups from external APIs.
type Service struct {
	httpClient *http.Client
}

// NewService creates a new barcode service.
func NewService() *Service {
	return &Service{
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Lookup looks up a barcode in external databases.
// It tries Open Food Facts first, then falls back to Open Products Database.
func (s *Service) Lookup(ctx context.Context, barcode string) (*Product, error) {
	// Try Open Food Facts first (for food items)
	if product, err := s.lookupOpenFoodFacts(ctx, barcode); err == nil && product.Found {
		return product, nil
	}

	// Try Open Products Database as fallback (for non-food items)
	if product, err := s.lookupOpenProductsDB(ctx, barcode); err == nil && product.Found {
		return product, nil
	}

	// Return not found
	return &Product{Barcode: barcode, Found: false}, nil
}

// openFoodFactsResponse represents the response from Open Food Facts API.
type openFoodFactsResponse struct {
	Status  int `json:"status"`
	Product struct {
		ProductName string `json:"product_name"`
		Brands      string `json:"brands"`
		Categories  string `json:"categories"`
		ImageURL    string `json:"image_url"`
	} `json:"product"`
}

// lookupOpenFoodFacts looks up a barcode in Open Food Facts database.
func (s *Service) lookupOpenFoodFacts(ctx context.Context, barcode string) (*Product, error) {
	url := fmt.Sprintf("https://world.openfoodfacts.org/api/v0/product/%s.json", barcode)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "HomeWarehouse/1.0 (https://github.com/antti/home-warehouse)")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &Product{Barcode: barcode, Found: false}, nil
	}

	var result openFoodFactsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Status != 1 || result.Product.ProductName == "" {
		return &Product{Barcode: barcode, Found: false}, nil
	}

	return &Product{
		Barcode:  barcode,
		Name:     result.Product.ProductName,
		Brand:    stringPtrIfNotEmpty(result.Product.Brands),
		Category: stringPtrIfNotEmpty(result.Product.Categories),
		ImageURL: stringPtrIfNotEmpty(result.Product.ImageURL),
		Found:    true,
	}, nil
}

// openProductsDBResponse represents the response from Open Products Database API.
type openProductsDBResponse struct {
	Status struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"status"`
	Product struct {
		Name     string `json:"name"`
		Brand    string `json:"brand"`
		Category string `json:"category"`
		Image    string `json:"image"`
	} `json:"product"`
}

// lookupOpenProductsDB looks up a barcode in Open Products Database.
func (s *Service) lookupOpenProductsDB(ctx context.Context, barcode string) (*Product, error) {
	url := fmt.Sprintf("https://api.openproductsdb.org/v1/product/%s", barcode)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "HomeWarehouse/1.0 (https://github.com/antti/home-warehouse)")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &Product{Barcode: barcode, Found: false}, nil
	}

	var result openProductsDBResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Status.Code != 200 || result.Product.Name == "" {
		return &Product{Barcode: barcode, Found: false}, nil
	}

	return &Product{
		Barcode:  barcode,
		Name:     result.Product.Name,
		Brand:    stringPtrIfNotEmpty(result.Product.Brand),
		Category: stringPtrIfNotEmpty(result.Product.Category),
		ImageURL: stringPtrIfNotEmpty(result.Product.Image),
		Found:    true,
	}, nil
}

// stringPtrIfNotEmpty returns a pointer to the string if it's not empty, nil otherwise.
func stringPtrIfNotEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
