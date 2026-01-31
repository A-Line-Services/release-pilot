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
 * Options for changelog generation
 */
export interface ChangelogOptions {
  /** Base directory (usually repository root) */
  cwd: string;
  /** Whether this is a dry run */
  dryRun: boolean;
  /** Logger function */
  log: (message: string) => void;
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

/**
 * Category display configuration
 */
const CATEGORY_CONFIG: Record<ChangelogCategory, { title: string; emoji: string }> = {
  breaking: { title: 'Breaking Changes', emoji: '' },
  features: { title: 'Features', emoji: '' },
  fixes: { title: 'Bug Fixes', emoji: '' },
  docs: { title: 'Documentation', emoji: '' },
  chores: { title: 'Chores', emoji: '' },
  other: { title: 'Other Changes', emoji: '' },
};

/**
 * Label patterns for categorizing PRs
 */
const CATEGORY_LABELS: Record<ChangelogCategory, RegExp[]> = {
  breaking: [/^breaking/i, /^major/i],
  features: [/^feat/i, /^feature/i, /^enhancement/i, /^minor/i],
  fixes: [/^fix/i, /^bug/i, /^patch/i],
  docs: [/^doc/i, /^documentation/i],
  chores: [/^chore/i, /^maintenance/i, /^refactor/i, /^ci/i, /^build/i, /^deps/i, /^dependenc/i],
  other: [],
};

/**
 * Labels that indicate a PR should be excluded from the changelog
 */
const EXCLUDE_LABELS = [/^skip.?changelog/i, /^no.?changelog/i, /^release:/i];

/**
 * Categorize a PR based on its labels
 */
export function categorizePR(pr: ChangelogPR): ChangelogCategory {
  for (const label of pr.labels) {
    // Check each category's patterns
    for (const [category, patterns] of Object.entries(CATEGORY_LABELS) as [
      ChangelogCategory,
      RegExp[],
    ][]) {
      if (category === 'other') continue;
      for (const pattern of patterns) {
        if (pattern.test(label)) {
          return category;
        }
      }
    }
  }

  // Try to infer from title using conventional commit format
  const title = pr.title.toLowerCase();
  if (title.startsWith('feat') || title.startsWith('feature')) return 'features';
  if (title.startsWith('fix') || title.startsWith('bug')) return 'fixes';
  if (title.startsWith('docs') || title.startsWith('doc:')) return 'docs';
  if (
    title.startsWith('chore') ||
    title.startsWith('ci') ||
    title.startsWith('build') ||
    title.startsWith('refactor')
  )
    return 'chores';
  if (title.startsWith('breaking') || title.includes('breaking change')) return 'breaking';

  return 'other';
}

/**
 * Check if a PR should be excluded from the changelog
 */
export function shouldExcludePR(pr: ChangelogPR): boolean {
  for (const label of pr.labels) {
    for (const pattern of EXCLUDE_LABELS) {
      if (pattern.test(label)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Categorize all PRs into groups
 */
export function categorizePRs(prs: ChangelogPR[]): CategorizedEntries {
  const entries: CategorizedEntries = {
    breaking: [],
    features: [],
    fixes: [],
    docs: [],
    chores: [],
    other: [],
  };

  for (const pr of prs) {
    if (shouldExcludePR(pr)) {
      continue;
    }

    const category = categorizePR(pr);
    entries[category].push(pr);
  }

  return entries;
}

/**
 * Format a single PR entry
 */
export function formatPREntry(pr: ChangelogPR, repoOwner: string, repoName: string): string {
  const prLink = `[#${pr.number}](https://github.com/${repoOwner}/${repoName}/pull/${pr.number})`;
  const author = pr.author ? ` by @${pr.author}` : '';
  return `- ${pr.title} (${prLink})${author}`;
}

/**
 * Format a category section
 */
export function formatCategorySection(
  category: ChangelogCategory,
  prs: ChangelogPR[],
  repoOwner: string,
  repoName: string
): string {
  if (prs.length === 0) return '';

  const { title } = CATEGORY_CONFIG[category];
  const entries = prs.map((pr) => formatPREntry(pr, repoOwner, repoName)).join('\n');

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

  const sections: string[] = [];

  // Add each non-empty category
  const categoryOrder: ChangelogCategory[] = [
    'breaking',
    'features',
    'fixes',
    'docs',
    'chores',
    'other',
  ];

  for (const category of categoryOrder) {
    const section = formatCategorySection(category, categorized[category], repoOwner, repoName);
    if (section) {
      sections.push(section);
    }
  }

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
  if (versionHeaderMatch && versionHeaderMatch.index !== undefined) {
    return versionHeaderMatch.index;
  }

  // Look for any ## header
  const headerMatch = content.match(/^## /m);
  if (headerMatch && headerMatch.index !== undefined) {
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
