/**
 * Test Fixture Utilities
 *
 * Provides helpers for managing temporary directories in tests.
 *
 * @module tests/helpers/fixtures
 */

import { afterAll, beforeAll } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Base directory for all test fixtures */
const FIXTURES_BASE = join(import.meta.dir, '../fixtures');

/**
 * Create a temporary test directory path
 *
 * @param name - Unique name for the test directory
 * @returns Full path to the test directory
 */
export function getFixturePath(name: string): string {
  return join(FIXTURES_BASE, name);
}

/**
 * Setup and teardown a temporary test directory
 *
 * Call this at the top level of a describe block to automatically
 * create the directory before tests and clean it up after.
 *
 * @param name - Unique name for the test directory
 * @returns Full path to the test directory
 *
 * @example
 * describe('MyTest', () => {
 *   const TEST_DIR = useTestDir('my-test');
 *
 *   test('creates files', () => {
 *     writeFileSync(join(TEST_DIR, 'file.txt'), 'content');
 *   });
 * });
 */
export function useTestDir(name: string): string {
  const dir = getFixturePath(name);

  beforeAll(() => {
    mkdirSync(dir, { recursive: true });
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  return dir;
}

/**
 * Manually manage a test directory (for more control)
 *
 * @example
 * const fixture = new TestDir('my-test');
 * fixture.setup();
 * // ... run tests ...
 * fixture.cleanup();
 */
export class TestDir {
  readonly path: string;

  constructor(name: string) {
    this.path = getFixturePath(name);
  }

  /** Create the directory */
  setup(): void {
    mkdirSync(this.path, { recursive: true });
  }

  /** Remove the directory and all contents */
  cleanup(): void {
    rmSync(this.path, { recursive: true, force: true });
  }

  /** Join path segments to this directory */
  join(...parts: string[]): string {
    return join(this.path, ...parts);
  }

  /** Create a subdirectory */
  mkdir(name: string): string {
    const subdir = this.join(name);
    mkdirSync(subdir, { recursive: true });
    return subdir;
  }
}
