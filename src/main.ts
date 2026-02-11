/**
 * Release Pilot - Main Action Logic
 *
 * Orchestrates the release process:
 * 1. Load configuration
 * 2. Find last release and PRs since then
 * 3. Determine version bump from labels
 * 4. Bump version in all packages
 * 5. Commit, tag, and push
 * 6. Create GitHub release
 * 7. Publish packages
 *
 * @module main
 */

import { existsSync } from 'node:fs';
import * as core from '@actions/core';
import {
  applyDefaults,
  loadConfig,
  type ResolvedConfig,
  type ResolvedPackageConfig,
  type ResolvedVersionFilesUpdateOnConfig,
} from './config/loader.js';
import { type ChangelogPR, updateChangelog } from './core/changelog.js';
import { runCleanup } from './core/cleanup.js';
import {
  configureGitUser,
  createCommit,
  createTag,
  formatCommitMessage,
  formatTag,
  type GitOptions,
  parseTagVersion,
  pushToRemote,
  stageFiles,
  updateFloatingTags,
} from './core/git.js';
import { type BumpType, bumpVersion, createDevVersion } from './core/version.js';
import { getUpdatedFiles, updateVersionFiles } from './core/version-files.js';
import {
  type EcosystemContext,
  EcosystemRegistry,
  type RegistryConfig,
} from './ecosystems/base.js';
import { CargoEcosystem } from './ecosystems/cargo.js';
import { ComposerEcosystem } from './ecosystems/composer.js';
import { CustomEcosystem } from './ecosystems/custom.js';
import { DockerEcosystem } from './ecosystems/docker.js';
import { GoEcosystem } from './ecosystems/go.js';
import { NpmEcosystem } from './ecosystems/npm.js';
import { PythonEcosystem } from './ecosystems/python.js';
import { GitHubClient } from './github/client.js';
import { extractReleaseLabels, getBumpTypeFromLabels } from './github/labels.js';
import { filterPRsSinceDate, findLastStableRelease } from './github/releases.js';

/**
 * Action input configuration
 */
interface ActionInputs {
  githubToken: string;
  configFile: string;
  mode: 'stable' | 'dev' | 'check';
  dryRun: boolean;
  devSuffix: string;
  packages?: string;
  defaultBump: BumpType;
  npmToken?: string;
  npmRegistry?: string;
  cargoToken?: string;
}

/**
 * Result of the release process
 */
interface ReleaseResult {
  version: string;
  previousVersion: string;
  bumpType: BumpType;
  releasedPackages: string[];
  skipped: boolean;
  releaseUrl?: string;
  tag?: string;
}

/**
 * Get action inputs from the workflow
 */
function getInputs(): ActionInputs {
  return {
    githubToken: core.getInput('github-token', { required: true }),
    configFile: core.getInput('config-file') || '.github/release-pilot.yml',
    mode: (core.getInput('mode') || 'stable') as ActionInputs['mode'],
    dryRun: core.getInput('dry-run') === 'true',
    devSuffix: core.getInput('dev-suffix') || 'dev',
    packages: core.getInput('packages') || undefined,
    defaultBump: (core.getInput('default-bump') || 'patch') as BumpType,
    npmToken: core.getInput('npm-token') || undefined,
    npmRegistry: core.getInput('npm-registry') || undefined,
    cargoToken: core.getInput('cargo-token') || undefined,
  };
}

/**
 * Load and resolve configuration
 */
function loadConfiguration(inputs: ActionInputs): ResolvedConfig {
  // If inline packages provided, use those
  if (inputs.packages) {
    try {
      const packages = JSON.parse(inputs.packages);
      return applyDefaults({ packages });
    } catch (error) {
      throw new Error(`Invalid packages JSON: ${error}`);
    }
  }

  // Otherwise load from config file
  if (existsSync(inputs.configFile)) {
    const config = loadConfig(inputs.configFile);
    return applyDefaults(config);
  }

  // No config - use defaults and auto-detect
  core.info('No config file found, using defaults with auto-detection');
  return applyDefaults({});
}

/**
 * Create the ecosystem registry with all implementations
 */
