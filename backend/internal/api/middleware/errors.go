package middleware

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/shared/apierror"
	"github.com/danielgtaylor/huma/v2"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// ErrorTransformer converts domain errors to API errors for Huma.
//
// Recognition order:
//  1. *apierror.APIError      -> use its explicit HTTP status, code, field.
//  2. *shared.DomainError     -> map the wrapped sentinel to an HTTP status,
//     surfacing Field as the error location and preserving the message.
//  3. anything else           -> 500 Internal Server Error.
func ErrorTransformer(ctx context.Context, err error) huma.StatusError {
	var apiErr *apierror.APIError
	if errors.As(err, &apiErr) {
		return huma.NewError(apiErr.HTTPStatus, apiErr.Message, &huma.ErrorDetail{
			Message:  string(apiErr.Code),
			Location: apiErr.Field,
			Value:    apiErr.Details,
		})
	}

	var domainErr *shared.DomainError
	if errors.As(err, &domainErr) {
		status := domainStatus(domainErr.Err)
		return huma.NewError(status, domainErr.Message, &huma.ErrorDetail{
			Location: domainErr.Field,
		})
	}

	// Fallback for unknown errors. The response body is intentionally
	// generic, so log the underlying cause here — this is the only place
	// the real error is still visible.
	attrs := []any{"error", err}
	if reqID := chimiddleware.GetReqID(ctx); reqID != "" {
		attrs = append(attrs, "request_id", reqID)
	}
	if user, ok := GetAuthUser(ctx); ok {
		attrs = append(attrs, "user_id", user.ID.String())
	}
	if workspaceID, ok := GetWorkspaceID(ctx); ok {
		attrs = append(attrs, "workspace_id", workspaceID.String())
	}
	slog.Error("unhandled internal error", attrs...)

	return huma.NewError(500, "Internal server error", &huma.ErrorDetail{
		Message: string(apierror.ErrCodeInternalError),
	})
}

// MapDomainError converts a domain/service error into a typed huma.StatusError
// with the correct HTTP status derived from the wrapped sentinel. It surfaces
// the DomainError.Field as the error location and preserves the message.
//
// Handlers should call this instead of hardcoding huma.Error400BadRequest for
// errors returned by service/domain calls, so not-found/conflict/forbidden
// distinctions and field locations reach the client intact. Unknown errors
// (including raw request-parse failures) map to 400 Bad Request to preserve
// the prior default for non-domain handler errors.
func MapDomainError(err error) huma.StatusError {
	if err == nil {
		return nil
	}

	var domainErr *shared.DomainError
	if errors.As(err, &domainErr) {
		status := domainStatus(domainErr.Err)
		if domainErr.Field != "" {
			return huma.NewError(status, domainErr.Message, &huma.ErrorDetail{
				Location: domainErr.Field,
			})
		}
		return huma.NewError(status, domainErr.Message)
	}

	// Bare sentinels (errors.Is) without a DomainError wrapper.
	if status, ok := sentinelStatus(err); ok {
		return huma.NewError(status, err.Error())
	}

	// Non-domain error: preserve the historical 400 default.
	return huma.NewError(http.StatusBadRequest, err.Error())
}

// domainStatus maps a domain sentinel to its HTTP status, defaulting to 400.
func domainStatus(sentinel error) int {
	if status, ok := sentinelStatus(sentinel); ok {
		return status
	}
	return http.StatusBadRequest
}

// sentinelStatus reports the HTTP status for a known domain sentinel.
func sentinelStatus(err error) (int, bool) {
	switch {
	case errors.Is(err, shared.ErrNotFound):
		return http.StatusNotFound, true
	case errors.Is(err, shared.ErrInvalidInput):
		return http.StatusBadRequest, true
	case errors.Is(err, shared.ErrAlreadyExists):
		return http.StatusConflict, true
	case errors.Is(err, shared.ErrUnauthorized):
		return http.StatusUnauthorized, true
	case errors.Is(err, shared.ErrForbidden):
		return http.StatusForbidden, true
	case errors.Is(err, shared.ErrConflict):
		return http.StatusConflict, true
	case errors.Is(err, shared.ErrInternal):
		return http.StatusInternalServerError, true
	default:
		return 0, false
	}
}
