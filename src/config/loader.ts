/**
 * Configuration Loader
 *
 * Handles loading, parsing, validating, and applying defaults to
 * release-pilot configuration files.
 *
 * @module config/loader
 */

import { existsSync, readFileSync } from 'node:fs';
import { a } from '@arrirpc/schema';
import { parse as parseYaml } from 'yaml';
import type { BumpType } from '../core/version.js';
import {
  type ChangelogConfigType,
  type CleanupConfigType,
  type CleanupTypeConfigType,
  type DockerConfigType,
  type GitConfigType,
  type GitHubReleaseConfigType,
  type LabelsConfigType,
  type PackageConfigType,
  type PublishConfigType,
  ReleasePilotConfig,
  type ReleasePilotConfigType,
  type VersionConfigType,
  type VersionFilesConfigType,
  type VersionFilesUpdateOnConfigType,
} from './schema.js';

// =============================================================================
// Resolved Config Types (with all defaults applied)
// =============================================================================

/**
 * Package configuration with all defaults applied
 */
export interface ResolvedPackageConfig {
  name: string;
  path: string;
  ecosystem: PackageConfigType['ecosystem'];
  versionFile?: string;
  updateVersionFile: boolean;
  publish: boolean;
  publishCommand?: string;
  publishArgs?: string[];
  docker?: ResolvedDockerConfig;
}

/**
 * Docker configuration with all defaults applied
 */
export interface ResolvedDockerConfig {
  registry: string;
  image: string;
  username?: string;
  password?: string;
  dockerfile: string;
  context?: string;
  buildArgs?: Record<string, string>;
  platforms?: string[];
  target?: string;
  tags: string[];
  devTags: string[];
  push: boolean;
}

/**
 * Labels configuration with all defaults applied
 */
export interface ResolvedLabelsConfig {
  major: string;
  minor: string;
  patch: string;
  skip: string;
  alpha: string;
  beta: string;
  rc: string;
}

/**
 * Version configuration with all defaults applied
 */
export interface ResolvedVersionConfig {
  defaultBump: BumpType;
  devRelease: boolean;
  devSuffix: string;
  prereleasePattern: string;
}

/**
 * Git configuration with all defaults applied
 */
export interface ResolvedGitConfig {
  pushVersionCommit: boolean;
  pushTag: boolean;
  tagPrefix: string;
  commitMessage: string;
  floatingTags: boolean;
}

/**
 * Publish configuration with all defaults applied
 */
export interface ResolvedPublishConfig {
  enabled: boolean;
  delayBetweenPackages: number;
}

/**
 * GitHub release configuration with all defaults applied
 */
export interface ResolvedGitHubReleaseConfig {
  enabled: boolean;
  draft: boolean;
  generateNotes: boolean;
}

/**
 * Changelog configuration with all defaults applied
 */
export interface ResolvedChangelogConfig {
  enabled: boolean;
  file: string;
  template?: string;
}

/**
 * Version file update configuration
 */
export interface ResolvedVersionFileUpdate {
  file: string;
  pattern: string;
  replace: string;
}

/**
 * Configuration for which release types trigger version file updates
 */
export interface ResolvedVersionFilesUpdateOnConfig {
  stable: boolean;
  dev: boolean;
  alpha: boolean;
  beta: boolean;
  rc: boolean;
}

/**
 * Version files configuration with all defaults applied
 */
export interface ResolvedVersionFilesConfig {
  enabled: boolean;
  updateOn: ResolvedVersionFilesUpdateOnConfig;
  files: ResolvedVersionFileUpdate[];
}

/**
 * Cleanup settings for a specific release type with all defaults applied
 */
export interface ResolvedCleanupTypeConfig {
  /** Whether to clean up git tags */
  tags: boolean;
  /** Whether to clean up GitHub releases */
  releases: boolean;
  /** Whether to clean up published packages from registries */
  published: boolean;
  /** Number of releases to keep */
  keep: number;
}

/**
 * Cleanup configuration with all defaults applied
 */
