package postgres

// boolValue dereferences a *bool, treating nil as false. Used at the
// repository boundary where domain entities still carry *bool while the
// corresponding DB columns are NOT NULL (migration 003).
func boolValue(p *bool) bool {
	return p != nil && *p
}
