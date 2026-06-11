package wishlist

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }

func TestNewItem_Validation(t *testing.T) {
	ws := uuid.New()

	tests := []struct {
		name          string
		workspaceID   uuid.UUID
		itemName      string
		priceEstimate *int
		currencyCode  *string
		priority      int
		wantErr       error
	}{
		{name: "valid minimal", workspaceID: ws, itemName: "New drill", priority: 3},
		{name: "valid full", workspaceID: ws, itemName: "New drill", priceEstimate: intPtr(12999), currencyCode: strPtr("EUR"), priority: 1},
		{name: "empty name", workspaceID: ws, itemName: "  ", priority: 3, wantErr: ErrInvalidName},
		{name: "negative price", workspaceID: ws, itemName: "x", priceEstimate: intPtr(-1), priority: 3, wantErr: ErrInvalidPrice},
		{name: "zero price ok", workspaceID: ws, itemName: "x", priceEstimate: intPtr(0), priority: 3},
		{name: "lowercase currency", workspaceID: ws, itemName: "x", currencyCode: strPtr("eur"), priority: 3, wantErr: ErrInvalidCurrency},
		{name: "short currency", workspaceID: ws, itemName: "x", currencyCode: strPtr("EU"), priority: 3, wantErr: ErrInvalidCurrency},
		{name: "priority too low", workspaceID: ws, itemName: "x", priority: 0, wantErr: ErrInvalidPriority},
		{name: "priority too high", workspaceID: ws, itemName: "x", priority: 6, wantErr: ErrInvalidPriority},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			item, err := NewItem(tt.workspaceID, tt.itemName, nil, nil, tt.priceEstimate, tt.currencyCode, tt.priority, nil, nil)
			if tt.wantErr != nil {
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, StatusWanted, item.Status())
			assert.Nil(t, item.AcquiredItemID())
		})
	}
}

// TestItem_TransitionStatus covers the lifecycle matrix: forward
// wanted → ordered → acquired, backward wanted ⇄ ordered, and acquired as a
// terminal state.
func TestItem_TransitionStatus(t *testing.T) {
	tests := []struct {
		name    string
		from    Status
		to      Status
		wantErr error
	}{
		{name: "wanted to ordered", from: StatusWanted, to: StatusOrdered},
		{name: "wanted to acquired", from: StatusWanted, to: StatusAcquired},
		{name: "ordered to acquired", from: StatusOrdered, to: StatusAcquired},
		{name: "ordered back to wanted", from: StatusOrdered, to: StatusWanted},
		{name: "same status is a no-op", from: StatusOrdered, to: StatusOrdered},
		{name: "acquired to wanted rejected", from: StatusAcquired, to: StatusWanted, wantErr: ErrInvalidStatusTransition},
		{name: "acquired to ordered rejected", from: StatusAcquired, to: StatusOrdered, wantErr: ErrInvalidStatusTransition},
		{name: "acquired to acquired is a no-op", from: StatusAcquired, to: StatusAcquired},
		{name: "unknown status rejected", from: StatusWanted, to: Status("bought"), wantErr: ErrInvalidStatus},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			item := newTestItem(t)
			require.NoError(t, item.TransitionStatus(tt.from))
			if tt.from == StatusAcquired {
				// Reach acquired through a valid path first.
				item = newTestItem(t)
				require.NoError(t, item.MarkAcquired(nil))
			}

			err := item.TransitionStatus(tt.to)
			if tt.wantErr != nil {
				assert.ErrorIs(t, err, tt.wantErr)
				assert.Equal(t, tt.from, item.Status(), "status must not change on rejected transition")
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.to, item.Status())
		})
	}
}

func TestItem_MarkAcquired(t *testing.T) {
	t.Run("links the created item and closes the row", func(t *testing.T) {
		item := newTestItem(t)
		created := uuid.New()

		require.NoError(t, item.MarkAcquired(&created))

		assert.Equal(t, StatusAcquired, item.Status())
		require.NotNil(t, item.AcquiredItemID())
		assert.Equal(t, created, *item.AcquiredItemID())
	})

	t.Run("works from ordered", func(t *testing.T) {
		item := newTestItem(t)
		require.NoError(t, item.TransitionStatus(StatusOrdered))
		require.NoError(t, item.MarkAcquired(nil))
		assert.Equal(t, StatusAcquired, item.Status())
	})

	t.Run("can link the item after the row is already acquired", func(t *testing.T) {
		item := newTestItem(t)
		require.NoError(t, item.MarkAcquired(nil))
		created := uuid.New()
		require.NoError(t, item.MarkAcquired(&created))
		require.NotNil(t, item.AcquiredItemID())
		assert.Equal(t, created, *item.AcquiredItemID())
	})
}

func TestItem_UpdateDetails_Validation(t *testing.T) {
	item := newTestItem(t)

	err := item.UpdateDetails("", nil, nil, nil, nil, 3, nil)
	assert.ErrorIs(t, err, ErrInvalidName)

	err = item.UpdateDetails("ok", nil, nil, intPtr(-5), nil, 3, nil)
	assert.ErrorIs(t, err, ErrInvalidPrice)

	err = item.UpdateDetails("ok", nil, nil, nil, strPtr("EURO"), 3, nil)
	assert.ErrorIs(t, err, ErrInvalidCurrency)

	err = item.UpdateDetails("ok", strPtr("notes"), strPtr("https://example.com"), intPtr(4999), strPtr("USD"), 2, nil)
	require.NoError(t, err)
	assert.Equal(t, "ok", item.Name())
	assert.Equal(t, 2, item.Priority())
}

func newTestItem(t *testing.T) *Item {
	t.Helper()
	item, err := NewItem(uuid.New(), "Wish", nil, nil, nil, nil, PriorityDefault, nil, nil)
	require.NoError(t, err)
	return item
}
