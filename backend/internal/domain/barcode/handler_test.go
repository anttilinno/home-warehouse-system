package barcode_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/barcode"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements barcode.ServiceInterface
type MockService struct {
	mock.Mock
}

func (m *MockService) Lookup(ctx context.Context, barcodeStr string) (*barcode.Product, error) {
	args := m.Called(ctx, barcodeStr)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*barcode.Product), args.Error(1)
}

// Tests

func TestBarcodeHandler_Lookup(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	barcode.RegisterRoutes(setup.API, mockSvc)

	t.Run("looks up barcode successfully", func(t *testing.T) {
		brand := "Sony"
		category := "Electronics"
		imageURL := "https://example.com/image.jpg"

		product := &barcode.Product{
			Barcode:  "1234567890123",
			Name:     "Sony Headphones",
			Brand:    &brand,
			Category: &category,
			ImageURL: &imageURL,
			Found:    true,
		}

		mockSvc.On("Lookup", mock.Anything, "1234567890123").
			Return(product, nil).Once()

		rec := setup.Get("/barcode/1234567890123")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns not found when barcode not found", func(t *testing.T) {
		product := &barcode.Product{
			Barcode: "9999999999999",
			Name:    "",
			Found:   false,
		}

		mockSvc.On("Lookup", mock.Anything, "9999999999999").
			Return(product, nil).Once()

		rec := setup.Get("/barcode/9999999999999")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles service error", func(t *testing.T) {
		mockSvc.On("Lookup", mock.Anything, "1234567890123").
			Return(nil, fmt.Errorf("test error")).Once()

		rec := setup.Get("/barcode/1234567890123")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})

	t.Run("validates barcode length", func(t *testing.T) {
		// Too short - should fail validation
		rec := setup.Get("/barcode/123")

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("handles EAN-13 barcode", func(t *testing.T) {
		product := &barcode.Product{
			Barcode: "4006381333931",
			Name:    "Test Product",
			Found:   true,
		}

		mockSvc.On("Lookup", mock.Anything, "4006381333931").
			Return(product, nil).Once()

		rec := setup.Get("/barcode/4006381333931")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}
