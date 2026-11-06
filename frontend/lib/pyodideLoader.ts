/**
 * Pyodide In-Browser Python Runtime Loader
 *
 * Dynamically loads the Pyodide WebAssembly runtime from CDN on-demand
 * when a user executes Python code, caching the initialized instance for subsequent runs.
 */

let pyodideInstance: any = null;
let pyodideLoadingPromise: Promise<any> | null = null;

export async function getPyodide(
  onProgress?: (message: string) => void
): Promise<any> {
  if (typeof window === 'undefined') return null;

  // Return cached instance if already initialized
  if (pyodideInstance) {
    return pyodideInstance;
  }

  const win = window as any;
  if (win.__pyodide_instance) {
    pyodideInstance = win.__pyodide_instance;
    return pyodideInstance;
  }

  // If already in-flight, await the existing loading promise
  if (pyodideLoadingPromise) {
    return pyodideLoadingPromise;
  }

  pyodideLoadingPromise = (async () => {
    try {
      // 1. Inject Pyodide bootstrap script if not already present in DOM
      if (!win.loadPyodide) {
        onProgress?.('Loading Python WebAssembly engine from CDN...');

        await new Promise<void>((resolve, reject) => {
          const scriptId = 'pyodide-cdn-script';
          const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

          if (existingScript) {
            if (win.loadPyodide) {
              resolve();
            } else {
              existingScript.addEventListener('load', () => resolve());
              existingScript.addEventListener('error', () =>
                reject(new Error('Failed to load Pyodide script from CDN'))
              );
            }
            return;
          }

          const script = document.createElement('script');
          script.id = scriptId;
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () =>
            reject(
              new Error(
                'Could not download Pyodide Python engine. Please check your internet connection.'
              )
            );
          document.head.appendChild(script);
        });
      }

      // 2. Initialize the Pyodide environment
      onProgress?.('Initializing Python runtime in browser...');
      const loaded = await win.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
      });

      pyodideInstance = loaded;
      win.__pyodide_instance = loaded;
      return loaded;
    } catch (err: any) {
      pyodideLoadingPromise = null;
      throw err;
    }
  })();

  return pyodideLoadingPromise;
}

