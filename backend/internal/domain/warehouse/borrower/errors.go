package borrower

import "errors"

var (
	ErrBorrowerNotFound = errors.New("borrower not found")
	ErrHasActiveLoans   = errors.New("borrower has active loans and cannot be deleted")
)
