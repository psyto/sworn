import type { Loadable } from "../chain/loadable.ts";
import type { ProofPins } from "../chain/timeline.ts";
import { AddrLink, ErrorBox } from "./common.tsx";

export interface PipeNode {
  title: string;
  sub: string[];
  /** Heavy edge: this box is on Tempo. */
  tempo?: boolean;
}

interface PipeProps {
  id: string;
  nodes: PipeNode[];
  label: string;
  /** If set, a dashed arrow from the last box back to the first, with this note. */
  back?: { wide: string; tall: string };
}

function Wide({ id, nodes, label, back }: PipeProps) {
  const n = nodes.length;
  const W = n >= 5 ? 178 : 214;
  const H = 104;
  const step = (1000 - W) / (n - 1);
  const y = 24;
  const height = back ? 220 : y + H + 20;
  return (
    <svg className="diagram wide" viewBox={`0 0 1000 ${height}`} role="img" aria-labelledby={`${id}-w`}>
      <title id={`${id}-w`}>{label}</title>
      <defs>
        <marker id={`${id}-ahw`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path className="arrowhead" d="M0,0 L10,5 L0,10 z" />
        </marker>
      </defs>
      {nodes.slice(0, -1).map((_, i) => (
        <path key={i} className="flow" d={`M${i * step + W + 4},${y + H / 2} H${(i + 1) * step - 6}`} markerEnd={`url(#${id}-ahw)`} />
      ))}
      {back && (
        <>
          <path className="flow back" d={`M${(n - 1) * step + W / 2},${y + H + 4} V${y + H + 52} H${W / 2} V${y + H + 8}`} markerEnd={`url(#${id}-ahw)`} />
          <text className="d-note" x="500" y={y + H + 44} textAnchor="middle">
            {back.wide}
          </text>
        </>
      )}
      {nodes.map((nd, i) => (
        <g key={nd.title} transform={`translate(${i * step},${y})`} className={nd.tempo ? "node tempo" : "node"}>
          <rect width={W} height={H} />
          <text className="d-title" x={W / 2} y={38} textAnchor="middle">
            {nd.title}
          </text>
          {nd.sub.map((s, j) => (
            <text key={s} className="d-sub" x={W / 2} y={62 + j * 18} textAnchor="middle">
              {s}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}

function Tall({ id, nodes, label, back }: PipeProps) {
  const n = nodes.length;
  const W = 236;
  const H = 96;
  const step = 128;
  const x = back ? 16 : 52;
  const height = (n - 1) * step + H + 8;
  return (
    <svg className="diagram tall" viewBox={`0 0 340 ${height}`} role="img" aria-labelledby={`${id}-t`}>
      <title id={`${id}-t`}>{label}</title>
      <defs>
        <marker id={`${id}-aht`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path className="arrowhead" d="M0,0 L10,5 L0,10 z" />
        </marker>
      </defs>
      {nodes.slice(0, -1).map((_, i) => (
        <path key={i} className="flow" d={`M${x + W / 2},${i * step + H + 4} V${(i + 1) * step - 6}`} markerEnd={`url(#${id}-aht)`} />
      ))}
      {back && (
        <>
          <path className="flow back" d={`M${x + W + 4},${(n - 1) * step + H / 2} H${x + W + 44} V${H / 2} H${x + W + 8}`} markerEnd={`url(#${id}-aht)`} />
          <text className="d-note" transform={`translate(${x + W + 60},${((n - 1) * step + H) / 2}) rotate(90)`} textAnchor="middle">
            {back.tall}
          </text>
        </>
      )}
      {nodes.map((nd, i) => (
        <g key={nd.title} transform={`translate(${x},${i * step})`} className={nd.tempo ? "node tempo" : "node"}>
          <rect width={W} height={H} />
          <text className="d-title" x={W / 2} y={30} textAnchor="middle">
            {nd.title}
          </text>
          {nd.sub.map((s, j) => (
            <text key={s} className="d-sub" x={W / 2} y={56 + j * 18} textAnchor="middle">
              {s}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** One pipeline drawn twice: wide above 720px, tall below. */
export function Pipeline(p: PipeProps) {
  return (
    <>
      <Wide {...p} />
      <Tall {...p} />
    </>
  );
}

const SLASH_NODES: PipeNode[] = [
  { title: "Tempo block N", sub: ["state + block hash", "MPT-verified"], tempo: true },
  { title: "tempo-revm", sub: ["Tempo's own EVM", "re-runs the transfer"] },
  { title: "SP1 zkVM", sub: ["proves that run", "RISC-V execution"] },
  { title: "Groth16", sub: ["succinct proof", "made locally"] },
  { title: "Sworn.sol", sub: ["on Tempo", "verifyProof → slash"], tempo: true },
];

export function ProofSection({ pins, onRetry }: { pins: Loadable<ProofPins>; onRetry: () => void }) {
  return (
    <section className="section" aria-labelledby="how">
      <div className="section-head">
        <p className="eyebrow">The engine</p>
        <h2 id="how">How the slash proof is made</h2>
        <p className="lede">
          The same recipe as the Zone proof above, with Tempo's EVM in place of the Zone verifier: the challenger re-runs the
          exact transfer with tempo-revm over state proven against block N's header, inside SP1, and Sworn.sol checks the
          Groth16 proof against that block's hash on Tempo.
        </p>
      </div>
      <figure className="figure">
        <Pipeline
          id="dg-slash"
          nodes={SLASH_NODES}
          label="Tempo block N, re-executed by tempo-revm inside the SP1 zkVM, wrapped as a Groth16 proof, verified by Sworn.sol on Tempo against block N's hash."
          back={{ wide: "blockhash(N) == the question's block hash, checked on Tempo", tall: "blockhash(N) checked on Tempo" }}
        />
        <figcaption>
          Heavy edges are on Tempo; the middle three run on the challenger's machine (the three Moderato proofs took about 7 to 9
          minutes, per the run logs).
        </figcaption>
      </figure>
      <div className="pins" aria-live="polite">
        <p className="eyebrow">Pinned in Sworn.sol, read from chain</p>
        {pins.status === "ok" ? (
          <dl className="facts">
            <dt>SP1_VERIFIER</dt>
            <dd>
              <AddrLink address={pins.value.verifier} label={pins.value.verifier} /> · {pins.value.verifierVersion}
            </dd>
            <dt>GUEST_VKEY</dt>
            <dd className="mono">{pins.value.guestVkey}</dd>
            <dt>GUEST_VERSION</dt>
            <dd className="mono">
              {pins.value.guestVersion}
              {pins.value.guestVersionIsV1 && <span className="ok"> = keccak256("sworn-guest-v1") ✓</span>}
            </dd>
            <dt>MAX_AGE</dt>
            <dd className="mono">{pins.value.maxAge.toString()} blocks (the answer must be about a block whose hash Tempo still serves)</dd>
          </dl>
        ) : pins.status === "error" ? (
          <ErrorBox error={pins.error} onRetry={onRetry} />
        ) : (
          <p className="loading">
            <span className="pulse" aria-hidden /> Reading the verifier and vkey from Sworn…
          </p>
        )}
      </div>
    </section>
  );
}
