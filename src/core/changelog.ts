/**
 * Changelog Generation
 *
 * Handles generating and updating CHANGELOG.md files from PR information.
 *
 * @module core/changelog
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ResolvedChangelogConfig } from '../config/loader.js';
import type { BaseOperationOptions } from './types.js';

/**
 * Pull request information for changelog entry
 */
export interface ChangelogPR {
  /** PR number */
  number: number;
  /** PR title */
  title: string;
  /** PR author username */
  author?: string;
  /** Labels on the PR */
  labels: string[];
}

/**
 * Repository information for generating PR links
 */
export interface RepoInfo {
  /** Repository owner */
  owner: string;
  /** Repository name */
  name: string;
}

/**
 * Options for changelog generation
 */
export interface ChangelogOptions extends BaseOperationOptions {
  /** Repository owner for PR links */
  repoOwner: string;
  /** Repository name for PR links */
  repoName: string;
}

/**
 * Result of changelog generation
 */
export interface ChangelogResult {
  /** Path to the changelog file */
  file: string;
  /** Whether the changelog was updated */
  updated: boolean;
  /** Number of entries added */
  entriesAdded: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Changelog entry category
 */
export type ChangelogCategory = 'breaking' | 'features' | 'fixes' | 'docs' | 'chores' | 'other';

/**
 * Categorized changelog entries
 */
export interface CategorizedEntries {
  breaking: ChangelogPR[];
  features: ChangelogPR[];
  fixes: ChangelogPR[];
  docs: ChangelogPR[];
  chores: ChangelogPR[];
  other: ChangelogPR[];
}

/** Categories to check (excludes 'other' as it's the fallback) */
const CATEGORIZABLE: ChangelogCategory[] = ['breaking', 'features', 'fixes', 'docs', 'chores'];

/** Display titles for each category */
const CATEGORY_TITLES: Record<ChangelogCategory, string> = {
  breaking: 'Breaking Changes',
  features: 'Features',
  fixes: 'Bug Fixes',
  docs: 'Documentation',
  chores: 'Chores',
  other: 'Other Changes',
};

/** Order in which categories appear in the changelog */
const CATEGORY_ORDER: ChangelogCategory[] = [
  'breaking',
  'features',
  'fixes',
  'docs',
  'chores',
  'other',
];

/**
 * Label patterns for categorizing PRs by label
 */
const LABEL_PATTERNS: Record<ChangelogCategory, RegExp[]> = {
  breaking: [/^breaking/i, /^major/i],
  features: [/^feat/i, /^feature/i, /^enhancement/i, /^minor/i],
  fixes: [/^fix/i, /^bug/i, /^patch/i],
  docs: [/^doc/i, /^documentation/i],
  chores: [/^chore/i, /^maintenance/i, /^refactor/i, /^ci/i, /^build/i, /^deps/i, /^dependenc/i],
  other: [],
};

/**
 * Title patterns for categorizing PRs by conventional commit prefix
 */
const TITLE_PATTERNS: Array<{ pattern: RegExp; category: ChangelogCategory }> = [
  { pattern: /^feat(ure)?[:(]/i, category: 'features' },
  { pattern: /^(fix|bug)[:(]/i, category: 'fixes' },
  { pattern: /^docs?[:(]/i, category: 'docs' },
  { pattern: /^(chore|ci|build|refactor)[:(]/i, category: 'chores' },
  { pattern: /^breaking[:(]/i, category: 'breaking' },
  { pattern: /breaking change/i, category: 'breaking' },
];

/**
 * Labels that indicate a PR should be excluded from the changelog
 */
const EXCLUDE_PATTERNS: RegExp[] = [/^skip.?changelog/i, /^no.?changelog/i, /^release:/i];

/**
 * Check if any label matches any pattern in a list
 */
function matchesAnyPattern(labels: string[], patterns: RegExp[]): boolean {
  return labels.some((label) => patterns.some((pattern) => pattern.test(label)));
}

/**
 * Categorize a PR based on its labels
 */
function categorizeByLabels(labels: string[]): ChangelogCategory | null {
  for (const category of CATEGORIZABLE) {
    if (matchesAnyPattern(labels, LABEL_PATTERNS[category])) {
      return category;
    }
  }
  return null;
}

/**
 * Categorize a PR based on its title (conventional commit format)
 */
function categorizeByTitle(title: string): ChangelogCategory {
  const match = TITLE_PATTERNS.find(({ pattern }) => pattern.test(title));
  return match?.category ?? 'other';
}

/**
 * Categorize a PR based on its labels and title
 *
 * First attempts to categorize by labels, then falls back to title-based
 * categorization using conventional commit format.
 */
export function categorizePR(pr: ChangelogPR): ChangelogCategory {
  return categorizeByLabels(pr.labels) ?? categorizeByTitle(pr.title);
}

/**
 * Check if a PR should be excluded from the changelog
 *
 * PRs with labels like "skip-changelog", "no-changelog", or "release:*"
 * are excluded.
 */
export function shouldExcludePR(pr: ChangelogPR): boolean {
  return matchesAnyPattern(pr.labels, EXCLUDE_PATTERNS);
}

/**
 * Create empty categorized entries structure
 */
function createEmptyEntries(): CategorizedEntries {
  return {
    breaking: [],
    features: [],
    fixes: [],
    docs: [],
    chores: [],
    other: [],
  };
}

/**
 * Categorize all PRs into groups
 *
 * Filters out excluded PRs and groups the rest by category.
 */
export function categorizePRs(prs: ChangelogPR[]): CategorizedEntries {
  return prs
    .filter((pr) => !shouldExcludePR(pr))
    .reduce<CategorizedEntries>((entries, pr) => {
      entries[categorizePR(pr)].push(pr);
      return entries;
    }, createEmptyEntries());
}

/**
 * Format a single PR entry for the changelog
 */
export function formatPREntry(pr: ChangelogPR, repo: RepoInfo): string {
  const prLink = `[#${pr.number}](https://github.com/${repo.owner}/${repo.name}/pull/${pr.number})`;
  const author = pr.author ? ` by @${pr.author}` : '';
  return `- ${pr.title} (${prLink})${author}`;
}

/**
 * Format a category section with header and entries
 */
export function formatCategorySection(
  category: ChangelogCategory,
  prs: ChangelogPR[],
  repo: RepoInfo
): string {
  if (prs.length === 0) return '';

  const title = CATEGORY_TITLES[category];
  const entries = prs.map((pr) => formatPREntry(pr, repo)).join('\n');

  return `### ${title}\n\n${entries}`;
}

/**
 * Generate changelog content for a release
 */
export function generateChangelogContent(
  version: string,
  prs: ChangelogPR[],
  repoOwner: string,
  repoName: string,
  date: Date = new Date()
): string {
  const categorized = categorizePRs(prs);
  const dateStr = date.toISOString().split('T')[0];
  const repo: RepoInfo = { owner: repoOwner, name: repoName };

  const sections = CATEGORY_ORDER.map((category) =>
    formatCategorySection(category, categorized[category], repo)
  ).filter(Boolean);

  // If no sections, add a simple note
  if (sections.length === 0) {
    sections.push('- No notable changes in this release');
  }

  return `## [${version}] - ${dateStr}\n\n${sections.join('\n\n')}`;
}

/**
 * Parse existing changelog to find where to insert new entry
 *
 * Returns the position after the header where new entries should be inserted
 */
export function findInsertPosition(content: string): number {
  // Look for the first version header (## [x.x.x])
  const versionHeaderMatch = content.match(/^## \[[\d.]+/m);
  if (versionHeaderMatch?.index !== undefined) {
    return versionHeaderMatch.index;
  }

  // Look for any ## header
  const headerMatch = content.match(/^## /m);
  if (headerMatch?.index !== undefined) {
    return headerMatch.index;
  }

  // If there's a title (# Changelog), insert after it
  const titleMatch = content.match(/^# .+\n+/);
  if (titleMatch) {
    return titleMatch[0].length;
  }

  // Otherwise, insert at the beginning
  return 0;
}

/**
 * Create initial changelog content if file doesn't exist
 */
export function createInitialChangelog(): string {
  return `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;
}

/**
 * Update or create changelog file
 */
export function updateChangelog(
  config: ResolvedChangelogConfig,
  version: string,
  prs: ChangelogPR[],
  options: ChangelogOptions
): ChangelogResult {
  const filePath = join(options.cwd, config.file);
  const entriesCount = prs.filter((pr) => !shouldExcludePR(pr)).length;

  try {
    // Generate the new entry
    const newEntry = generateChangelogContent(version, prs, options.repoOwner, options.repoName);

    let content: string;
    let isNew = false;

    // Read existing file or create new
    if (existsSync(filePath)) {
      content = readFileSync(filePath, 'utf-8');
    } else {
      content = createInitialChangelog();
      isNew = true;
    }

    // Find where to insert
    const insertPos = findInsertPosition(content);

    // Insert the new entry
    const updatedContent = `${content.slice(0, insertPos)}${newEntry}\n\n${content.slice(insertPos)}`;

    // Write the file
    if (options.dryRun) {
      options.log(`[dry-run] Would ${isNew ? 'create' : 'update'} ${config.file}`);
      options.log(`[dry-run] Would add ${entriesCount} changelog entries`);
    } else {
      writeFileSync(filePath, updatedContent);
      options.log(`${isNew ? 'Created' : 'Updated'} ${config.file} with ${entriesCount} entries`);
    }

    return {
      file: config.file,
      updated: true,
      entriesAdded: entriesCount,
    };
  } catch (error) {
    return {
      file: config.file,
      updated: false,
      entriesAdded: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
