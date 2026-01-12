package barcode

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
)

// RegisterRoutes registers barcode lookup routes.
func RegisterRoutes(api huma.API, svc *Service) {
	// Lookup barcode
	huma.Get(api, "/barcode/{barcode}", func(ctx context.Context, input *LookupInput) (*LookupOutput, error) {
		product, err := svc.Lookup(ctx, input.Barcode)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to lookup barcode")
		}

		return &LookupOutput{
			Body: ProductResponse{
				Barcode:  product.Barcode,
				Name:     product.Name,
				Brand:    product.Brand,
				Category: product.Category,
				ImageURL: product.ImageURL,
				Found:    product.Found,
			},
		}, nil
	})
}

// LookupInput is the input for barcode lookup.
type LookupInput struct {
	Barcode string `path:"barcode" minLength:"8" maxLength:"14" doc:"Barcode (EAN-8, EAN-13, or UPC)"`
}

// LookupOutput is the output for barcode lookup.
type LookupOutput struct {
	Body ProductResponse
}

// ProductResponse is the response for a barcode lookup.
type ProductResponse struct {
	Barcode  string  `json:"barcode"`
	Name     string  `json:"name"`
	Brand    *string `json:"brand,omitempty"`
	Category *string `json:"category,omitempty"`
	ImageURL *string `json:"image_url,omitempty"`
	Found    bool    `json:"found"`
}
