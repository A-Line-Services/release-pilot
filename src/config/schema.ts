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

    /**
     * Whether to update the version in manifest files (default: true)
     * Set to false for packages that use git tags for versioning (e.g., GitHub Actions)
     */
    updateVersionFile: a.optional(a.boolean()),

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

    /**
     * Update floating major/minor tags (default: false)
     * When enabled, releases like v1.2.3 will also update v1 and v1.2 tags.
     * Useful for GitHub Actions and other tools that support major version tags.
     */
    floatingTags: a.optional(a.boolean()),
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
 * Configuration for a file that should have version references updated
 */
export const VersionFileUpdate = a.object(
  {
    /** File path relative to repository root */
    file: a.string(),

    /**
     * Regex pattern to match version strings
     * Must contain a capture group for the version
     * Example: "uses: org/action@v([0-9.]+)"
     */
    pattern: a.string(),

    /**
     * Replacement template
     * Use {version}, {major}, {minor}, {patch} placeholders
     * Example: "uses: org/action@v{version}"
     */
    replace: a.string(),
  },
  { id: 'VersionFileUpdate' }
);
export type VersionFileUpdateType = a.infer<typeof VersionFileUpdate>;

/**
 * Configuration for which release types should trigger version file updates
 *
 * All fields are optional and default to false, except `stable` which defaults to true.
 * This allows updating documentation only for stable releases by default.
 *
 * @example
 * ```yaml
 * versionFiles:
 *   enabled: true
 *   updateOn:
 *     stable: true   # default: true
 *     rc: true       # also update for release candidates
 *   files:
 *     - file: README.md
 *       pattern: 'version: [0-9.]+'
 *       replace: 'version: {version}'
 * ```
 */
export const VersionFilesUpdateOnConfig = a.object(
  {
    /** Update version files on stable releases (default: true) */
    stable: a.optional(a.boolean()),

    /** Update version files on dev releases (default: false) */
    dev: a.optional(a.boolean()),

    /** Update version files on alpha releases (default: false) */
    alpha: a.optional(a.boolean()),

    /** Update version files on beta releases (default: false) */
    beta: a.optional(a.boolean()),

    /** Update version files on release candidate releases (default: false) */
    rc: a.optional(a.boolean()),
  },
  { id: 'VersionFilesUpdateOnConfig' }
);
export type VersionFilesUpdateOnConfigType = a.infer<typeof VersionFilesUpdateOnConfig>;

/**
 * Configuration for updating version references in files
 */
export const VersionFilesConfig = a.object(
  {
    /** Enable version file updates (default: false) */
    enabled: a.optional(a.boolean()),

    /**
     * Which release types should trigger version file updates
     * By default, only stable releases update version files.
     */
    updateOn: a.optional(VersionFilesUpdateOnConfig),

    /** List of files and patterns to update */
    files: a.optional(a.array(VersionFileUpdate)),
  },
  { id: 'VersionFilesConfig' }
);
export type VersionFilesConfigType = a.infer<typeof VersionFilesConfig>;

// =============================================================================
// Cleanup Configuration
// =============================================================================

/**
 * Cleanup settings for a specific release type (dev, alpha, beta, rc, stable)
 *
 * Controls what artifacts to clean up and how many to retain.
 * All fields are optional and default to false/disabled.
 *
 * The `all` field is a shorthand that expands to `tags: true, releases: true, published: true`.
 * You can combine `all` with individual settings to opt out of specific cleanup types.
 *
 * @example
 * ```yaml
 * # Clean up all artifact types, keep last 10
 * dev:
 *   all: true
 *   keep: 10
 *
 * # All except published packages
 * alpha:
 *   all: true
 *   published: false
 *   keep: 5
 *
 * # Granular control
 * beta:
 *   tags: true
 *   releases: true
 *   published: false
 *   keep: 5
 * ```
 */
export const CleanupTypeConfig = a.object(
  {
    /**
     * Shorthand to enable cleanup for all artifact types (tags, releases, published).
     * Individual settings (tags, releases, published) override this when specified.
     */
    all: a.optional(a.boolean()),

    /** Clean up git tags for this release type (default: false) */
    tags: a.optional(a.boolean()),

    /** Clean up GitHub releases for this release type (default: false) */
    releases: a.optional(a.boolean()),

    /**
     * Clean up published packages/images from registries (default: false)
     * Note: Not all registries support deletion. Supported: npm, PyPI, Docker.
     * Unsupported (will warn): crates.io (yank only), Go, Packagist.
     */
    published: a.optional(a.boolean()),

    /**
     * Number of releases to keep (default: 10)
     * Set to 0 to remove all (use with caution!)
     */
    keep: a.optional(a.int32()),
  },
  { id: 'CleanupTypeConfig' }
);
export type CleanupTypeConfigType = a.infer<typeof CleanupTypeConfig>;

/**
 * Configuration for cleaning up old releases, tags, and published packages
 *
 * Cleanup is disabled by default. When enabled, you can configure cleanup
 * behavior per release type (dev, alpha, beta, rc, stable).
 *
 * @example
 * ```yaml
 * cleanup:
 *   enabled: true
 *
 *   dev:
 *     all: true
 *     keep: 10
 *
 *   alpha:
 *     tags: true
 *     releases: true
 *     keep: 5
 *
 *   stable:
 *     # Don't clean up stable releases (this is the default)
 *     tags: false
 *     releases: false
 * ```
 */
export const CleanupConfig = a.object(
  {
    /** Enable cleanup globally (default: false). Must be true for any cleanup to occur. */
    enabled: a.optional(a.boolean()),

    /** Cleanup settings for dev releases (e.g., 1.0.0-dev.abc123) */
    dev: a.optional(CleanupTypeConfig),

    /** Cleanup settings for alpha releases (e.g., 1.0.0-alpha.1) */
    alpha: a.optional(CleanupTypeConfig),

    /** Cleanup settings for beta releases (e.g., 1.0.0-beta.1) */
    beta: a.optional(CleanupTypeConfig),

    /** Cleanup settings for release candidates (e.g., 1.0.0-rc.1) */
    rc: a.optional(CleanupTypeConfig),

    /** Cleanup settings for stable releases (e.g., 1.0.0) - use with caution! */
    stable: a.optional(CleanupTypeConfig),
  },
  { id: 'CleanupConfig' }
);
export type CleanupConfigType = a.infer<typeof CleanupConfig>;

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

    /** Version file updates configuration */
    versionFiles: a.optional(VersionFilesConfig),

    /** Cleanup configuration for old releases, tags, and published packages */
    cleanup: a.optional(CleanupConfig),
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
