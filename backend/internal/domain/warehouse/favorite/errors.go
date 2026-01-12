package favorite

import "errors"

var (
	ErrFavoriteNotFound     = errors.New("favorite not found")
	ErrInvalidFavoriteType  = errors.New("invalid favorite type")
)
