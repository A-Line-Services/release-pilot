/**
 * Configuration Loader
 *
 * Handles loading, parsing, validating, and applying defaults to
 * release-pilot configuration files.
 *
 * @module config/loader
 */

import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { a } from '@arrirpc/schema';
import {
  ReleasePilotConfig,
  type ReleasePilotConfigType,
  type PackageConfigType,
  type DockerConfigType,
  type LabelsConfigType,
  type VersionConfigType,
  type GitConfigType,
  type PublishConfigType,
  type GitHubReleaseConfigType,
  type ChangelogConfigType,
} from './schema.js';
import type { BumpType } from '../core/version.js';

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
}

// =============================================================================
// Default Values
// =============================================================================

const DEFAULT_LABELS: ResolvedLabelsConfig = {
  major: 'release:major',
  minor: 'release:minor',
  patch: 'release:patch',
  skip: 'release:skip',
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