export interface ResolvedCleanupConfig {
  /** Whether cleanup is enabled globally */
  enabled: boolean;
  /** Cleanup settings for dev releases */
  dev: ResolvedCleanupTypeConfig;
  /** Cleanup settings for alpha releases */
  alpha: ResolvedCleanupTypeConfig;
  /** Cleanup settings for beta releases */
  beta: ResolvedCleanupTypeConfig;
  /** Cleanup settings for release candidates */
  rc: ResolvedCleanupTypeConfig;
  /** Cleanup settings for stable releases */
  stable: ResolvedCleanupTypeConfig;
}

/**
 * Complete configuration with all defaults applied
 */
export interface ResolvedConfig {
  packages: ResolvedPackageConfig[];
  releaseOrder?: string[];
  labels: ResolvedLabelsConfig;
  version: ResolvedVersionConfig;
  git: ResolvedGitConfig;
  publish: ResolvedPublishConfig;
  githubRelease: ResolvedGitHubReleaseConfig;
  changelog: ResolvedChangelogConfig;
  versionFiles: ResolvedVersionFilesConfig;
  cleanup: ResolvedCleanupConfig;
  skipIfNoChanges: boolean;
}

// =============================================================================
// Default Values
// =============================================================================

const DEFAULT_LABELS: ResolvedLabelsConfig = {
  major: 'release:major',
  minor: 'release:minor',
  patch: 'release:patch',
  skip: 'release:skip',
  alpha: 'release:alpha',
  beta: 'release:beta',
  rc: 'release:rc',
};

const DEFAULT_VERSION: ResolvedVersionConfig = {
  defaultBump: 'patch',
  devRelease: false,
  devSuffix: 'dev',
  prereleasePattern: '-rc|-beta|-alpha',
};

const DEFAULT_GIT: ResolvedGitConfig = {
  pushVersionCommit: true,
  pushTag: true,
  tagPrefix: 'v',
  commitMessage: 'chore(release): {version}',
  floatingTags: false,
};

const DEFAULT_PUBLISH: ResolvedPublishConfig = {
  enabled: true,
  delayBetweenPackages: 30,
};

const DEFAULT_GITHUB_RELEASE: ResolvedGitHubReleaseConfig = {
  enabled: true,
  draft: false,
  generateNotes: true,
};

const DEFAULT_CHANGELOG: ResolvedChangelogConfig = {
  enabled: false,
  file: 'CHANGELOG.md',
};

const DEFAULT_DOCKER: Omit<ResolvedDockerConfig, 'image'> = {
  registry: 'docker.io',
  dockerfile: 'Dockerfile',
  tags: ['latest', '{version}'],
  devTags: ['dev', '{version}'],
  push: true,
};

const DEFAULT_CLEANUP_TYPE: ResolvedCleanupTypeConfig = {
  tags: false,
  releases: false,
  published: false,
  keep: 10,
};

const DEFAULT_CLEANUP: ResolvedCleanupConfig = {
  enabled: false,
  dev: { ...DEFAULT_CLEANUP_TYPE },
  alpha: { ...DEFAULT_CLEANUP_TYPE },
  beta: { ...DEFAULT_CLEANUP_TYPE },
  rc: { ...DEFAULT_CLEANUP_TYPE },
  stable: { ...DEFAULT_CLEANUP_TYPE, keep: 0 }, // Stable: keep all by default
};

// =============================================================================
// Loading Functions
// =============================================================================

/**
 * Load and parse a configuration file
 *
 * @param configPath - Path to the YAML configuration file
 * @returns Parsed (but not defaulted) configuration
 * @throws Error if file doesn't exist, has invalid YAML, or fails validation
 *
 * @example
 * const config = loadConfig('.github/release-pilot.yml');
 */
