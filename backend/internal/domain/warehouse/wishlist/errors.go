package wishlist

import "errors"

var (
	// ErrItemNotFound is returned when a wishlist item does not exist in the
	// workspace.
	ErrItemNotFound = errors.New("wishlist item not found")

	// ErrInvalidName is returned when the wishlist item name is empty.
	ErrInvalidName = errors.New("wishlist item name is required")

	// ErrInvalidPrice is returned when the price estimate is negative.
	ErrInvalidPrice = errors.New("wishlist price estimate must not be negative")

	// ErrInvalidCurrency is returned when the currency code is not a 3-letter
	// uppercase ISO 4217 code.
	ErrInvalidCurrency = errors.New("wishlist currency code must be a 3-letter uppercase code")

	// ErrInvalidPriority is returned when the priority is outside 1..5.
	ErrInvalidPriority = errors.New("wishlist priority must be between 1 and 5")

	// ErrInvalidStatus is returned when an unknown lifecycle status is given.
	ErrInvalidStatus = errors.New("wishlist status must be wanted, ordered or acquired")

	// ErrInvalidStatusTransition is returned when a lifecycle transition is
	// not allowed (acquired is terminal).
	ErrInvalidStatusTransition = errors.New("wishlist status transition not allowed")
)
