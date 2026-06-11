// Package wishlist models purchase-planning entries: items the workspace
// intends to acquire ("new drill", "spare HDMI cables"). A wishlist item
// converts into a real warehouse item on purchase — the frontend prefills the
// item create wizard from the wishlist row, then links the created item back
// via acquired_item_id and closes the row (status = acquired).
package wishlist

import (
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Status is the lifecycle state of a wishlist item.
type Status string

// Wishlist item lifecycle states. Forward flow is wanted → ordered →
// acquired; wanted ⇄ ordered may also go backward (order cancelled).
// Acquired is terminal.
const (
	StatusWanted   Status = "wanted"
	StatusOrdered  Status = "ordered"
	StatusAcquired Status = "acquired"
)

// IsValid reports whether s is a known lifecycle state.
func (s Status) IsValid() bool {
	switch s {
	case StatusWanted, StatusOrdered, StatusAcquired:
		return true
	}
	return false
}

// Priority bounds (1 = highest, 5 = lowest). Mirrors the DB CHECK constraint.
const (
	PriorityHighest = 1
	PriorityLowest  = 5
	PriorityDefault = 3
)

var currencyCodePattern = regexp.MustCompile(`^[A-Z]{3}$`)

// Item represents a wishlist entry — something the workspace plans to buy.
type Item struct {
	id                uuid.UUID
	workspaceID       uuid.UUID
	name              string
	notes             *string
	url               *string
	priceEstimate     *int // cents
	currencyCode      *string
	priority          int
	desiredCategoryID *uuid.UUID
	status            Status
	acquiredItemID    *uuid.UUID
	createdBy         *uuid.UUID
	createdAt         time.Time
	updatedAt         time.Time
}

// NewItem creates a new wishlist item in the wanted state.
func NewItem(
	workspaceID uuid.UUID,
	name string,
	notes, url *string,
	priceEstimate *int,
	currencyCode *string,
	priority int,
	desiredCategoryID *uuid.UUID,
	createdBy *uuid.UUID,
) (*Item, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if err := validateDetails(name, priceEstimate, currencyCode, priority); err != nil {
		return nil, err
	}

	now := time.Now()
	return &Item{
		id:                shared.NewUUID(),
		workspaceID:       workspaceID,
		name:              name,
		notes:             notes,
		url:               url,
		priceEstimate:     priceEstimate,
		currencyCode:      currencyCode,
		priority:          priority,
		desiredCategoryID: desiredCategoryID,
		status:            StatusWanted,
		createdBy:         createdBy,
		createdAt:         now,
		updatedAt:         now,
	}, nil
}

// Reconstruct creates an Item from database values without validation.
func Reconstruct(
	id, workspaceID uuid.UUID,
	name string,
	notes, url *string,
	priceEstimate *int,
	currencyCode *string,
	priority int,
	desiredCategoryID *uuid.UUID,
	status Status,
	acquiredItemID *uuid.UUID,
	createdBy *uuid.UUID,
	createdAt, updatedAt time.Time,
) *Item {
	return &Item{
		id:                id,
		workspaceID:       workspaceID,
		name:              name,
		notes:             notes,
		url:               url,
		priceEstimate:     priceEstimate,
		currencyCode:      currencyCode,
		priority:          priority,
		desiredCategoryID: desiredCategoryID,
		status:            status,
		acquiredItemID:    acquiredItemID,
		createdBy:         createdBy,
		createdAt:         createdAt,
		updatedAt:         updatedAt,
	}
}

// Getters

// ID returns the wishlist item's unique identifier.
func (i *Item) ID() uuid.UUID { return i.id }

// WorkspaceID returns the workspace this wishlist item belongs to.
func (i *Item) WorkspaceID() uuid.UUID { return i.workspaceID }

// Name returns the wished-for item name.
func (i *Item) Name() string { return i.name }

// Notes returns the optional free-form notes.
func (i *Item) Notes() *string { return i.notes }

// URL returns the optional product/shop URL.
func (i *Item) URL() *string { return i.url }

// PriceEstimate returns the estimated price in cents (nil = unknown).
func (i *Item) PriceEstimate() *int { return i.priceEstimate }

// CurrencyCode returns the ISO 4217 currency code of the price estimate.
func (i *Item) CurrencyCode() *string { return i.currencyCode }

// Priority returns the purchase priority (1 = highest, 5 = lowest).
func (i *Item) Priority() int { return i.priority }

// DesiredCategoryID returns the category the item should land in once acquired.
func (i *Item) DesiredCategoryID() *uuid.UUID { return i.desiredCategoryID }

// Status returns the lifecycle state.
func (i *Item) Status() Status { return i.status }

// AcquiredItemID returns the warehouse item created when this wish was
// acquired (nil until the acquire flow links it).
func (i *Item) AcquiredItemID() *uuid.UUID { return i.acquiredItemID }

// CreatedBy returns the user who added the wish (nil if the user was deleted).
func (i *Item) CreatedBy() *uuid.UUID { return i.createdBy }

// CreatedAt returns the creation timestamp.
func (i *Item) CreatedAt() time.Time { return i.createdAt }

// UpdatedAt returns the last update timestamp.
func (i *Item) UpdatedAt() time.Time { return i.updatedAt }

// UpdateDetails updates the editable wishlist fields (everything except the
// lifecycle status, which goes through TransitionStatus).
func (i *Item) UpdateDetails(
	name string,
	notes, url *string,
	priceEstimate *int,
	currencyCode *string,
	priority int,
	desiredCategoryID *uuid.UUID,
) error {
	if err := validateDetails(name, priceEstimate, currencyCode, priority); err != nil {
		return err
	}

	i.name = name
	i.notes = notes
	i.url = url
	i.priceEstimate = priceEstimate
	i.currencyCode = currencyCode
	i.priority = priority
	i.desiredCategoryID = desiredCategoryID
	i.updatedAt = time.Now()
	return nil
}

// TransitionStatus moves the item to a new lifecycle state.
//
// Allowed transitions:
//
//	wanted  → ordered, acquired
//	ordered → wanted, acquired   (backward = order cancelled)
//	acquired → (none)            (terminal)
//
// Transitioning to the current state is a no-op. Moving to acquired should
// normally go through MarkAcquired so the created item gets linked.
func (i *Item) TransitionStatus(next Status) error {
	if !next.IsValid() {
		return ErrInvalidStatus
	}
	if next == i.status {
		return nil
	}
	if i.status == StatusAcquired {
		return ErrInvalidStatusTransition
	}
	// From wanted or ordered every other state is reachable: forward to
	// acquired, and wanted ⇄ ordered both ways.
	i.status = next
	i.updatedAt = time.Now()
	return nil
}

// MarkAcquired closes the wishlist row: transitions to acquired and links the
// warehouse item created from this wish (may be nil when the item was created
// outside the orchestrated flow).
func (i *Item) MarkAcquired(acquiredItemID *uuid.UUID) error {
	if err := i.TransitionStatus(StatusAcquired); err != nil {
		return err
	}
	i.acquiredItemID = acquiredItemID
	i.updatedAt = time.Now()
	return nil
}

// validateDetails enforces the shared invariants of NewItem and UpdateDetails.
func validateDetails(name string, priceEstimate *int, currencyCode *string, priority int) error {
	if strings.TrimSpace(name) == "" {
		return ErrInvalidName
	}
	if priceEstimate != nil && *priceEstimate < 0 {
		return ErrInvalidPrice
	}
	if currencyCode != nil && !currencyCodePattern.MatchString(*currencyCode) {
		return ErrInvalidCurrency
	}
	if priority < PriorityHighest || priority > PriorityLowest {
		return ErrInvalidPriority
	}
	return nil
}
