package inventory

import "errors"

var (
	ErrInventoryNotFound     = errors.New("inventory not found")
	ErrInsufficientQuantity  = errors.New("quantity must be greater than zero")
	ErrInvalidCondition      = errors.New("invalid condition")
	ErrInvalidStatus         = errors.New("invalid status")
	ErrAlreadyOnLoan         = errors.New("inventory is already on loan")
)