function createRegistry(): EcosystemRegistry {
  const registry = new EcosystemRegistry();

  registry.register(new NpmEcosystem());
  registry.register(new CargoEcosystem());
  registry.register(new PythonEcosystem());
  registry.register(new GoEcosystem());
  registry.register(new ComposerEcosystem());
  registry.register(new DockerEcosystem());
  registry.register(new CustomEcosystem());

  return registry;
}

/**
 * Set action outputs
 */
function setOutputs(result: ReleaseResult): void {
  core.setOutput('version', result.version);
  core.setOutput('previous-version', result.previousVersion);
  core.setOutput('bump-type', result.bumpType);
  core.setOutput('released-packages', JSON.stringify(result.releasedPackages));
  core.setOutput('skipped', String(result.skipped));
  if (result.releaseUrl) {
    core.setOutput('release-url', result.releaseUrl);
  }
  if (result.tag) {
    core.setOutput('tag', result.tag);
  }
}

/**
 * Create ecosystem context for a package
 */
function createEcosystemContext(
  pkg: ResolvedPackageConfig,
  dryRun: boolean,
  registry?: RegistryConfig
): EcosystemContext {
  return {
    path: pkg.path,
    versionFile: pkg.versionFile,
    dryRun,
    log: (msg: string) => core.info(`[${pkg.name}] ${msg}`),
    registry,
  };
}

/**
 * Main action runner
 */
