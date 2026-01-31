# Docker Image Example

Example configuration for building and pushing Docker images.

## Setup

1. Copy the `.github/` folder to your repository
2. Update `release-pilot.yml` with your image name
3. Create PR labels in your repo

## Configuration

This example uses:
- **GitHub Container Registry** (ghcr.io)
- **Multi-platform builds** (amd64 + arm64)
- **Multiple tags** per release
- Dev releases on every push to main
- Stable releases every Monday at 9:00 UTC

## Tag Templates

Configure how images are tagged:

```yaml
docker:
  tags:           # For stable releases
    - latest
    - "{version}"      # e.g., 1.2.3
    - "{major}.{minor}" # e.g., 1.2
    - "{major}"         # e.g., 1
  devTags:        # For dev releases
    - dev
    - "{version}"      # e.g., 1.2.3-dev.ml2fz8yd
```

## Using Docker Hub

To push to Docker Hub instead of GHCR:

```yaml
# release-pilot.yml
docker:
  registry: docker.io
  image: myorg/my-app
```

```yaml
# workflow
- name: Log in to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
```

## Using AWS ECR

```yaml
# release-pilot.yml
docker:
  registry: 123456789.dkr.ecr.us-east-1.amazonaws.com
  image: my-app
```

```yaml
# workflow
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: us-east-1

- name: Log in to ECR
  uses: aws-actions/amazon-ecr-login@v2
```

## Build Arguments

Pass build-time variables:

```yaml
docker:
  buildArgs:
    NODE_ENV: production
    BUILD_DATE: "{version}"
```

## Multi-stage Builds

Target a specific stage:

```yaml
docker:
  target: production
```

## Secrets Required

| Secret | Description | Required |
|--------|-------------|----------|
| `GITHUB_TOKEN` | Automatic, for GHCR | Yes (automatic) |
| `DOCKERHUB_USERNAME` | Docker Hub username | Only for Docker Hub |
| `DOCKERHUB_TOKEN` | Docker Hub access token | Only for Docker Hub |
