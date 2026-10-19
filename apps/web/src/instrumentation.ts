/**
 * Starts the Node Web memory sampler once per server process.
 * Edge runtime does not sample. No request data is recorded.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { shouldStartWebMemorySampler, startWebMemorySampler } = await import(
    "./lib/system-health/web-memory-sampler"
  );
  if (!shouldStartWebMemorySampler(process.env.NEXT_RUNTIME)) {
    return;
  }
  startWebMemorySampler();
}
