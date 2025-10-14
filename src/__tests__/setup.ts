/**
 * Test setup and global mocks
 */

import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// fake-indexeddb/auto automatically sets up IndexedDB globals

// Mock Chrome AI API
(globalThis as any).ai = {
  canCreateTextSession: vi.fn(async () => 'readily'),
  createTextSession: vi.fn(async () => ({
    prompt: vi.fn(async (text: string) => `Mocked response to: ${text}`),
    destroy: vi.fn()
  }))
};

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
};
