/**
 * Device detection and capabilities
 */

export type DeviceCapabilities = {
  hasWebGPU: boolean;
  hasWASM: boolean;
  hasChromeAI: boolean;
  estimatedMemory?: number; // MB
  isLowEnd: boolean;
};

/**
 * Detect available device capabilities
 */
export async function detectCapabilities(): Promise<DeviceCapabilities> {
  const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
  const hasWebGPU = !!nav && 'gpu' in nav;
  const hasWASM = typeof WebAssembly !== 'undefined';
  // Chrome's built-in Prompt API ships as a global `LanguageModel` object
  const hasChromeAI = typeof (globalThis as any).LanguageModel !== 'undefined';

  // Estimate memory (if available)
  let estimatedMemory: number | undefined;
  if (nav && 'deviceMemory' in nav) {
    estimatedMemory = nav.deviceMemory * 1024; // GB to MB
  }

  const isMobile = !!nav && /mobile|android|iphone|ipad|ipod/i.test(nav.userAgent || '');
  const isLowEnd = !hasWebGPU ||
                   (estimatedMemory !== undefined && estimatedMemory < 4096) ||
                   isMobile;

  return {
    hasWebGPU,
    hasWASM,
    hasChromeAI,
    estimatedMemory,
    isLowEnd
  };
}

/**
 * Select best available device for embeddings
 */
export async function selectBestDevice(): Promise<'webgpu' | 'wasm'> {
  const caps = await detectCapabilities();

  if (caps.hasWebGPU && !caps.isLowEnd) {
    return 'webgpu';
  }

  return 'wasm';
}

/**
 * Log device information
 */
export async function logDeviceInfo(): Promise<void> {
  const caps = await detectCapabilities();

  console.log('Device capabilities:');
  console.log('  WebGPU:', caps.hasWebGPU ? 'yes' : 'no');
  console.log('  WebAssembly:', caps.hasWASM ? 'yes' : 'no');
  console.log('  Chrome built-in AI:', caps.hasChromeAI ? 'yes' : 'no');

  if (caps.estimatedMemory) {
    console.log(`  Memory: ~${(caps.estimatedMemory / 1024).toFixed(1)}GB`);
  }

  console.log('  Profile:', caps.isLowEnd ? 'low-end/mobile' : 'desktop');
}
