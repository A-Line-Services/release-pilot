/**
 * Tests for ecosystem base interface and registry
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  EcosystemRegistry,
  BaseFileEcosystem,
  type Ecosystem,
  type EcosystemContext,
} from '../../../src/ecosystems/base.js';

const TEST_DIR = join(import.meta.dir, '../../fixtures/base-test');

function createContext(path: string, options: Partial<EcosystemContext> = {}): EcosystemContext {
  return {
    path,
    dryRun: false,
    log: () => {},
    ...options,
  };
}

// Mock ecosystem for testing
class MockEcosystem implements Ecosystem {
  readonly name = 'mock';

  async detect(path: string): Promise<boolean> {
    return path.includes('mock-project');
  }

  async readVersion(_ctx: EcosystemContext): Promise<string> {
    return '1.0.0';
  }

  async writeVersion(_ctx: EcosystemContext, _version: string): Promise<void> {
    // Mock implementation
  }

  async getVersionFiles(_ctx: EcosystemContext): Promise<string[]> {
    return ['mock.json'];
  }

  async publish(_ctx: EcosystemContext): Promise<void> {
    // Mock implementation
  }
}

class AnotherMockEcosystem implements Ecosystem {
  readonly name = 'another';

  async detect(path: string): Promise<boolean> {
    return path.includes('another-project');
  }

  async readVersion(_ctx: EcosystemContext): Promise<string> {
    return '2.0.0';
  }

  async writeVersion(_ctx: EcosystemContext, _version: string): Promise<void> {
    // Mock implementation
  }

  async getVersionFiles(_ctx: EcosystemContext): Promise<string[]> {
    return ['another.json'];
  }
}

// Concrete implementation of BaseFileEcosystem for testing
class TestFileEcosystem extends BaseFileEcosystem {
  readonly name = 'test-file';

  constructor() {
    super({
      manifestFile: 'test.json',
      lockFiles: ['test.lock'],
    });
  }

  protected parseVersion(content: string): string | null {
    const data = JSON.parse(content);
    return data.version ?? null;
  }

  protected updateVersion(content: string, version: string): string {
    const data = JSON.parse(content);
    data.version = version;
    return JSON.stringify(data, null, 2) + '\n';
  }
}

describe('EcosystemRegistry', () => {
  test('registers and retrieves ecosystems', () => {
    const registry = new EcosystemRegistry();
    const mock = new MockEcosystem();

    registry.register(mock);

    expect(registry.get('mock')).toBe(mock);
  });

  test('returns undefined for unknown ecosystem', () => {
    const registry = new EcosystemRegistry();

    expect(registry.get('unknown')).toBeUndefined();
  });

  test('lists all registered ecosystems', () => {
    const registry = new EcosystemRegistry();
    registry.register(new MockEcosystem());
    registry.register(new AnotherMockEcosystem());

    const names = registry.list();

    expect(names).toContain('mock');
    expect(names).toContain('another');
    expect(names).toHaveLength(2);
  });

  test('detects ecosystem for path', async () => {
    const registry = new EcosystemRegistry();
    registry.register(new MockEcosystem());
    registry.register(new AnotherMockEcosystem());

    const detected = await registry.detect('/path/to/mock-project');

    expect(detected?.name).toBe('mock');
  });

  test('returns null when no ecosystem matches', async () => {
    const registry = new EcosystemRegistry();
    registry.register(new MockEcosystem());

    const detected = await registry.detect('/path/to/unknown-project');

    expect(detected).toBeNull();
  });

  test('overwrites existing ecosystem with same name', () => {
    const registry = new EcosystemRegistry();
    const first = new MockEcosystem();
    const second = new MockEcosystem();

    registry.register(first);
    registry.register(second);

    expect(registry.get('mock')).toBe(second);
    expect(registry.list()).toHaveLength(1);
  });
});

describe('Ecosystem interface', () => {
  test('ecosystem has required properties', () => {
    const ecosystem = new MockEcosystem();

    expect(ecosystem.name).toBe('mock');
    expect(typeof ecosystem.detect).toBe('function');
    expect(typeof ecosystem.readVersion).toBe('function');
    expect(typeof ecosystem.writeVersion).toBe('function');
    expect(typeof ecosystem.getVersionFiles).toBe('function');
  });

  test('ecosystem can have optional publish method', () => {
    const ecosystem = new MockEcosystem();

    expect(typeof ecosystem.publish).toBe('function');
  });

  test('ecosystem without publish method is valid', () => {
    const ecosystem = new AnotherMockEcosystem();

    expect(ecosystem.publish).toBeUndefined();
  });
});

describe('BaseFileEcosystem', () => {
  const ecosystem = new TestFileEcosystem();

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('detect', () => {
    test('detects manifest file', async () => {
      const projectDir = join(TEST_DIR, 'detect-test');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'test.json'), '{}');

      expect(await ecosystem.detect(projectDir)).toBe(true);
    });

    test('returns false when manifest is missing', async () => {
      const emptyDir = join(TEST_DIR, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      expect(await ecosystem.detect(emptyDir)).toBe(false);
    });

    test('returns false for non-existent directory', async () => {
      expect(await ecosystem.detect('/non/existent/path')).toBe(false);
    });
  });

  describe('readVersion', () => {
    test('reads version from manifest', async () => {
      const projectDir = join(TEST_DIR, 'read-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'test.json'),
        JSON.stringify({ name: 'test', version: '1.2.3' })
      );

      const version = await ecosystem.readVersion(createContext(projectDir));

      expect(version).toBe('1.2.3');
    });

    test('throws when version is missing', async () => {
      const projectDir = join(TEST_DIR, 'no-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'test.json'), JSON.stringify({ name: 'test' }));

      await expect(ecosystem.readVersion(createContext(projectDir))).rejects.toThrow();
    });

    test('throws when manifest is missing', async () => {
      const emptyDir = join(TEST_DIR, 'no-manifest');
      mkdirSync(emptyDir, { recursive: true });

      await expect(ecosystem.readVersion(createContext(emptyDir))).rejects.toThrow();
    });

    test('uses custom versionFile', async () => {
      const projectDir = join(TEST_DIR, 'custom-file');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'custom.json'),
        JSON.stringify({ name: 'test', version: '2.0.0' })
      );

      const version = await ecosystem.readVersion(
        createContext(projectDir, { versionFile: 'custom.json' })
      );

      expect(version).toBe('2.0.0');
    });
  });

  describe('writeVersion', () => {
    test('writes version to manifest', async () => {
      const projectDir = join(TEST_DIR, 'write-version');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'test.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2)
      );

      await ecosystem.writeVersion(createContext(projectDir), '2.0.0');

      const content = JSON.parse(readFileSync(join(projectDir, 'test.json'), 'utf-8'));
      expect(content.version).toBe('2.0.0');
    });

    test('preserves other fields', async () => {
      const projectDir = join(TEST_DIR, 'preserve-fields');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'test.json'),
        JSON.stringify({ name: 'test', version: '1.0.0', description: 'A test' }, null, 2)
      );

      await ecosystem.writeVersion(createContext(projectDir), '1.1.0');

      const content = JSON.parse(readFileSync(join(projectDir, 'test.json'), 'utf-8'));
      expect(content.version).toBe('1.1.0');
      expect(content.name).toBe('test');
      expect(content.description).toBe('A test');
    });

    test('skips write in dry run mode', async () => {
      const projectDir = join(TEST_DIR, 'dry-run');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'test.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' })
      );

      await ecosystem.writeVersion(createContext(projectDir, { dryRun: true }), '2.0.0');

      const content = JSON.parse(readFileSync(join(projectDir, 'test.json'), 'utf-8'));
      expect(content.version).toBe('1.0.0'); // Not changed
    });

    test('logs message in dry run mode', async () => {
      const projectDir = join(TEST_DIR, 'dry-run-log');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'test.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' })
      );

      const logs: string[] = [];
      await ecosystem.writeVersion(
        createContext(projectDir, { dryRun: true, log: (msg) => logs.push(msg) }),
        '2.0.0'
      );

      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain('[dry-run]');
      expect(logs[0]).toContain('2.0.0');
    });
  });

  describe('getVersionFiles', () => {
    test('returns manifest file', async () => {
      const projectDir = join(TEST_DIR, 'version-files');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'test.json'), '{}');

      const files = await ecosystem.getVersionFiles(createContext(projectDir));

      expect(files).toContain('test.json');
    });

    test('includes lockfile if exists', async () => {
      const projectDir = join(TEST_DIR, 'with-lock');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'test.json'), '{}');
      writeFileSync(join(projectDir, 'test.lock'), '');

      const files = await ecosystem.getVersionFiles(createContext(projectDir));

      expect(files).toContain('test.json');
      expect(files).toContain('test.lock');
    });

    test('does not include lockfile if missing', async () => {
      const projectDir = join(TEST_DIR, 'no-lock');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'test.json'), '{}');

      const files = await ecosystem.getVersionFiles(createContext(projectDir));

      expect(files).toContain('test.json');
      expect(files).not.toContain('test.lock');
    });
  });
});
