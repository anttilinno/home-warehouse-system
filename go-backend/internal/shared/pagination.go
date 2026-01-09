package shared

// Pagination holds pagination parameters.
type Pagination struct {
	Page     int
	PageSize int
}

// DefaultPagination returns default pagination settings.
func DefaultPagination() Pagination {
	return Pagination{
		Page:     1,
		PageSize: 20,
	}
}

// Offset calculates the offset for SQL queries.
func (p Pagination) Offset() int {
	if p.Page < 1 {
		p.Page = 1
	}
	return (p.Page - 1) * p.PageSize
}

// Limit returns the page size, ensuring it's within bounds.
func (p Pagination) Limit() int {
	if p.PageSize < 1 {
		return 20
	}
	if p.PageSize > 100 {
		return 100
	}
	return p.PageSize
}

// PagedResult represents a paginated response.
type PagedResult[T any] struct {
	Items      []T `json:"items"`
	Total      int `json:"total"`
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	TotalPages int `json:"total_pages"`
}

// NewPagedResult creates a new paged result.
func NewPagedResult[T any](items []T, total int, pagination Pagination) PagedResult[T] {
	totalPages := total / pagination.PageSize
	if total%pagination.PageSize > 0 {
		totalPages++
	}

	return PagedResult[T]{
		Items:      items,
		Total:      total,
		Page:       pagination.Page,
		PageSize:   pagination.PageSize,
		TotalPages: totalPages,
	}
}
