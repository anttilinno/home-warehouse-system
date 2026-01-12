package activity

import "errors"

var (
	ErrInvalidAction     = errors.New("invalid action")
	ErrInvalidEntityType = errors.New("invalid entity type")
)
