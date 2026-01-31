# Rust Crate

Configuration for a Rust crate published to crates.io.

## Features

- Auto-updates Cargo.toml version
- Updates Cargo.lock after version bump
- Publishes to crates.io
- Supports workspace versioning

## Setup

1. Copy `.github/workflows/release.yml` to your repo
2. Add `CARGO_REGISTRY_TOKEN` secret (get from crates.io)
3. Add release labels to your PRs

## Workspace Support

If using Cargo workspaces with shared versioning:

```toml
# Cargo.toml
[workspace.package]
version = "1.0.0"

[package]
version.workspace = true
```

Release Pilot automatically detects and updates the workspace version.

## Labels

| Label | Effect |
|-------|--------|
| `release:major` | Breaking API changes |
| `release:minor` | New features (backwards compatible) |
| `release:patch` | Bug fixes |
| `release:rc` | Release candidate |