export function loadConfig(configPath: string): ReleasePilotConfigType {
  // Check file exists
  if (!existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  // Read file
  const content = readFileSync(configPath, 'utf-8');

  // Parse YAML
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid YAML in ${configPath}: ${message}`);
  }

  // Handle empty files
  if (parsed === null || parsed === undefined) {
    parsed = {};
  }

  // Validate against schema
  if (!a.validate(ReleasePilotConfig, parsed)) {
    const errors = a.errors(ReleasePilotConfig, parsed);
    const errorMessages = errors.map((e) => `  ${e.instancePath || '/'}: ${e.message}`).join('\n');
    throw new Error(`Invalid configuration in ${configPath}:\n${errorMessages}`);
  }

  return parsed as ReleasePilotConfigType;
}

/**
 * Apply default values to a configuration
 *
 * @param config - Partial configuration (from file or action inputs)
 * @returns Complete configuration with all defaults applied
 *
 * @example
 * const resolved = applyDefaults(loadConfig('.github/release-pilot.yml'));
 */
export function applyDefaults(config: ReleasePilotConfigType): ResolvedConfig {
  return {
    packages: (config.packages ?? []).map(applyPackageDefaults),
    releaseOrder: config.releaseOrder,
    labels: applyLabelsDefaults(config.labels),
    version: applyVersionDefaults(config.version),
    git: applyGitDefaults(config.git),
    publish: applyPublishDefaults(config.publish),
    githubRelease: applyGitHubReleaseDefaults(config.githubRelease),
    changelog: applyChangelogDefaults(config.changelog),
    versionFiles: applyVersionFilesDefaults(config.versionFiles),
    cleanup: applyCleanupDefaults(config.cleanup),
    skipIfNoChanges: config.skipIfNoChanges ?? false,
  };
}

/**
 * Load config and apply defaults in one step
 *
 * @param configPath - Path to the YAML configuration file
 * @returns Complete configuration with all defaults applied
 */
export function loadAndResolveConfig(configPath: string): ResolvedConfig {
  const config = loadConfig(configPath);
  return applyDefaults(config);
}

// =============================================================================
// Default Application Helpers
// =============================================================================

function applyPackageDefaults(pkg: PackageConfigType): ResolvedPackageConfig {
  const resolved: ResolvedPackageConfig = {
    name: pkg.name,
    path: pkg.path ?? '.',
    ecosystem: pkg.ecosystem,
    versionFile: pkg.versionFile,
    updateVersionFile: pkg.updateVersionFile ?? true,
    publish: pkg.publish ?? true,
    publishCommand: pkg.publishCommand,
    publishArgs: pkg.publishArgs,
  };

  // Apply docker defaults if applicable
  if (pkg.ecosystem === 'docker' && pkg.docker) {
    resolved.docker = applyDockerDefaults(pkg.docker);
  }

  return resolved;
}

function applyDockerDefaults(docker: DockerConfigType): ResolvedDockerConfig {
  return {
    registry: docker.registry ?? DEFAULT_DOCKER.registry,
    image: docker.image,
    username: docker.username,
    password: docker.password,
    dockerfile: docker.dockerfile ?? DEFAULT_DOCKER.dockerfile,
    context: docker.context,
    buildArgs: docker.buildArgs,
    platforms: docker.platforms,
    target: docker.target,
    tags: docker.tags ?? DEFAULT_DOCKER.tags,
    devTags: docker.devTags ?? DEFAULT_DOCKER.devTags,
    push: docker.push ?? DEFAULT_DOCKER.push,
  };
}

function applyLabelsDefaults(labels?: LabelsConfigType): ResolvedLabelsConfig {
  return {
    major: labels?.major ?? DEFAULT_LABELS.major,
    minor: labels?.minor ?? DEFAULT_LABELS.minor,
    patch: labels?.patch ?? DEFAULT_LABELS.patch,
    skip: labels?.skip ?? DEFAULT_LABELS.skip,
    alpha: labels?.alpha ?? DEFAULT_LABELS.alpha,
    beta: labels?.beta ?? DEFAULT_LABELS.beta,
    rc: labels?.rc ?? DEFAULT_LABELS.rc,
  };
}

function applyVersionDefaults(version?: VersionConfigType): ResolvedVersionConfig {
  return {
    defaultBump: (version?.defaultBump as BumpType) ?? DEFAULT_VERSION.defaultBump,
    devRelease: version?.devRelease ?? DEFAULT_VERSION.devRelease,
    devSuffix: version?.devSuffix ?? DEFAULT_VERSION.devSuffix,
    prereleasePattern: version?.prereleasePattern ?? DEFAULT_VERSION.prereleasePattern,
  };
}

function applyGitDefaults(git?: GitConfigType): ResolvedGitConfig {
  return {
    pushVersionCommit: git?.pushVersionCommit ?? DEFAULT_GIT.pushVersionCommit,
    pushTag: git?.pushTag ?? DEFAULT_GIT.pushTag,
    tagPrefix: git?.tagPrefix ?? DEFAULT_GIT.tagPrefix,
    commitMessage: git?.commitMessage ?? DEFAULT_GIT.commitMessage,
    floatingTags: git?.floatingTags ?? DEFAULT_GIT.floatingTags,
  };
}

function applyPublishDefaults(publish?: PublishConfigType): ResolvedPublishConfig {
  return {
    enabled: publish?.enabled ?? DEFAULT_PUBLISH.enabled,
    delayBetweenPackages: publish?.delayBetweenPackages ?? DEFAULT_PUBLISH.delayBetweenPackages,
  };
}

function applyGitHubReleaseDefaults(
  githubRelease?: GitHubReleaseConfigType
): ResolvedGitHubReleaseConfig {
  return {
    enabled: githubRelease?.enabled ?? DEFAULT_GITHUB_RELEASE.enabled,
    draft: githubRelease?.draft ?? DEFAULT_GITHUB_RELEASE.draft,
    generateNotes: githubRelease?.generateNotes ?? DEFAULT_GITHUB_RELEASE.generateNotes,
  };
}

function applyChangelogDefaults(changelog?: ChangelogConfigType): ResolvedChangelogConfig {
  return {
    enabled: changelog?.enabled ?? DEFAULT_CHANGELOG.enabled,
    file: changelog?.file ?? DEFAULT_CHANGELOG.file,
    template: changelog?.template,
  };
}

function applyVersionFilesUpdateOnDefaults(
  updateOn?: VersionFilesUpdateOnConfigType
): ResolvedVersionFilesUpdateOnConfig {
  return {
    stable: updateOn?.stable ?? true,
    dev: updateOn?.dev ?? false,
    alpha: updateOn?.alpha ?? false,
    beta: updateOn?.beta ?? false,
    rc: updateOn?.rc ?? false,
  };
}

function applyVersionFilesDefaults(
  versionFiles?: VersionFilesConfigType
): ResolvedVersionFilesConfig {
  return {
    enabled: versionFiles?.enabled ?? false,
    updateOn: applyVersionFilesUpdateOnDefaults(versionFiles?.updateOn),
    files: (versionFiles?.files ?? []).map((f) => ({
      file: f.file,
      pattern: f.pattern,
      replace: f.replace,
    })),
  };
}

/**
 * Apply defaults to cleanup type config
 *
 * The `all` field is a shorthand that expands to tags=true, releases=true, published=true.
 * Individual settings override the `all` shorthand when specified.
 */
function applyCleanupTypeDefaults(
  typeConfig: CleanupTypeConfigType | undefined,
  defaults: ResolvedCleanupTypeConfig
): ResolvedCleanupTypeConfig {
  if (!typeConfig) {
    return { ...defaults };
  }

  // If `all` is set, use it as the base for tags/releases/published
  // Individual settings override `all` when explicitly specified
  const allValue = typeConfig.all ?? false;

  return {
    tags: typeConfig.tags ?? (allValue || defaults.tags),
    releases: typeConfig.releases ?? (allValue || defaults.releases),
    published: typeConfig.published ?? (allValue || defaults.published),
    keep: typeConfig.keep ?? defaults.keep,
  };
}

function applyCleanupDefaults(cleanup?: CleanupConfigType): ResolvedCleanupConfig {
  return {
    enabled: cleanup?.enabled ?? DEFAULT_CLEANUP.enabled,
    dev: applyCleanupTypeDefaults(cleanup?.dev, DEFAULT_CLEANUP.dev),
    alpha: applyCleanupTypeDefaults(cleanup?.alpha, DEFAULT_CLEANUP.alpha),
    beta: applyCleanupTypeDefaults(cleanup?.beta, DEFAULT_CLEANUP.beta),
    rc: applyCleanupTypeDefaults(cleanup?.rc, DEFAULT_CLEANUP.rc),
    stable: applyCleanupTypeDefaults(cleanup?.stable, DEFAULT_CLEANUP.stable),
  };
}
