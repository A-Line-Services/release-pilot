/**
 * Git Operations
 *
 * Handles git commands for committing, tagging, and pushing releases.
 *
 * @module core/git
 */

import * as exec from '@actions/exec';

/**
 * Options for git operations
 */
export interface GitOptions {
  /** Working directory for git commands */
  cwd: string;
  /** Whether to skip actual execution (dry run) */
  dryRun: boolean;
  /** Logger function */
  log: (message: string) => void;
}

/**
 * Format a commit message by replacing placeholders
 *
 * @param template - Message template with {version} placeholder
 * @param version - Version to substitute
 * @returns Formatted commit message
 *
 * @example
 * formatCommitMessage('chore(release): {version}', '1.2.3')
 * // 'chore(release): 1.2.3'
 */
export function formatCommitMessage(template: string, version: string): string {
  return template.replace(/\{version\}/g, version);
}

/**
 * Format a git tag with prefix
 *
 * @param prefix - Tag prefix (e.g., 'v')
 * @param version - Version string
 * @returns Formatted tag
 *
 * @example
 * formatTag('v', '1.2.3') // 'v1.2.3'
 */
export function formatTag(prefix: string, version: string): string {
  // Don't add prefix if version already starts with it
  if (prefix && version.startsWith(prefix)) {
    return version;
  }
  return `${prefix}${version}`;
}

/**
 * Extract version from a git tag
 *
 * @param tag - Git tag (e.g., 'v1.2.3')
 * @param prefix - Expected prefix
 * @returns Version without prefix
 *
 * @example
 * parseTagVersion('v1.2.3', 'v') // '1.2.3'
 */
export function parseTagVersion(tag: string, prefix: string): string {
  if (prefix && tag.startsWith(prefix)) {
    return tag.slice(prefix.length);
  }
  return tag;
}

/**
 * Configure git user for commits
 *
 * Uses the GitHub Actions bot identity.
 *
 * @param options - Git options
 */
