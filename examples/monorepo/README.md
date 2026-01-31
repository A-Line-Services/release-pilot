# NPM Monorepo

Configuration for a monorepo with multiple NPM packages that need to be released in order.

## Structure

```
packages/
├── core/           # Base library (released first)
│   └── package.json
├── utils/          # Utilities depending on core
│   └── package.json
└── cli/            # CLI depending on both (released last)
    └── package.json
```

## Features

- Ordered releases (core → utils → cli)
- 30-second delay between packages for npm registry indexing
- All packages share the same version
- Dev releases on push, stable on Monday

## Setup

1. Copy `.github/workflows/release.yml` to your repo
2. Copy `.github/release-pilot.yml` to your repo
3. Add `NPM_TOKEN` secret
4. Adjust package paths to match your structure

## Labels

Works the same as simple setup - labels on any PR affect all packages.
