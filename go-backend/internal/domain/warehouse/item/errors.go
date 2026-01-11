package item

import "errors"

var (
	ErrItemNotFound     = errors.New("item not found")
	ErrSKUTaken         = errors.New("SKU already exists in workspace")
	ErrShortCodeTaken   = errors.New("short code already exists in workspace")
	ErrInvalidMinStock  = errors.New("minimum stock level must be non-negative")
)
