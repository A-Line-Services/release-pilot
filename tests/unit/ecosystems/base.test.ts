/**
 * Tests for ecosystem base interface and registry
 */

import { describe, test, expect } from 'bun:test';
import {
  EcosystemRegistry,
  type Ecosystem,
  type EcosystemContext,
} from '../../../src/ecosystems/base.js';

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
