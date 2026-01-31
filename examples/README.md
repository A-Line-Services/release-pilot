# Examples

Example configurations for common use cases.

## Available Examples

| Example | Description |
|---------|-------------|
| [simple-npm](./simple-npm) | Single NPM package with auto-detection |
| [monorepo](./monorepo) | NPM monorepo with multiple packages |
| [rust-crate](./rust-crate) | Rust crate published to crates.io |
| [python-package](./python-package) | Python package published to PyPI |
| [go-module](./go-module) | Go module with git tag versioning |
| [docker-image](./docker-image) | Docker image with multi-arch builds |
| [multi-ecosystem](./multi-ecosystem) | Rust + Node.js bindings |

## Quick Start

1. Choose an example that matches your project
2. Copy the `.github/` folder to your repo
3. Add required secrets (see each example's README)
4. Create PR labels in your repo:
   - `release:major`
   - `release:minor`
   - `release:patch`
   - `release:skip`
   - `release:alpha` (optional)
   - `release:beta` (optional)
   - `release:rc` (optional)

## Common Patterns

### Dev + Weekly Stable

All examples use this pattern:
- **Push to main**: Creates dev release (e.g., `v1.0.0-dev.ml2fz8yd`)
- **Monday 9:00 UTC**: Creates stable release (e.g., `v1.0.0`)
- **Manual trigger**: Choose stable or dev

### Prerelease Flow

For projects that need alpha/beta/rc releases:

1. Add `release:minor` + `release:alpha` labels to PR
2. Merge → creates `v1.1.0-alpha.ml2fz8yd`
3. Continue development
4. Add `release:beta` label to next PR
5. Merge → creates `v1.1.0-beta.ml2fz8yd`
6. Add `release:rc` label when ready
7. Merge → creates `v1.1.0-rc.ml2fz8yd`
8. Wait for Monday (or manual trigger) → creates `v1.1.0`

## Need Help?

Open an issue on the [release-pilot repository](https://github.com/a-line-services/release-pilot).
