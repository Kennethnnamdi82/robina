// No production entry imports this file. The explicit flag and DEV are both required.
if (import.meta.env.DEV && import.meta.env.VITE_RIVALS_3D_SANDBOX === 'true') {
  void Promise.all([import('react-dom/client'),import('../../src/features/rivals/three/SandboxApp')]).then(([{ createRoot },{ default: SandboxApp }]) => createRoot(document.getElementById('root')!).render(<SandboxApp/>)).catch(error => {
    document.getElementById('root')!.textContent = `RIVALS could not load. Reload this page. ${error instanceof Error ? error.message : String(error)}`;
  });
} else document.getElementById('root')!.textContent = 'RIVALS 3D development sandbox is disabled.';
