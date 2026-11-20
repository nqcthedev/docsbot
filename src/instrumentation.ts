/**
 * Runs once per server process. The Node-only worker lives in instrumentation-node.ts so it is
 * never bundled for the edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
