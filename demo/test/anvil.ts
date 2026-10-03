// Starts `anvil --network tempo` (TIP-20 precompiles live) on a free port. Transactions are sent
// with eth_sendTransaction from anvil's own unlocked dev accounts — no key appears in any file.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";

export const anvilAvailable = spawnSync("anvil", ["--version"]).status === 0;

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });
}

export async function startAnvil(): Promise<{ url: string; stop: () => void }> {
  const port = await freePort();
  const proc: ChildProcess = spawn("anvil", ["--network", "tempo", "--chain-id", "42431", "--port", String(port), "--silent"], {
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (r.ok) return { url, stop: () => proc.kill() };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill();
  throw new Error("anvil did not start");
}