export async function run(): Promise<void> {
  const inputs = getInputs();
  const config = loadConfiguration(inputs);
  const registry = createRegistry();

  core.info('Release Pilot starting...');
  core.info(`Mode: ${inputs.mode}`);
  core.info(`Dry run: ${inputs.dryRun}`);

  // Initialize GitHub client
  const gh = GitHubClient.fromContext(inputs.githubToken);

  // Get releases to find the last stable one
  core.info('Finding last stable release...');
  const releases = await gh.listReleases();

  const lastStable = findLastStableRelease(releases, config.version.prereleasePattern);

  let previousVersion = '0.0.0';
  let sinceDate = new Date(0).toISOString();

  if (lastStable) {
    previousVersion = parseTagVersion(lastStable.tagName, config.git.tagPrefix);
    sinceDate = lastStable.publishedAt;
    core.info(`Last stable release: ${lastStable.tagName} (${lastStable.publishedAt})`);
  } else {
    core.info('No previous stable release found');
  }

  // Get merged PRs since last release
  core.info('Finding PRs since last release...');
  const mergedPRs = await gh.listMergedPullRequests();

  const recentPRs = filterPRsSinceDate(
    mergedPRs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.author,
      mergedAt: pr.mergedAt,
      labels: pr.labels,
    })),
    sinceDate
  );
  core.info(`Found ${recentPRs.length} PRs merged since last release`);

  // Skip release if no changes detected and skipIfNoChanges is enabled
  if (recentPRs.length === 0 && config.skipIfNoChanges) {
    core.info('No changes detected since last release, skipping (skipIfNoChanges is enabled)');
    setOutputs({
      version: previousVersion,
      previousVersion,
      bumpType: 'patch',
      releasedPackages: [],
      skipped: true,
    });
    return;
  }

  // Extract release labels and determine bump type
  const releaseLabels = extractReleaseLabels(recentPRs, config.labels);
  const { bumpType, skip, prerelease } = getBumpTypeFromLabels(releaseLabels, config.labels);

  if (skip) {
    core.info('Release skipped due to skip label');
    setOutputs({
      version: previousVersion,
      previousVersion,
      bumpType: 'patch',
      releasedPackages: [],
      skipped: true,
    });
    return;
  }

  // Determine bump type (from labels or default)
  const finalBumpType = bumpType || inputs.defaultBump;
  core.info(`Bump type: ${finalBumpType}`);

  // Calculate new version
  let newVersion = bumpVersion(previousVersion, finalBumpType);

  // Apply prerelease suffix if alpha/beta/rc label found
  if (prerelease) {
    newVersion = createDevVersion(newVersion, prerelease);
    core.info(`Prerelease version (${prerelease}): ${newVersion}`);
  }
  // For dev mode, add prerelease suffix with timestamp
  else if (inputs.mode === 'dev' && config.version.devRelease) {
    newVersion = createDevVersion(newVersion, inputs.devSuffix);
    core.info(`Dev version: ${newVersion}`);
  }

  core.info(`New version: ${newVersion}`);

  // Check mode - just report, don't make changes
  if (inputs.mode === 'check') {
    core.info('Check mode - no changes made');
    setOutputs({
      version: newVersion,
      previousVersion,
      bumpType: finalBumpType,
      releasedPackages: [],
      skipped: false,
    });
    return;
  }

  // Determine packages to release
  let packages = config.packages;

  // If no packages configured, auto-detect
  if (packages.length === 0) {
    core.info('Auto-detecting packages...');
    const detected = await registry.detect(process.cwd());
    if (detected) {
      packages = [
        {
          name: 'root',
          path: '.',
          ecosystem: detected.name as ResolvedPackageConfig['ecosystem'],
          updateVersionFile: true,
          publish: true,
        },
      ];
      core.info(`Detected ecosystem: ${detected.name}`);
    } else {
      core.warning('No ecosystem detected and no packages configured');
      setOutputs({
        version: newVersion,
        previousVersion,
        bumpType: finalBumpType,
        releasedPackages: [],
        skipped: true,
      });
      return;
    }
  }

  // Determine release order
  const releaseOrder = config.releaseOrder || packages.map((p) => p.name);

  // Git options
  const gitOptions: GitOptions = {
    cwd: process.cwd(),
    dryRun: inputs.dryRun,
    log: (msg) => core.info(msg),
  };

  // Configure git user
  await configureGitUser(gitOptions);

  // Build registry config from inputs
  const registryConfig: RegistryConfig = {
    npmToken: inputs.npmToken,
    npmRegistry: inputs.npmRegistry,
    cargoToken: inputs.cargoToken,
  };

  // Update versions in all packages
  const allVersionFiles: string[] = [];
  const releasedPackages: string[] = [];

  for (const pkgName of releaseOrder) {
    const pkg = packages.find((p) => p.name === pkgName);
    if (!pkg) {
      core.warning(`Package not found: ${pkgName}`);
      continue;
    }

    const ecosystem = registry.get(pkg.ecosystem);
    if (!ecosystem) {
      core.warning(`Ecosystem not implemented: ${pkg.ecosystem}`);
      continue;
    }

    const ctx = createEcosystemContext(pkg, inputs.dryRun, registryConfig);

    core.info(`Updating ${pkg.name} (${pkg.ecosystem})...`);

    // Write new version (if enabled for this package)
    if (pkg.updateVersionFile) {
      await ecosystem.writeVersion(ctx, newVersion);

      // Run post-version hook if available
      if (ecosystem.postVersionUpdate) {
        await ecosystem.postVersionUpdate(ctx);
      }

      // Collect version files
      const files = await ecosystem.getVersionFiles(ctx);
      for (const file of files) {
        const fullPath = `${pkg.path}/${file}`.replace(/^\.\//, '');
        allVersionFiles.push(fullPath);
      }
    } else {
      core.info(`Skipping version file update for ${pkg.name} (updateVersionFile: false)`);
    }

    releasedPackages.push(pkg.name);
  }

  // Update version references in configured files (README, docs, etc.)
  // Determine the release type for updateOn check
  const releaseType: keyof ResolvedVersionFilesUpdateOnConfig = prerelease
    ? (prerelease as 'alpha' | 'beta' | 'rc')
    : inputs.mode === 'dev'
      ? 'dev'
      : 'stable';

  const shouldUpdateVersionFiles =
    config.versionFiles.enabled &&
    config.versionFiles.files.length > 0 &&
    config.versionFiles.updateOn[releaseType];

  if (shouldUpdateVersionFiles) {
    core.info('Updating version references in files...');
    const versionFileResults = updateVersionFiles(
      config.versionFiles.files,
      newVersion,
      gitOptions
    );

    // Add updated files to staging list
    const updatedVersionFiles = getUpdatedFiles(versionFileResults);
    allVersionFiles.push(...updatedVersionFiles);

    // Log any errors
    for (const result of versionFileResults) {
      if (result.error) {
        core.warning(`Failed to update ${result.file}: ${result.error}`);
      }
    }
  } else if (config.versionFiles.enabled && config.versionFiles.files.length > 0) {
    core.info(
      `Skipping version file updates for ${releaseType} release (updateOn.${releaseType}: false)`
    );
  }

  // Generate changelog if enabled
  if (config.changelog.enabled) {
    core.info('Generating changelog...');

    // Convert PR info to changelog format (data preserved from filterPRsSinceDate)
    const changelogPRs: ChangelogPR[] = recentPRs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.author ?? undefined,
      labels: pr.labels,
    }));

    const changelogResult = updateChangelog(config.changelog, newVersion, changelogPRs, {
      ...gitOptions,
      repoOwner: gh.getOwner(),
      repoName: gh.getRepo(),
    });

    if (changelogResult.error) {
      core.warning(`Failed to update ${config.changelog.file}: ${changelogResult.error}`);
    } else if (changelogResult.updated) {
      allVersionFiles.push(config.changelog.file);
    }
  }

  // Stage and commit version changes
  if (allVersionFiles.length > 0 && config.git.pushVersionCommit) {
    await stageFiles(allVersionFiles, gitOptions);

    const commitMessage = formatCommitMessage(config.git.commitMessage, newVersion);
    await createCommit(commitMessage, gitOptions);
  }

  // Create tag
  const tag = formatTag(config.git.tagPrefix, newVersion);
  if (config.git.pushTag) {
    await createTag(tag, `Release ${newVersion}`, gitOptions);
  }

  // Push to remote
  if (config.git.pushVersionCommit || config.git.pushTag) {
    await pushToRemote(gitOptions, config.git.pushTag);
  }

  // Update floating major/minor tags (e.g., v1, v1.2 for v1.2.3)
  // Only for stable releases, not dev/prerelease
  if (config.git.floatingTags && config.git.pushTag && inputs.mode === 'stable') {
    core.info('Updating floating version tags...');
    await updateFloatingTags(newVersion, config.git.tagPrefix, gitOptions);
  }

  // Create GitHub release
  let releaseUrl: string | undefined;
  if (config.githubRelease.enabled && !inputs.dryRun) {
    core.info('Creating GitHub release...');

    const isPrerelease = inputs.mode === 'dev';

    const release = await gh.createRelease({
      tagName: tag,
      name: tag,
      draft: config.githubRelease.draft,
      prerelease: isPrerelease,
      generateReleaseNotes: config.githubRelease.generateNotes,
    });

    releaseUrl = release.htmlUrl;
    core.info(`Created release: ${releaseUrl}`);
  }

  // Publish packages
  if (config.publish.enabled) {
    for (let i = 0; i < releaseOrder.length; i++) {
      const pkgName = releaseOrder[i];
      const pkg = packages.find((p) => p.name === pkgName);

      if (!pkg || pkg.publish === false) {
        continue;
      }

      const ecosystem = registry.get(pkg.ecosystem);
      if (!ecosystem?.publish) {
        continue;
      }

      const ctx = createEcosystemContext(pkg, inputs.dryRun, registryConfig);

      core.info(`Publishing ${pkg.name}...`);
      await ecosystem.publish(ctx);

      // Delay between packages (except for last one)
      if (i < releaseOrder.length - 1 && config.publish.delayBetweenPackages > 0) {
        core.info(`Waiting ${config.publish.delayBetweenPackages}s for registry indexing...`);
        await new Promise((resolve) =>
          setTimeout(resolve, config.publish.delayBetweenPackages * 1000)
        );
      }
    }
  }

  // Run cleanup of old releases/tags if enabled
  if (config.cleanup.enabled) {
    core.info('Running cleanup of old releases...');
    const cleanupResult = await runCleanup(gh, config.cleanup, config.git.tagPrefix, {
      ...gitOptions,
      warn: (msg) => core.warning(msg),
      packages,
      ecosystemRegistry: registry,
      registryConfig,
    });

    if (cleanupResult.warnings.length > 0) {
      core.info(`Cleanup completed with ${cleanupResult.warnings.length} warnings`);
    }
  }

  // Set outputs
  setOutputs({
    version: newVersion,
    previousVersion,
    bumpType: finalBumpType,
    releasedPackages,
    skipped: false,
    releaseUrl,
    tag,
  });

  core.info(`Release complete: ${tag}`);
}
