package factory

import (
	"strings"

	"github.com/brianvoe/gofakeit/v7"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
)

// WorkspaceOpt is a functional option for customizing a Workspace.
type WorkspaceOpt func(*workspace.Workspace)

// Workspace creates a new Workspace entity with realistic fake data.
// Options can be used to override specific fields.
func (f *Factory) Workspace(opts ...WorkspaceOpt) *workspace.Workspace {
	name := gofakeit.Company()
	slug := strings.ToLower(strings.ReplaceAll(name, " ", "-"))
	description := gofakeit.Sentence(10)

	w, err := workspace.NewWorkspace(name, slug, &description, false)
	if err != nil {
		panic("factory: failed to create workspace: " + err.Error())
	}

	for _, opt := range opts {
		opt(w)
	}

	return w
}

// WithWorkspaceName sets the workspace's name.
func WithWorkspaceName(name string) WorkspaceOpt {
	return func(w *workspace.Workspace) {
		_ = w.Update(name, w.Description())
	}
}

// WithSlug sets the workspace's slug.
func WithSlug(slug string) WorkspaceOpt {
	return func(w *workspace.Workspace) {
		*w = *workspace.Reconstruct(
			w.ID(),
			w.Name(),
			slug,
			w.Description(),
			w.IsPersonal(),
			w.CreatedAt(),
			w.UpdatedAt(),
		)
	}
}

// WithWorkspaceDescription sets the workspace's description.
func WithWorkspaceDescription(description string) WorkspaceOpt {
	return func(w *workspace.Workspace) {
		_ = w.Update(w.Name(), &description)
	}
}

// WithPersonal sets whether the workspace is personal.
func WithPersonal(isPersonal bool) WorkspaceOpt {
	return func(w *workspace.Workspace) {
		*w = *workspace.Reconstruct(
			w.ID(),
			w.Name(),
			w.Slug(),
			w.Description(),
			isPersonal,
			w.CreatedAt(),
			w.UpdatedAt(),
		)
	}
}