export async function configureGitUser(options: GitOptions): Promise<void> {
  if (options.dryRun) {
    options.log('[dry-run] Would configure git user');
    return;
  }

  await exec.exec('git', ['config', '--local', 'user.name', 'github-actions[bot]'], {
    cwd: options.cwd,
  });

  await exec.exec(
    'git',
    ['config', '--local', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'],
    { cwd: options.cwd }
  );

  options.log('Configured git user as github-actions[bot]');
}

/**
 * Stage files for commit
 *
 * @param files - Array of file paths to stage
 * @param options - Git options
 */
export async function stageFiles(files: string[], options: GitOptions): Promise<void> {
  if (files.length === 0) {
    return;
  }

  if (options.dryRun) {
    options.log(`[dry-run] Would stage files: ${files.join(', ')}`);
    return;
  }

  await exec.exec('git', ['add', ...files], { cwd: options.cwd });

  options.log(`Staged files: ${files.join(', ')}`);
}

/**
 * Create a commit
 *
 * @param message - Commit message
 * @param options - Git options
 */
export async function createCommit(message: string, options: GitOptions): Promise<void> {
  if (options.dryRun) {
    options.log(`[dry-run] Would create commit: ${message}`);
    return;
  }

  await exec.exec('git', ['commit', '-m', message], { cwd: options.cwd });

  options.log(`Created commit: ${message}`);
}

/**
 * Create a git tag
 *
 * @param tag - Tag name
 * @param message - Tag annotation message (optional)
 * @param options - Git options
 */
export async function createTag(
  tag: string,
  message: string | undefined,
  options: GitOptions
): Promise<void> {
  if (options.dryRun) {
    options.log(`[dry-run] Would create tag: ${tag}`);
    return;
  }

  if (message) {
    await exec.exec('git', ['tag', '-a', tag, '-m', message], { cwd: options.cwd });
  } else {
    await exec.exec('git', ['tag', tag], { cwd: options.cwd });
  }

  options.log(`Created tag: ${tag}`);
}

/**
 * Push commits and/or tags to remote
 *
 * @param options - Git options
 * @param includeTags - Whether to push tags
 */
export async function pushToRemote(options: GitOptions, includeTags: boolean): Promise<void> {
  if (options.dryRun) {
    options.log(`[dry-run] Would push to remote${includeTags ? ' (with tags)' : ''}`);
    return;
  }

  if (includeTags) {
    await exec.exec('git', ['push', '--follow-tags'], { cwd: options.cwd });
    options.log('Pushed commits and tags to remote');
  } else {
    await exec.exec('git', ['push'], { cwd: options.cwd });
    options.log('Pushed commits to remote');
  }
}

/**
 * Push only a specific tag to remote
 *
 * @param tag - Tag to push
 * @param options - Git options
 */
export async function pushTag(tag: string, options: GitOptions): Promise<void> {
  if (options.dryRun) {
    options.log(`[dry-run] Would push tag: ${tag}`);
    return;
  }

  await exec.exec('git', ['push', 'origin', tag], { cwd: options.cwd });

  options.log(`Pushed tag: ${tag}`);
}

/**
 * Update floating major/minor version tags
 *
 * For a release like v1.2.3, this creates/updates:
 * - v1 -> points to v1.2.3
 * - v1.2 -> points to v1.2.3
 *
 * This is useful for GitHub Actions and other tools that support major version tags.
 *
 * @param version - The full version (e.g., "1.2.3")
 * @param tagPrefix - Tag prefix (e.g., "v")
 * @param options - Git options
 */
export async function updateFloatingTags(
  version: string,
  tagPrefix: string,
  options: GitOptions
): Promise<void> {
  // Parse version components
  const parts = version.split('.');
  if (parts.length < 3) {
    options.log(`Skipping floating tags: version ${version} doesn't have major.minor.patch format`);
    return;
  }

  const [major, minor] = parts;
  const majorTag = `${tagPrefix}${major}`;
  const minorTag = `${tagPrefix}${major}.${minor}`;

  if (options.dryRun) {
    options.log(
      `[dry-run] Would update floating tags: ${majorTag}, ${minorTag} -> ${tagPrefix}${version}`
    );
    return;
  }

  // Update major tag (e.g., v1 -> v1.2.3)
  await exec.exec(
    'git',
    ['tag', '-fa', majorTag, '-m', `Update ${majorTag} to ${tagPrefix}${version}`],
    {
      cwd: options.cwd,
    }
  );
  await exec.exec('git', ['push', 'origin', majorTag, '--force'], { cwd: options.cwd });

  // Update minor tag (e.g., v1.2 -> v1.2.3)
  await exec.exec(
    'git',
    ['tag', '-fa', minorTag, '-m', `Update ${minorTag} to ${tagPrefix}${version}`],
    {
      cwd: options.cwd,
    }
  );
  await exec.exec('git', ['push', 'origin', minorTag, '--force'], { cwd: options.cwd });

  options.log(`Updated floating tags: ${majorTag}, ${minorTag} -> ${tagPrefix}${version}`);
}

/**
 * Get the current commit SHA
 *
 * @param options - Git options (only cwd is used)
 * @returns Full commit SHA
 */
export async function getCurrentSha(options: Pick<GitOptions, 'cwd'>): Promise<string> {
  let sha = '';

  await exec.exec('git', ['rev-parse', 'HEAD'], {
    cwd: options.cwd,
    listeners: {
      stdout: (data: Buffer) => {
        sha += data.toString();
      },
    },
  });

  return sha.trim();
}

/**
 * Get short commit SHA (7 characters)
 *
 * @param options - Git options (only cwd is used)
 * @returns Short commit SHA
 */
export async function getShortSha(options: Pick<GitOptions, 'cwd'>): Promise<string> {
  const sha = await getCurrentSha(options);
  return sha.substring(0, 7);
}

/**
 * Check if there are uncommitted changes
 *
 * @param options - Git options (only cwd is used)
 * @returns True if working directory is dirty
 */
export async function hasUncommittedChanges(options: Pick<GitOptions, 'cwd'>): Promise<boolean> {
  let output = '';

  await exec.exec('git', ['status', '--porcelain'], {
    cwd: options.cwd,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
  });

  return output.trim().length > 0;
}
