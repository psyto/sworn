import { getAddress, isAddress, type Address } from "viem";
import { api } from "../api.ts";
import { readOwnerFeed, type Notice } from "../chain/feed.ts";
import { money } from "../chain/format.ts";
import { AddrLink, ErrorBox, TopBar, TxLink, useChain, useRead } from "../ui/common.tsx";

/** Agent address: ?agent=0x… , else the demo backend's agent, else VITE_AGENT_ADDRESS. */
async function resolveAgent(): Promise<{ agent: Address; token: Address }> {
  const q = new URLSearchParams(location.search).get("agent");
  const envAgent = import.meta.env.VITE_AGENT_ADDRESS as string | undefined;
  const envToken = (import.meta.env.VITE_TOKEN as string | undefined) ?? "0x20C0000000000000000000000000000000000000";
  if (q && isAddress(q)) return { agent: getAddress(q), token: getAddress(envToken) };
  try {
    const c = await api.config();
    if (c.agent) return { agent: c.agent, token: c.token };
  } catch {
    /* fall through to env */
  }
  if (envAgent && isAddress(envAgent)) return { agent: getAddress(envAgent), token: getAddress(envToken) };
  throw new Error("No agent address: open /phone?agent=0x… or run the demo backend");
}

export function PhonePage() {
  const { client, cfg } = useChain();
  const who = useRead(resolveAgent, []);
  const feed = useRead(
    who.status === "ok" ? () => readOwnerFeed(client, cfg, who.value.agent, who.value.token) : null,
    [client, cfg, who.status === "ok" ? who.value.agent : null],
    10000, // the feed reads incrementally (feed.ts); 10 s keeps the public RPC under its rate limit
  );
  return (
    <>
      <TopBar page="phone" />
      <div className="phone-wrap">
        <div className="phone" data-testid="phone">
          <div className="phone-top">
            <span className="sub">Owner · notifications</span>
            <h1>Treasury agent</h1>
            {who.status === "ok" ? (
              <span className="sub">
                <AddrLink address={who.value.agent} />
              </span>
            ) : null}
          </div>
          {who.status === "error" ? (
            <div style={{ padding: 12 }}>
              <ErrorBox error={who.error} title="Which agent?" />
            </div>
          ) : null}
          {feed.status === "error" ? (
            <div style={{ padding: 12 }}>
              <ErrorBox error={feed.error} />
            </div>
          ) : null}
          {feed.status === "loading" ? <p className="loading" style={{ padding: "0 16px" }}>Reading events…</p> : null}
          {feed.status === "ok" ? (
            <>
              {feed.value.notices.length === 0 ? (
                <p className="sub" style={{ padding: "12px 16px" }}>
                  Nothing yet in blocks {feed.value.from.toString()}–{feed.value.head.toString()}.
                </p>
              ) : null}
              <ul className="notices">
                {feed.value.notices.map((n) => (
                  <NoticeItem key={`${n.txHash}-${n.logIndex}`} n={n} decimals={feed.value.decimals[n.token] ?? 6} />
                ))}
              </ul>
              <p className="sub" style={{ padding: "0 16px 16px", marginTop: "auto" }}>
                Read from chain: blocks {feed.value.from.toString()}–{feed.value.head.toString()}.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

function when(ts?: bigint) {
  if (ts === undefined) return "";
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function NoticeItem({ n, decimals }: { n: Notice; decimals: number }) {
  const amt = <b className="num">{money(n.amount, decimals)}</b>;
  const title = { reserved: "Answer reserved", diverted: "Payment diverted", compensated: "Compensated" }[n.kind];
  return (
    <li className={`notice ${n.kind}`} data-kind={n.kind}>
      <span className="title">
        {title}
        <time>{when(n.timestamp)}</time>
      </span>
      {n.kind === "reserved" ? (
        <p>
          A server locked {amt} of its bond behind its answer about block {n.aboutBlock?.toString()}.
        </p>
      ) : null}
      {n.kind === "diverted" ? <p>{amt} went to ReceivePolicyGuard, not to the receiver: its receive policy blocks this sender.</p> : null}
      {n.kind === "compensated" ? <p>A preflight answer was wrong. You were paid {amt} from the server's bond.</p> : null}
      <span className="sub">
        block {n.blockNumber.toString()} · <TxLink hash={n.txHash}>explorer</TxLink>
      </span>
    </li>
  );
}
