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
  const hasWebGPU = 'gpu' in navigator;
  const hasWASM = typeof WebAssembly !== 'undefined';
  const hasChromeAI = typeof window !== 'undefined' &&
                      'ai' in window &&
                      'languageModel' in (window as any).ai;
  
  // Estimate memory (if available)
  let estimatedMemory: number | undefined;
  if ('deviceMemory' in navigator) {
    estimatedMemory = (navigator as any).deviceMemory * 1024; // GB to MB
  }
  
  // Consider low-end if:
  // - No WebGPU
  // - Low memory (< 4GB)
  // - Mobile device
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent);
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
export async function selectBestDevice(): Promise<'webgpu' | 'wasm' | 'cpu'> {
  const caps = await detectCapabilities();
  
  if (caps.hasWebGPU && !caps.isLowEnd) {
    return 'webgpu';
  }
  
  if (caps.hasWASM) {
    return 'wasm';
  }
  
  return 'cpu';
}

/**
 * Log device information
 */
export async function logDeviceInfo(): Promise<void> {
  const caps = await detectCapabilities();
  
  console.log('🖥️ Device Capabilities:');
  console.log('  WebGPU:', caps.hasWebGPU ? '✅' : '❌');
  console.log('  WebAssembly:', caps.hasWASM ? '✅' : '❌');
  console.log('  Chrome AI:', caps.hasChromeAI ? '✅' : '❌');
  
  if (caps.estimatedMemory) {
    console.log(`  Memory: ~${(caps.estimatedMemory / 1024).toFixed(1)}GB`);
  }
  
  console.log('  Profile:', caps.isLowEnd ? '📱 Low-end/Mobile' : '💻 High-end/Desktop');
}
