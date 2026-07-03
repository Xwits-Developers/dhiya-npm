/**
 * Test setup and global mocks
 */

import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
};
