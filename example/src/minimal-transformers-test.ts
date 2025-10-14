// Minimal reproduction script
console.log('Loading @xenova/transformers...');
import('@xenova/transformers')
  .then(({ env }) => {
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    console.log('Transformers imported OK. env keys:', Object.keys(env));
  })
  .catch(err => {
    console.error('Import failed:', err);
  });
