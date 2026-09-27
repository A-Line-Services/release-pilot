# Rust + Docker Example

A Rust service whose release is a Docker image rather than a crates.io publish.

## Setup

1. Copy the `.github/` folder to your repository
2. Update `release-pilot.yml` with your image name
3. Create PR labels in your repo

## What happens on release

1. The version in `Cargo.toml` is bumped and committed. It is not published (`publish: false`).
2. The image is built with `docker buildx build` and pushed as `ghcr.io/myorg/my-service:{version}` and `:latest`.
   Dev releases use the default `devTags` (`dev`, `{version}`).
3. Layers are cached in the GitHub Actions cache (`cache: gha`).

## Requirements

- `docker/setup-buildx-action` must run before release-pilot. The default `docker` driver can't export the `gha` cache.
- Log in to the registry before release-pilot (here with `docker/login-action`).
  To let release-pilot log in instead, remove that step and pass the credentials:

  ```yaml
  - uses: a-line-services/release-pilot@v1
    with:
      docker-username: ${{ github.actor }}
      docker-password: ${{ secrets.GITHUB_TOKEN }}
  ```

## Secrets Required

| Secret | Description | Required |
|--------|-------------|----------|
| `GITHUB_TOKEN` | Automatic, for GHCR | Yes (automatic) |
