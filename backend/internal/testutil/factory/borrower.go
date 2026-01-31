package factory

import (
	"github.com/brianvoe/gofakeit/v7"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
)

// BorrowerOpt is a functional option for customizing a Borrower.
type BorrowerOpt func(*borrower.Borrower)

// Borrower creates a new Borrower entity with realistic fake data.
// Options can be used to override specific fields.
func (f *Factory) Borrower(opts ...BorrowerOpt) *borrower.Borrower {
	name := gofakeit.Name()
	email := gofakeit.Email()
	phone := gofakeit.Phone()

	b, err := borrower.NewBorrower(f.workspaceID, name, &email, &phone, nil)
	if err != nil {
		panic("factory: failed to create borrower: " + err.Error())
	}

	for _, opt := range opts {
		opt(b)
	}

	return b
}

// WithBorrowerName sets the borrower's name.
func WithBorrowerName(name string) BorrowerOpt {
	return func(b *borrower.Borrower) {
		_ = b.Update(borrower.UpdateInput{
			Name:  name,
			Email: b.Email(),
			Phone: b.Phone(),
			Notes: b.Notes(),
		})
	}
}

// WithBorrowerEmail sets the borrower's email.
func WithBorrowerEmail(email string) BorrowerOpt {
	return func(b *borrower.Borrower) {
		_ = b.Update(borrower.UpdateInput{
			Name:  b.Name(),
			Email: &email,
			Phone: b.Phone(),
			Notes: b.Notes(),
		})
	}
}

// WithBorrowerPhone sets the borrower's phone.
func WithBorrowerPhone(phone string) BorrowerOpt {
	return func(b *borrower.Borrower) {
		_ = b.Update(borrower.UpdateInput{
			Name:  b.Name(),
			Email: b.Email(),
			Phone: &phone,
			Notes: b.Notes(),
		})
	}
}

// WithBorrowerNotes sets the borrower's notes.
func WithBorrowerNotes(notes string) BorrowerOpt {
	return func(b *borrower.Borrower) {
		_ = b.Update(borrower.UpdateInput{
			Name:  b.Name(),
			Email: b.Email(),
			Phone: b.Phone(),
			Notes: &notes,
		})
	}
}
