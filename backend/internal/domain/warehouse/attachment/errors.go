package attachment

import "errors"

var (
	ErrFileNotFound           = errors.New("file not found")
	ErrAttachmentNotFound     = errors.New("attachment not found")
	ErrInvalidAttachmentType  = errors.New("invalid attachment type")
)
