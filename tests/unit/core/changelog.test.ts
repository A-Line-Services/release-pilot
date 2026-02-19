/**
 * Tests for changelog generation
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  categorizePR,
  categorizePRs,
  createInitialChangelog,
  findInsertPosition,
  formatCategorySection,
  formatPREntry,
  generateChangelogContent,
  shouldExcludePR,
  updateChangelog,
} from '../../../src/core/changelog.js';
import { createChangelogOptions, createChangelogPR, useTestDir } from '../../helpers/index.js';

describe('changelog', () => {
  const TEST_DIR = useTestDir('changelog-test');

  describe('categorizePR', () => {
    test('categorizes feature by label', () => {
      const pr = createChangelogPR({ title: 'Some change', labels: ['feature'] });
      expect(categorizePR(pr)).toBe('features');
    });

    test('categorizes fix by label', () => {
      const pr = createChangelogPR({ title: 'Some change', labels: ['bug', 'priority-high'] });
      expect(categorizePR(pr)).toBe('fixes');
    });

    test('categorizes breaking change by label', () => {
      const pr = createChangelogPR({ title: 'Some change', labels: ['breaking'] });
      expect(categorizePR(pr)).toBe('breaking');
    });

    test('categorizes docs by label', () => {
      const pr = createChangelogPR({ title: 'Some change', labels: ['documentation'] });
      expect(categorizePR(pr)).toBe('docs');
    });

    test('categorizes chores by label', () => {
      const pr = createChangelogPR({ title: 'Some change', labels: ['chore'] });
      expect(categorizePR(pr)).toBe('chores');
    });

    test('categorizes by title when no matching labels', () => {
      const pr = createChangelogPR({ title: 'feat: add new feature', labels: [] });
      expect(categorizePR(pr)).toBe('features');
    });

    test('categorizes fix by title', () => {
      const pr = createChangelogPR({ title: 'fix: resolve issue', labels: [] });
      expect(categorizePR(pr)).toBe('fixes');
    });

    test('categorizes docs by title', () => {
      const pr = createChangelogPR({ title: 'docs: update readme', labels: [] });
      expect(categorizePR(pr)).toBe('docs');
    });

    test('categorizes chore by title', () => {
      const pr = createChangelogPR({ title: 'chore: update deps', labels: [] });
      expect(categorizePR(pr)).toBe('chores');
    });

    test('categorizes breaking by title with ! indicator', () => {
      const pr = createChangelogPR({ title: 'feat!: remove deprecated API', labels: [] });
      expect(categorizePR(pr)).toBe('breaking');
    });

    test('categorizes breaking by title with scoped ! indicator', () => {
      const pr = createChangelogPR({ title: 'feat(api)!: remove deprecated endpoint', labels: [] });
      expect(categorizePR(pr)).toBe('breaking');
    });

    test('categorizes breaking by title with fix! indicator', () => {
      const pr = createChangelogPR({ title: 'fix!: change return type', labels: [] });
      expect(categorizePR(pr)).toBe('breaking');
    });

    test('defaults to other for unknown', () => {
      const pr = createChangelogPR({ title: 'Random change', labels: ['random-label'] });
      expect(categorizePR(pr)).toBe('other');
    });
  });

  describe('shouldExcludePR', () => {
    test('excludes PR with skip-changelog label', () => {
      const pr = createChangelogPR({ labels: ['skip-changelog'] });
      expect(shouldExcludePR(pr)).toBe(true);
    });

    test('excludes PR with no-changelog label', () => {
      const pr = createChangelogPR({ labels: ['no-changelog'] });
      expect(shouldExcludePR(pr)).toBe(true);
    });

    test('does not exclude PR with release labels', () => {
      const pr = createChangelogPR({ labels: ['release:patch'] });
      expect(shouldExcludePR(pr)).toBe(false);
    });

    test('does not exclude regular PRs', () => {
      const pr = createChangelogPR({ labels: ['feature', 'enhancement'] });
      expect(shouldExcludePR(pr)).toBe(false);
    });
  });

  describe('categorizePRs', () => {
    test('categorizes multiple PRs', () => {
      const prs = [
        createChangelogPR({ number: 1, title: 'feat: new feature', labels: ['feature'] }),
        createChangelogPR({ number: 2, title: 'fix: bug fix', labels: ['bug'] }),
        createChangelogPR({ number: 3, title: 'docs: update docs', labels: ['documentation'] }),
        createChangelogPR({ number: 4, title: 'chore: update deps', labels: ['chore'] }),
        createChangelogPR({ number: 5, title: 'Random thing', labels: [] }),
      ];

      const categorized = categorizePRs(prs);

      expect(categorized.features).toHaveLength(1);
      expect(categorized.fixes).toHaveLength(1);
      expect(categorized.docs).toHaveLength(1);
      expect(categorized.chores).toHaveLength(1);
      expect(categorized.other).toHaveLength(1);
      expect(categorized.breaking).toHaveLength(0);
    });

    test('excludes PRs with skip labels', () => {
      const prs = [
        createChangelogPR({ number: 1, title: 'feat: new feature', labels: ['feature'] }),
        createChangelogPR({ number: 2, title: 'Skip this', labels: ['skip-changelog'] }),
      ];

      const categorized = categorizePRs(prs);

      expect(categorized.features).toHaveLength(1);
      expect(categorized.other).toHaveLength(0);
    });
  });

  describe('formatPREntry', () => {
    test('formats PR with author', () => {
      const pr = createChangelogPR({ number: 42, title: 'Add new feature', author: 'johndoe' });

      const entry = formatPREntry(pr, { owner: 'owner', name: 'repo' });
      expect(entry).toBe(
        '- Add new feature ([#42](https://github.com/owner/repo/pull/42)) by @johndoe'
      );
    });

    test('formats PR without author', () => {
      const pr = createChangelogPR({ number: 42, title: 'Add new feature' });

      const entry = formatPREntry(pr, { owner: 'owner', name: 'repo' });
      expect(entry).toBe('- Add new feature ([#42](https://github.com/owner/repo/pull/42))');
    });
  });

  describe('formatCategorySection', () => {
    test('formats category with PRs', () => {
      const prs = [
        createChangelogPR({ number: 1, title: 'Feature A' }),
        createChangelogPR({ number: 2, title: 'Feature B', author: 'user' }),
      ];

      const section = formatCategorySection('features', prs, { owner: 'owner', name: 'repo' });

      expect(section).toContain('### Features');
      expect(section).toContain('- Feature A ([#1]');
      expect(section).toContain('- Feature B ([#2]');
      expect(section).toContain('by @user');
    });

    test('returns empty string for empty category', () => {
      const section = formatCategorySection('features', [], { owner: 'owner', name: 'repo' });
      expect(section).toBe('');
    });
  });

  describe('generateChangelogContent', () => {
    test('generates changelog with categorized entries', () => {
      const prs = [
        createChangelogPR({ number: 1, title: 'Add feature X', labels: ['feature'] }),
        createChangelogPR({ number: 2, title: 'Fix bug Y', labels: ['bug'] }),
      ];

      const content = generateChangelogContent(
        '1.2.0',
        prs,
        'owner',
        'repo',
        new Date('2024-01-15')
      );

      expect(content).toContain('## [1.2.0] - 2024-01-15');
      expect(content).toContain('### Features');
      expect(content).toContain('Add feature X');
      expect(content).toContain('### Bug Fixes');
      expect(content).toContain('Fix bug Y');
    });

    test('generates changelog with no entries message', () => {
      const content = generateChangelogContent(
        '1.2.0',
        [],
        'owner',
        'repo',
        new Date('2024-01-15')
      );

      expect(content).toContain('## [1.2.0] - 2024-01-15');
      expect(content).toContain('No notable changes');
    });
  });

  describe('findInsertPosition', () => {
    test('finds position before first version header', () => {
      const content = `# Changelog

## [1.0.0] - 2024-01-01

Initial release`;

      const pos = findInsertPosition(content);
      expect(content.slice(pos)).toStartWith('## [1.0.0]');
    });

    test('finds position after title when no version headers', () => {
      const content = `# Changelog

Some intro text`;

      const pos = findInsertPosition(content);
      expect(pos).toBe(13); // After "# Changelog\n\n"
    });

    test('returns 0 for empty content', () => {
      const pos = findInsertPosition('');
      expect(pos).toBe(0);
    });
  });

  describe('createInitialChangelog', () => {
    test('creates changelog with proper header', () => {
      const content = createInitialChangelog();

      expect(content).toContain('# Changelog');
      expect(content).toContain('Keep a Changelog');
      expect(content).toContain('Semantic Versioning');
    });
  });

  describe('updateChangelog', () => {
    const defaultOptions = createChangelogOptions(TEST_DIR);

    test('creates new changelog file', () => {
      const testFile = 'new-changelog.md';
      const prs = [createChangelogPR({ number: 1, title: 'Add feature', labels: ['feature'] })];

      const result = updateChangelog(
        { enabled: true, file: testFile },
        '1.0.0',
        prs,
        defaultOptions
      );

      expect(result.updated).toBe(true);
      expect(result.entriesAdded).toBe(1);

      const content = readFileSync(join(TEST_DIR, testFile), 'utf-8');
      expect(content).toContain('# Changelog');
      expect(content).toContain('## [1.0.0]');
      expect(content).toContain('Add feature');
    });

    test('updates existing changelog file', () => {
      const testFile = 'existing-changelog.md';
      writeFileSync(
        join(TEST_DIR, testFile),
        `# Changelog

## [1.0.0] - 2024-01-01

- Initial release
`
      );

      const prs = [createChangelogPR({ number: 2, title: 'New feature', labels: ['feature'] })];

      const result = updateChangelog(
        { enabled: true, file: testFile },
        '1.1.0',
        prs,
        defaultOptions
      );

      expect(result.updated).toBe(true);

      const content = readFileSync(join(TEST_DIR, testFile), 'utf-8');
      expect(content).toContain('## [1.1.0]');
      expect(content).toContain('## [1.0.0]');
      // New version should come before old version
      expect(content.indexOf('## [1.1.0]')).toBeLessThan(content.indexOf('## [1.0.0]'));
    });

    test('dry run does not create file', () => {
      const testFile = 'dry-run-changelog.md';
      const logs: string[] = [];
      const prs = [createChangelogPR({ number: 1, title: 'Add feature', labels: ['feature'] })];

      const result = updateChangelog({ enabled: true, file: testFile }, '1.0.0', prs, {
        ...defaultOptions,
        dryRun: true,
        log: (msg) => logs.push(msg),
      });

      expect(result.updated).toBe(true);
      expect(logs.some((l) => l.includes('[dry-run]'))).toBe(true);

      // File should not exist
      expect(() => readFileSync(join(TEST_DIR, testFile), 'utf-8')).toThrow();
    });

    test('counts non-excluded entries', () => {
      const prs = [
        createChangelogPR({ number: 1, title: 'Add feature', labels: ['feature'] }),
        createChangelogPR({ number: 2, title: 'Skip this', labels: ['skip-changelog'] }),
        createChangelogPR({ number: 3, title: 'Another feature', labels: ['enhancement'] }),
      ];

      const result = updateChangelog(
        { enabled: true, file: 'count-test.md' },
        '1.0.0',
        prs,
        defaultOptions
      );

      expect(result.entriesAdded).toBe(2); // Only 2 non-excluded entries
    });
  });
});
