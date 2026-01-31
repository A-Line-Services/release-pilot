# Python Package Example

Example configuration for a Python package published to PyPI.

## Setup

1. Copy the `.github/` folder to your repository
2. Add required secrets:
   - `PYPI_TOKEN` - PyPI API token (or use trusted publishing)
3. Create PR labels in your repo

## Configuration

This example uses:
- **uv** for building and publishing (falls back to twine if unavailable)
- **pyproject.toml** for version management (PEP 621)
- Dev releases on every push to main
- Stable releases every Monday at 9:00 UTC

## Trusted Publishing (Recommended)

Instead of using API tokens, you can configure [trusted publishing](https://docs.pypi.org/trusted-publishers/):

1. Go to your PyPI project settings
2. Add a new trusted publisher
3. Configure the GitHub repository and workflow file
4. Remove the `PYPI_TOKEN` secret (no longer needed)

## pyproject.toml

Your `pyproject.toml` should have a version field:

```toml
[project]
name = "my-package"
version = "0.1.0"
description = "My awesome package"
# ...
```

Or if using Poetry:

```toml
[tool.poetry]
name = "my-package"
version = "0.1.0"
# ...
```

## Secrets Required

| Secret | Description | Required |
|--------|-------------|----------|
| `PYPI_TOKEN` | PyPI API token | No (if using trusted publishing) |
