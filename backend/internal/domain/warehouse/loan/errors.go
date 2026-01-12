package loan

import "errors"

var (
	ErrLoanNotFound             = errors.New("loan not found")
	ErrAlreadyReturned          = errors.New("loan has already been returned")
	ErrInvalidQuantity          = errors.New("loan quantity must be greater than zero")
	ErrQuantityExceedsAvailable = errors.New("loan quantity exceeds available inventory")
	ErrInventoryNotAvailable    = errors.New("inventory is not available for loan")
	ErrInventoryOnLoan          = errors.New("inventory is currently on loan")
	ErrInvalidDueDate           = errors.New("due date must be after loaned date")
)
