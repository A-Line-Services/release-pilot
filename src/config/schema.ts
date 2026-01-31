/**
 * Configuration Schema
 *
 * Defines the structure and validation for release-pilot configuration files.
 * Uses Arri Schema for high-performance runtime validation.
 *
 * TODO: JSON Schema generation for editor autocomplete support is pending
 * an upstream contribution to @arrirpc/schema. See:
 * https://github.com/modiimedia/arri/issues/XXX (to be created)
 *
 * @module config/schema
 */

import { a } from '@arrirpc/schema';

// =============================================================================
// Ecosystem Types
// =============================================================================

/**
 * Supported package ecosystem types
 *
 * - npm: Node.js packages (package.json)
 * - cargo: Rust crates (Cargo.toml)
 * - python: Python packages (pyproject.toml, setup.py)
 * - go: Go modules (go.mod) - version via git tags only
 * - composer: PHP packages (composer.json)
 * - docker: Docker images (Dockerfile)
 * - custom: User-defined publish commands
 */
export const EcosystemType = a.enumerator([
  'npm',
  'cargo',
  'python',
  'go',
  'composer',
  'docker',
  'custom',
]);
export type EcosystemTypeValue = a.infer<typeof EcosystemType>;

// =============================================================================
// Docker Configuration
// =============================================================================

/**
 * Docker-specific configuration for building and pushing images
 */
export const DockerConfig = a.object(
  {
    /** Docker registry (default: docker.io) */
    registry: a.optional(a.string()),

    /** Image name without registry prefix (required) */
    image: a.string(),

    /** Registry username (supports ${{ }} syntax for secrets) */
    username: a.optional(a.string()),

    /** Registry password/token (supports ${{ }} syntax for secrets) */
    password: a.optional(a.string()),

    /** Path to Dockerfile (default: Dockerfile) */
    dockerfile: a.optional(a.string()),

    /** Build context directory (default: package path) */
    context: a.optional(a.string()),

    /** Build arguments passed to docker build */
    buildArgs: a.optional(a.record(a.string())),

    /** Target platforms for multi-arch builds (e.g., linux/amd64, linux/arm64) */
    platforms: a.optional(a.array(a.string())),

    /** Target stage for multi-stage builds */
    target: a.optional(a.string()),

    /**
     * Tag templates for stable releases
     * Supports: {version}, {major}, {minor}, {patch}, {sha}
     * Default: ['latest', '{version}']
     */
    tags: a.optional(a.array(a.string())),

    /**
     * Tag templates for dev/prerelease builds
     * Default: ['dev', '{version}']
     */
    devTags: a.optional(a.array(a.string())),

    /** Whether to push the image (default: true) */
    push: a.optional(a.boolean()),
  },
  { id: 'DockerConfig' }
);
export type DockerConfigType = a.infer<typeof DockerConfig>;

// =============================================================================
// Package Configuration
// =============================================================================

/**
 * Configuration for a single package/project to release
 */
export const PackageConfig = a.object(
  {
    /** Unique identifier for this package */
    name: a.string(),

    /** Path to package directory (default: .) */
    path: a.optional(a.string()),

    /** Package ecosystem type */
    ecosystem: EcosystemType,

    /** Custom version file path (overrides ecosystem default) */
    versionFile: a.optional(a.string()),

    /** Whether to publish this package (default: true) */
    publish: a.optional(a.boolean()),

    /** Custom publish command (for 'custom' ecosystem) */
    publishCommand: a.optional(a.string()),

    /** Arguments for custom publish command */
    publishArgs: a.optional(a.array(a.string())),

    /** Docker-specific configuration (when ecosystem is 'docker') */
    docker: a.optional(DockerConfig),
  },
  { id: 'PackageConfig' }
);
export type PackageConfigType = a.infer<typeof PackageConfig>;

// =============================================================================
// Labels Configuration
// =============================================================================

/**
 * Configuration for PR labels that determine version bump type
 */
export const LabelsConfig = a.object(
  {
    /** Label for major version bump (default: release:major) */
    major: a.optional(a.string()),

    /** Label for minor version bump (default: release:minor) */
    minor: a.optional(a.string()),

    /** Label for patch version bump (default: release:patch) */
    patch: a.optional(a.string()),

    /** Label to skip release entirely (default: release:skip) */
    skip: a.optional(a.string()),

    /** Label for alpha prerelease (default: release:alpha) */
    alpha: a.optional(a.string()),

    /** Label for beta prerelease (default: release:beta) */
    beta: a.optional(a.string()),

    /** Label for release candidate (default: release:rc) */
    rc: a.optional(a.string()),
  },
  { id: 'LabelsConfig' }
);
export type LabelsConfigType = a.infer<typeof LabelsConfig>;

// =============================================================================
// Version Configuration
// =============================================================================

/**
 * Bump type for version increments
 */
