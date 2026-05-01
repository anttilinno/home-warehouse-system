// Phase 1 (v3.0) trim: only ApiError ports forward — User / AuthTokenResponse /
// RegisterData live in v2.1's types.ts but they belong to Phase 5 (Auth) and
// will be re-introduced there with the v3.0-shape entity types. ApiError is
// the single type api.ts depends on, so this is the minimum viable surface.

export interface ApiError {
  message?: string;
  detail?: string;
  code?: string;
}
