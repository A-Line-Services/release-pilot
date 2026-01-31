# Release Pilot

Framework-agnostic release automation GitHub Action with multi-package and multi-ecosystem support.

## Features

- **Multi-Ecosystem Support**: npm, cargo (Rust), Python, Go, Composer, Docker, and custom scripts
- **Multi-Package/Monorepo**: Release multiple packages in dependency order
- **Label-Based Versioning**: Determine version bumps from PR labels (`release:major`, `release:minor`, `release:patch`)
- **Dev Releases**: Automatic prerelease versions (e.g., `1.2.3-dev.ml2fz8yd`)
- **Prerelease Support**: Alpha, beta, and RC releases via labels
- **Configurable**: YAML configuration with sensible defaults
- **Dry Run Mode**: Test releases without making changes

## Quick Start

### Simple Usage (Auto-detect)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: a-line-services/release-pilot@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### With Configuration File

```yaml
# .github/release-pilot.yml
packages:
  - name: core
    ecosystem: npm
    path: ./packages/core
    
  - name: cli
    ecosystem: npm
    path: ./packages/cli

release-order:
  - core
  - cli

labels:
  major: "release:major"
  minor: "release:minor"
  patch: "release:patch"

version:
  defaultBump: patch
  devRelease: true

git:
  tagPrefix: v
  commitMessage: "chore(release): {version}"
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github-token` | GitHub token for API access | `${{ github.token }}` |
| `config-file` | Path to config file | `.github/release-pilot.yml` |
| `mode` | Release mode: `stable`, `dev`, or `check` | `stable` |
| `dry-run` | Run without making changes | `false` |
| `dev-suffix` | Suffix for dev releases | `dev` |
| `default-bump` | Default bump when no label | `patch` |
| `packages` | JSON array of packages (alternative to config file) | - |
| `npm-token` | NPM registry token for publishing | - |
| `npm-registry` | NPM registry URL | `https://registry.npmjs.org` |
| `cargo-token` | Cargo registry token for crates.io | - |

## Outputs

| Output | Description |
|--------|-------------|
| `version` | The new version released |
| `previous-version` | Version before this release |
| `bump-type` | Bump type applied (major/minor/patch) |
| `released-packages` | JSON array of released package names |
| `skipped` | Whether release was skipped |
| `release-url` | URL of GitHub release |
| `tag` | Git tag created |

## Release Modes

### Stable Release

Full release with version bump, tag, and GitHub release:

```yaml
- uses: a-line-services/release-pilot@v1
  with:
    mode: stable
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Dev Release

Prerelease version with base36 timestamp (e.g., `1.2.3-dev.ml2fz8yd`):

```yaml
- uses: a-line-services/release-pilot@v1
  with:
    mode: dev
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Check Mode (Dry Run)

Report what would happen without making changes:

```yaml
- uses: a-line-services/release-pilot@v1
  with:
    mode: check
    dry-run: true
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Supported Ecosystems

| Ecosystem | Version File | Publish Command |
|-----------|--------------|-----------------|
| `npm` | `package.json` | `npm publish` |
| `cargo` | `Cargo.toml` | `cargo publish` |
| `python` | `pyproject.toml` | Coming soon |
| `go` | `go.mod` | Git tag only |
| `composer` | `composer.json` | Coming soon |
| `docker` | `Dockerfile` | Coming soon |
| `custom` | User-defined | User-defined |

## Docker Support

```yaml
packages:
  - name: api-image
    ecosystem: docker
    docker:
      registry: ghcr.io
      image: myorg/api
      platforms:
        - linux/amd64
        - linux/arm64
      tags:
        - latest
        - "{version}"
        - "{major}.{minor}"
