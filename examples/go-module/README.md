# Go Module Example

Example configuration for a Go module.

## Setup

1. Copy the `.github/` folder to your repository
2. Create PR labels in your repo
3. That's it! Go modules don't need registry tokens.

## How It Works

Go modules use git tags for versioning - there's no central registry to publish to. When you create a release:

1. Release Pilot creates a git tag (e.g., `v1.2.3`)
2. Go module proxy automatically caches your module
3. Users can import with `go get github.com/yourorg/yourmodule@v1.2.3`

## Configuration

This example uses:
- **go.mod** for module detection (version comes from git tags)
- Dev releases on every push to main
- Stable releases every Monday at 9:00 UTC

## go.mod

Your `go.mod` should declare your module path:

```go
module github.com/yourorg/yourmodule

go 1.22
```

## Major Version Suffixes

For Go modules v2+, you need to update your module path:

```go
// v2 and above require path suffix
module github.com/yourorg/yourmodule/v2

go 1.22
```

Consider using separate branches or directories for major versions.

## Secrets Required

None! Go modules are fetched directly from your git repository.
