import type { Registry } from "../lib/registry.js";
import { UnifiedMcpProxy } from "../lib/proxy.js";

export async function serveCommand(
  registry: Registry,
  opts: { http?: boolean; host?: string; port?: number } = {},
): Promise<void> {
  const proxy = new UnifiedMcpProxy(registry);
  let closing = false;
  const close = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    await proxy.close();
  };
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
  if (opts.http) {
    await proxy.serveHttp(opts.host ?? "127.0.0.1", opts.port ?? 3737);
  } else {
    await proxy.serve();
  }
}
