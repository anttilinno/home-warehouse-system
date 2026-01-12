package movement

import "errors"

var (
	ErrInvalidQuantity = errors.New("movement quantity must be greater than zero")
)
