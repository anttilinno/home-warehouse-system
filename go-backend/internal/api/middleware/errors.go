package middleware

import (
	"context"
	"errors"

	"github.com/antti/home-warehouse/go-backend/internal/shared/apierror"
	"github.com/danielgtaylor/huma/v2"
)

// ErrorTransformer converts domain errors to API errors for Huma
func ErrorTransformer(ctx context.Context, err error) huma.StatusError {
	var apiErr *apierror.APIError
	if errors.As(err, &apiErr) {
		return huma.NewError(apiErr.HTTPStatus, apiErr.Message, &huma.ErrorDetail{
			Message:  string(apiErr.Code),
			Location: apiErr.Field,
			Value:    apiErr.Details,
		})
	}

	// Fallback for unknown errors
	return huma.NewError(500, "Internal server error", &huma.ErrorDetail{
		Message: string(apierror.ErrCodeInternalError),
	})
}
