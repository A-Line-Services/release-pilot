# Simple NPM Package

The simplest setup for a single NPM package. Release Pilot auto-detects the ecosystem from `package.json`.

## Features

- Auto-detection (no config file needed)
- Dev releases on every push to main
- Stable releases on Monday or manual trigger
- Publishes to npm registry

## Setup

1. Copy `.github/workflows/release.yml` to your repo
2. Add `NPM_TOKEN` secret to your repository
3. Add release labels to your PRs

## Labels

| Label | Effect |
|-------|--------|
| `release:major` | 1.0.0 → 2.0.0 |
| `release:minor` | 1.0.0 → 1.1.0 |
| `release:patch` | 1.0.0 → 1.0.1 |
| `release:skip` | No release |

No label defaults to `patch`.