export const BumpTypeSchema = a.enumerator(['major', 'minor', 'patch']);

/**
 * Configuration for version handling
 */
export const VersionConfig = a.object(
  {
    /** Default bump type when no label is found (default: patch) */
    defaultBump: a.optional(BumpTypeSchema),

    /** Enable dev/prerelease versions on non-release branches (default: false) */
    devRelease: a.optional(a.boolean()),

    /** Suffix for dev versions (default: dev) */
    devSuffix: a.optional(a.string()),

    /** Regex pattern to detect prerelease versions (default: -rc|-beta|-alpha) */
    prereleasePattern: a.optional(a.string()),
  },
  { id: 'VersionConfig' }
);
export type VersionConfigType = a.infer<typeof VersionConfig>;

// =============================================================================
// Git Configuration
// =============================================================================

/**
 * Configuration for git operations
 */
export const GitConfig = a.object(
  {
    /** Push version bump commit to remote (default: true) */
    pushVersionCommit: a.optional(a.boolean()),

    /** Push version tag to remote (default: true) */
    pushTag: a.optional(a.boolean()),

    /** Prefix for version tags (default: v) */
    tagPrefix: a.optional(a.string()),

    /**
     * Commit message template
     * Supports: {version}, {packages}
     * Default: chore(release): {version}
     */
    commitMessage: a.optional(a.string()),
  },
  { id: 'GitConfig' }
);
export type GitConfigType = a.infer<typeof GitConfig>;

// =============================================================================
// Publish Configuration
// =============================================================================

/**
 * Configuration for package publishing
 */
export const PublishConfig = a.object(
  {
    /** Enable publishing (default: true) */
    enabled: a.optional(a.boolean()),

    /** Seconds to wait between publishing packages (default: 30) */
    delayBetweenPackages: a.optional(a.int32()),
  },
  { id: 'PublishConfig' }
);
export type PublishConfigType = a.infer<typeof PublishConfig>;

// =============================================================================
// GitHub Release Configuration
// =============================================================================

/**
 * Configuration for GitHub release creation
 */
export const GitHubReleaseConfig = a.object(
  {
    /** Create GitHub release (default: true) */
    enabled: a.optional(a.boolean()),

    /** Create as draft release (default: false) */
    draft: a.optional(a.boolean()),

    /** Auto-generate release notes from PRs (default: true) */
    generateNotes: a.optional(a.boolean()),
  },
  { id: 'GitHubReleaseConfig' }
);
export type GitHubReleaseConfigType = a.infer<typeof GitHubReleaseConfig>;

// =============================================================================
// Changelog Configuration
// =============================================================================

/**
 * Configuration for changelog generation (optional feature)
 *
 * TODO: Implement changelog generation as a pluggable feature
 */
export const ChangelogConfig = a.object(
  {
    /** Enable changelog generation (default: false) */
    enabled: a.optional(a.boolean()),

    /** Changelog file path (default: CHANGELOG.md) */
    file: a.optional(a.string()),

    /** Custom template file path */
    template: a.optional(a.string()),
  },
  { id: 'ChangelogConfig' }
);
export type ChangelogConfigType = a.infer<typeof ChangelogConfig>;

// =============================================================================
// Main Configuration
// =============================================================================

/**
 * Complete release-pilot configuration schema
 *
 * This is the root schema for .github/release-pilot.yml files.
 * All fields are optional with sensible defaults.
 */
export const ReleasePilotConfig = a.object(
  {
    /** List of packages to release (auto-detected if not specified) */
    packages: a.optional(a.array(PackageConfig)),

    /** Order in which to release packages (by name) */
    releaseOrder: a.optional(a.array(a.string())),

    /** PR label configuration */
    labels: a.optional(LabelsConfig),

    /** Version handling configuration */
    version: a.optional(VersionConfig),

    /** Git operations configuration */
    git: a.optional(GitConfig),

    /** Publishing configuration */
    publish: a.optional(PublishConfig),

    /** GitHub release configuration */
    githubRelease: a.optional(GitHubReleaseConfig),

    /** Changelog generation configuration */
    changelog: a.optional(ChangelogConfig),
  },
  {
    id: 'ReleasePilotConfig',
    description: 'Configuration schema for Release Pilot GitHub Action',
  }
);
export type ReleasePilotConfigType = a.infer<typeof ReleasePilotConfig>;

// =============================================================================
// Compiled Validators (for faster runtime validation)
// =============================================================================

/**
 * Pre-compiled validator for ReleasePilotConfig
 * Use this for faster validation in production
 */
export const $$ReleasePilotConfig = a.compile(ReleasePilotConfig);

/**
 * Pre-compiled validator for PackageConfig
 */
export const $$PackageConfig = a.compile(PackageConfig);

/**
 * Pre-compiled validator for DockerConfig
 */
export const $$DockerConfig = a.compile(DockerConfig);
