package authelia

import (
	"context"
	"errors"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/config"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/session"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
)

// --- fakes ---

type fakeUserService struct {
	byEmail  map[string]*user.User
	created  []user.CreateOAuthUserInput
	createFn func(input user.CreateOAuthUserInput) (*user.User, error)
}

func (f *fakeUserService) GetByEmail(_ context.Context, email string) (*user.User, error) {
	if u, ok := f.byEmail[email]; ok {
		return u, nil
	}
	return nil, errors.New("not found")
}

func (f *fakeUserService) CreateOAuthUser(_ context.Context, input user.CreateOAuthUserInput) (*user.User, error) {
	f.created = append(f.created, input)
	if f.createFn != nil {
		return f.createFn(input)
	}
	u, err := user.NewOAuthUser(input.Email, input.FullName)
	if err != nil {
		return nil, err
	}
	return u, nil
}

type fakeWorkspaceCreator struct {
	calls int
	err   error
}

func (f *fakeWorkspaceCreator) CreatePersonalWorkspace(_ context.Context, _ uuid.UUID, _ string) error {
	f.calls++
	return f.err
}

type fakeSessionService struct {
	session.ServiceInterface
	calls int
}

func (f *fakeSessionService) Create(_ context.Context, _ uuid.UUID, _, _, _ string) (*session.Session, error) {
	f.calls++
	return &session.Session{}, nil
}

func newTestHandler(t *testing.T, us *fakeUserService, wc *fakeWorkspaceCreator, ss *fakeSessionService) *Handler {
	t.Helper()
	svc := NewService(us, wc)
	cfg := &config.Config{AutheliaSharedSecret: "topsecret", AppURL: "http://localhost:3000"}
	return NewHandler(svc, jwt.NewService("jwt-signing-secret", 24), ss, cfg)
}

func statusOf(t *testing.T, err error) int {
	t.Helper()
	var se huma.StatusError
	if !errors.As(err, &se) {
		t.Fatalf("error is not a huma.StatusError: %v", err)
	}
	return se.GetStatus()
}

// --- tests ---

func TestLogin_RejectsWrongSecret(t *testing.T) {
	us := &fakeUserService{byEmail: map[string]*user.User{}}
	wc := &fakeWorkspaceCreator{}
	ss := &fakeSessionService{}
	h := newTestHandler(t, us, wc, ss)

	_, err := h.Login(context.Background(), &LoginInput{
		SharedSecret: "wrong",
		RemoteEmail:  "alice@example.com",
	})

	if err == nil {
		t.Fatal("expected error for wrong shared secret")
	}
	if got := statusOf(t, err); got != 401 {
		t.Fatalf("status = %d, want 401", got)
	}
	if len(us.created) != 0 || ss.calls != 0 {
		t.Fatal("a rejected request must not provision a user or session")
	}
}

func TestLogin_RejectsMissingSecret(t *testing.T) {
	h := newTestHandler(t, &fakeUserService{byEmail: map[string]*user.User{}}, &fakeWorkspaceCreator{}, &fakeSessionService{})

	_, err := h.Login(context.Background(), &LoginInput{RemoteEmail: "alice@example.com"})
	if err == nil || statusOf(t, err) != 401 {
		t.Fatalf("expected 401 for missing secret, got %v", err)
	}
}

func TestLogin_RejectsMissingEmail(t *testing.T) {
	h := newTestHandler(t, &fakeUserService{byEmail: map[string]*user.User{}}, &fakeWorkspaceCreator{}, &fakeSessionService{})

	_, err := h.Login(context.Background(), &LoginInput{SharedSecret: "topsecret", RemoteEmail: "   "})
	if err == nil || statusOf(t, err) != 401 {
		t.Fatalf("expected 401 for missing email, got %v", err)
	}
}

func TestLogin_ProvisionsNewUser(t *testing.T) {
	us := &fakeUserService{byEmail: map[string]*user.User{}}
	wc := &fakeWorkspaceCreator{}
	ss := &fakeSessionService{}
	h := newTestHandler(t, us, wc, ss)

	out, err := h.Login(context.Background(), &LoginInput{
		SharedSecret: "topsecret",
		RemoteEmail:  "newbie@example.com",
		RemoteName:   "New Bie",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(us.created) != 1 || us.created[0].FullName != "New Bie" {
		t.Fatalf("expected one user provisioned with display name, got %+v", us.created)
	}
	if wc.calls != 1 {
		t.Fatalf("expected personal workspace created once, got %d", wc.calls)
	}
	if ss.calls != 1 {
		t.Fatalf("expected one session created, got %d", ss.calls)
	}
	if len(out.SetCookie) != 2 || out.Body.Token == "" || out.Body.RefreshToken == "" {
		t.Fatal("expected access + refresh cookies and tokens in body")
	}
}

func TestLogin_ReusesExistingUser(t *testing.T) {
	existing, _ := user.NewOAuthUser("alice@example.com", "Alice")
	us := &fakeUserService{byEmail: map[string]*user.User{"alice@example.com": existing}}
	wc := &fakeWorkspaceCreator{}
	ss := &fakeSessionService{}
	h := newTestHandler(t, us, wc, ss)

	_, err := h.Login(context.Background(), &LoginInput{
		SharedSecret: "topsecret",
		RemoteEmail:  "alice@example.com",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(us.created) != 0 || wc.calls != 0 {
		t.Fatal("an existing user must not be re-provisioned")
	}
	if ss.calls != 1 {
		t.Fatalf("expected one session created, got %d", ss.calls)
	}
}

func TestLogin_FallsBackToEmailLocalPart(t *testing.T) {
	us := &fakeUserService{byEmail: map[string]*user.User{}}
	h := newTestHandler(t, us, &fakeWorkspaceCreator{}, &fakeSessionService{})

	if _, err := h.Login(context.Background(), &LoginInput{
		SharedSecret: "topsecret",
		RemoteEmail:  "bob@example.com",
		// no RemoteName / RemoteUser
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if us.created[0].FullName != "bob" {
		t.Fatalf("expected fallback display name 'bob', got %q", us.created[0].FullName)
	}
}
