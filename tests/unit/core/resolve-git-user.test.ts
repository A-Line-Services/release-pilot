/**
 * Tests for resolveGitUser
 *
 * Verifies the priority chain:
 * 1. Explicit inputs (both name + email)
 * 2. Auto-detect from token
 * 3. Fall back to github-actions[bot]
 *
 * Also covers partial overrides (only name or only email set).
 */

import { describe, expect, test } from 'bun:test';
import { resolveGitUser } from '../../../src/main.js';

const DEFAULT_NAME = 'github-actions[bot]';
const DEFAULT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';

/** Simulates a successful GET /user response (PAT or OAuth token) */
const mockUser = (login: string, id: number) => async () => ({ login, id });

/** Simulates a failed GET /user (GitHub App installation token) */
const mockNoUser = async () => null;

/** Captures log messages */
function createLogCapture() {
  const logs: string[] = [];
  return { log: (msg: string) => logs.push(msg), logs };
}

describe('resolveGitUser', () => {
  describe('explicit inputs', () => {
    test('uses both inputs when provided', async () => {
      const { log } = createLogCapture();
      const result = await resolveGitUser(
        mockNoUser,
        { gitUserName: 'my-app[bot]', gitUserEmail: '123+my-app[bot]@users.noreply.github.com' },
        log
      );

      expect(result).toEqual({
        name: 'my-app[bot]',
        email: '123+my-app[bot]@users.noreply.github.com',
      });
    });

    test('skips auto-detect when both inputs are provided', async () => {
      let called = false;
      const getUser = async () => {
        called = true;
        return { login: 'should-not-use', id: 999 };
      };

      const { log } = createLogCapture();
      await resolveGitUser(
        getUser,
        { gitUserName: 'custom-name', gitUserEmail: 'custom@example.com' },
        log
      );

      expect(called).toBe(false);
    });
  });

  describe('auto-detect from token', () => {
    test('uses detected user when no inputs provided', async () => {
      const { log } = createLogCapture();
      const result = await resolveGitUser(mockUser('octocat', 583231), {}, log);

      expect(result).toEqual({
        name: 'octocat',
        email: '583231+octocat@users.noreply.github.com',
      });
    });

    test('logs detected user name', async () => {
      const { log, logs } = createLogCapture();
      await resolveGitUser(mockUser('octocat', 583231), {}, log);

      expect(logs.some((msg) => msg.includes('Auto-detected') && msg.includes('octocat'))).toBe(
        true
      );
    });
  });

  describe('fallback to default', () => {
    test('falls back to github-actions[bot] when detection fails and no inputs', async () => {
      const { log } = createLogCapture();
      const result = await resolveGitUser(mockNoUser, {}, log);

      expect(result).toEqual({
        name: DEFAULT_NAME,
        email: DEFAULT_EMAIL,
      });
    });

    test('logs fallback message with instructions', async () => {
      const { log, logs } = createLogCapture();
      await resolveGitUser(mockNoUser, {}, log);

      expect(
        logs.some((msg) => msg.includes('git-user-name') && msg.includes('git-user-email'))
      ).toBe(true);
    });
  });

  describe('partial inputs', () => {
    test('uses explicit name with auto-detected email', async () => {
      const { log } = createLogCapture();
      const result = await resolveGitUser(
        mockUser('octocat', 583231),
        { gitUserName: 'custom-name' },
        log
      );

      expect(result).toEqual({
        name: 'custom-name',
        email: '583231+octocat@users.noreply.github.com',
      });
    });

    test('uses explicit email with auto-detected name', async () => {
      const { log } = createLogCapture();
      const result = await resolveGitUser(
        mockUser('octocat', 583231),
        { gitUserEmail: 'custom@example.com' },
        log
      );

      expect(result).toEqual({
        name: 'octocat',
        email: 'custom@example.com',
      });
    });

    test('logs only defaulted fields when detection fails with partial input', async () => {
      const { log, logs } = createLogCapture();
      await resolveGitUser(mockNoUser, { gitUserEmail: 'custom@example.com' }, log);

      // Should mention defaulting "name" but not "email" since email was provided
      const fallbackMsg = logs.find((msg) => msg.includes('default'));
      expect(fallbackMsg).toBeDefined();
      expect(fallbackMsg).toContain('name');
      expect(fallbackMsg).not.toContain('and email');
    });

    test('does not log fallback when detection fails but both inputs are set', async () => {
      const { log, logs } = createLogCapture();
      await resolveGitUser(
        mockNoUser,
        { gitUserName: 'custom', gitUserEmail: 'custom@example.com' },
        log
      );

      expect(logs.some((msg) => msg.includes('default'))).toBe(false);
    });

    test('uses explicit name with default email when detection fails', async () => {
      const { log } = createLogCapture();
      const result = await resolveGitUser(mockNoUser, { gitUserName: 'custom-name' }, log);

      expect(result).toEqual({
        name: 'custom-name',
        email: DEFAULT_EMAIL,
      });
    });

    test('uses explicit email with default name when detection fails', async () => {
      const { log } = createLogCapture();
      const result = await resolveGitUser(mockNoUser, { gitUserEmail: 'custom@example.com' }, log);

      expect(result).toEqual({
        name: DEFAULT_NAME,
        email: 'custom@example.com',
      });
    });
  });
});
