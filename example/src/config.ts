/**
 * Environment configuration for Transformers.js
 * Keep this lean: importing onnxruntime-web directly caused backend errors.
 */

// NOTE: Do NOT import 'onnxruntime-web' directly. Transformers.js manages
// the underlying ONNX/WASM backends internally. A direct import led to
// "registerBackend" undefined due to duplicate initialization.

export async function configureTransformers() {
  try {
    const { env } = await import('@xenova/transformers');

    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = true;

    // Quiet runtime if accessible
    try {
      const backends: any = (env as any).backends;
      if (backends?.onnx) backends.onnx.logLevel = 'error';
    } catch { /* noop */ }

    console.log('✅ Transformers.js environment configured');
    return true;
  } catch (error) {
    console.error('❌ Failed to configure Transformers.js:', error);
    throw error;
  }
}