```

## Registry Authentication

### NPM

You can authenticate to npm in two ways:

**Option 1: Pass token as input (recommended)**

```yaml
- uses: a-line-services/release-pilot@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    npm-token: ${{ secrets.NPM_TOKEN }}
```

**Option 2: Pre-configure .npmrc**

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    registry-url: 'https://registry.npmjs.org'
- uses: a-line-services/release-pilot@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**GitHub Packages**

```yaml
- uses: a-line-services/release-pilot@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    npm-token: ${{ secrets.GITHUB_TOKEN }}
    npm-registry: 'https://npm.pkg.github.com'
```

### Cargo (crates.io)

**Option 1: Pass token as input**

```yaml
- uses: a-line-services/release-pilot@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    cargo-token: ${{ secrets.CARGO_REGISTRY_TOKEN }}
```

**Option 2: Pre-configure credentials**

```yaml
- name: Configure Cargo
  run: |
    mkdir -p ~/.cargo
    echo "[registry]" >> ~/.cargo/credentials.toml
    echo "token = \"${{ secrets.CARGO_REGISTRY_TOKEN }}\"" >> ~/.cargo/credentials.toml
- uses: a-line-services/release-pilot@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## PR Labels

Add these labels to your PRs to control version bumps:

### Version Bump Labels

- `release:major` - Breaking changes (1.0.0 -> 2.0.0)
- `release:minor` - New features (1.0.0 -> 1.1.0)
- `release:patch` - Bug fixes (1.0.0 -> 1.0.1)
- `release:skip` - Skip release entirely

### Prerelease Labels

- `release:alpha` - Alpha release (1.0.0 -> 1.0.0-alpha.ml2fz8yd)
- `release:beta` - Beta release (1.0.0 -> 1.0.0-beta.ml2fz8yd)
- `release:rc` - Release candidate (1.0.0 -> 1.0.0-rc.ml2fz8yd)

Combine with bump labels: `release:minor` + `release:rc` creates `1.1.0-rc.ml2fz8yd`

### Priority

- Bump type: major > minor > patch
- Prerelease: rc > beta > alpha
- Skip always wins (no release created)

## Full Configuration Reference

```yaml
# .github/release-pilot.yml

packages:
  - name: string          # Package identifier (required)
    path: string          # Directory path (default: .)
    ecosystem: string     # npm|cargo|python|go|composer|docker|custom
    versionFile: string   # Custom version file path
    publish: boolean      # Enable publishing (default: true)
    publishCommand: string    # For custom ecosystem
    publishArgs: string[]     # Arguments for custom command
    docker:               # Docker-specific config
      registry: string    # Registry URL (default: docker.io)
      image: string       # Image name (required)
      dockerfile: string  # Dockerfile path (default: Dockerfile)
      platforms: string[] # Target platforms
      tags: string[]      # Tag templates
      devTags: string[]   # Dev release tag templates

releaseOrder: string[]    # Package release order

labels:
  major: string           # Major bump label (default: release:major)
  minor: string           # Minor bump label (default: release:minor)
  patch: string           # Patch bump label (default: release:patch)
  skip: string            # Skip release label (default: release:skip)
  alpha: string           # Alpha prerelease label (default: release:alpha)
  beta: string            # Beta prerelease label (default: release:beta)
  rc: string              # Release candidate label (default: release:rc)

version:
  defaultBump: string     # Default bump type (default: patch)
  devRelease: boolean     # Enable dev releases (default: false)
  devSuffix: string       # Dev version suffix (default: dev)

git:
  pushVersionCommit: boolean  # Push version commit (default: true)
  pushTag: boolean            # Push tag (default: true)
  tagPrefix: string           # Tag prefix (default: v)
  commitMessage: string       # Commit message template

publish:
  enabled: boolean            # Enable publishing (default: true)
  delayBetweenPackages: number  # Seconds between publishes (default: 30)

githubRelease:
  enabled: boolean        # Create GitHub release (default: true)
  draft: boolean          # Create as draft (default: false)
  generateNotes: boolean  # Auto-generate notes (default: true)

changelog:
  enabled: boolean        # Generate changelog (default: false)
  file: string            # Changelog file (default: CHANGELOG.md)
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build

# Run all checks
bun run all
```

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines and submit PRs.
