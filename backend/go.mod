module github.com/antti/home-warehouse/go-backend

// Patch-pinned ON PURPOSE — this is a security floor, not a stray `go get`.
// It forces a stdlib with GO-2026-5856 (crypto/tls), GO-2026-5039
// (net/textproto) and five siblings patched; those are all "Fixed in
// go1.25.12". Relaxing it to `go 1.25.0` makes govulncheck report seven
// reachable stdlib vulnerabilities on any machine whose local toolchain is
// older, which is exactly what happened when it was tried.
// Tools that cannot honour it (osv-scanner ships Go 1.25.3 with
// GOTOOLCHAIN=local) must be configured around it — see
// .github/workflows/security-backend.yml — never by lowering this line.
go 1.25.12

require (
	github.com/SherClockHolmes/webpush-go v1.4.0
	github.com/brianvoe/gofakeit/v7 v7.14.0
	github.com/corona10/goimagehash v1.1.0
	github.com/danielgtaylor/huma/v2 v2.34.1
	github.com/disintegration/imaging v1.6.2
	github.com/go-chi/chi/v5 v5.3.0
	github.com/golang-jwt/jwt/v5 v5.3.1
	github.com/google/uuid v1.6.0
	github.com/hibiken/asynq v0.25.1
	github.com/jackc/pgx/v5 v5.9.2
	github.com/joho/godotenv v1.5.1
	github.com/kolesa-team/go-webp v1.0.5
	github.com/modelcontextprotocol/go-sdk v1.6.1
	github.com/mssola/useragent v1.0.0
	github.com/redis/go-redis/v9 v9.7.3
	github.com/stretchr/testify v1.11.1
	github.com/xuri/excelize/v2 v2.11.0
	golang.org/x/crypto v0.53.0
	golang.org/x/image v0.43.0
	golang.org/x/oauth2 v0.35.0
)

require (
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/google/jsonschema-go v0.4.3 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/nfnt/resize v0.0.0-20180221191011-83c6a9932646 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/richardlehane/mscfb v1.0.7 // indirect
	github.com/richardlehane/msoleps v1.0.6 // indirect
	github.com/robfig/cron/v3 v3.0.1 // indirect
	github.com/rogpeppe/go-internal v1.14.1 // indirect
	github.com/segmentio/asm v1.1.3 // indirect
	github.com/segmentio/encoding v0.5.4 // indirect
	github.com/spf13/cast v1.7.0 // indirect
	github.com/stretchr/objx v0.5.2 // indirect
	github.com/tiendc/go-deepcopy v1.7.2 // indirect
	github.com/xuri/efp v0.0.1 // indirect
	github.com/xuri/nfp v0.0.2-0.20250530014748-2ddeb826f9a9 // indirect
	github.com/yosida95/uritemplate/v3 v3.0.2 // indirect
	golang.org/x/net v0.56.0 // indirect
	golang.org/x/sync v0.21.0 // indirect
	golang.org/x/sys v0.46.0 // indirect
	golang.org/x/text v0.39.0 // indirect
	golang.org/x/time v0.8.0 // indirect
	google.golang.org/protobuf v1.36.6 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
