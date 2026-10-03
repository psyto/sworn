// Parses a real SP1 proving log (e.g. ../out/ac7_groth16.log) into measured step durations, so
// the UI can offer a *labelled* fast-forward of a recorded run. Nothing here is a chain fact.
import { readFileSync } from "node:fs";
import type { Recording } from "../src/api.ts";

export function parseRecording(path: string): Recording {
  const text = readFileSync(path, "utf8");
  const secs = (re: RegExp): number | undefined => {
    const m = text.match(re);
    if (!m) return undefined;
    const v = Number(m[1]);
    return m[2] === "ms" ? v / 1000 : v;
  };
  const steps: Recording["steps"] = [];
  const push = (label: string, s: number | undefined) => s !== undefined && steps.push({ label, seconds: s });
  push("Load the witness for block N (MPT-verified against its state root)", secs(/client init wall: ([\d.]+)(m?s)/));
  push("Run tempo-revm inside the zkVM", secs(/execute wall: ([\d.]+)(m?s)/));
  push("Prover setup", secs(/setup wall: ([\d.]+)(m?s)/));
  push("Groth16 proof (wraps the execution trace)", secs(/PROVE groth16 wall: ([\d.]+)(m?s)/));
  push("Verify the proof locally", secs(/verify ok \(([\d.]+)(m?s)\)/));
  if (!steps.some((s) => s.label.startsWith("Groth16"))) throw new Error(`${path}: no "PROVE groth16 wall" line`);
  const cycles = text.match(/cycles\(total_instruction_count\): (\d+)/);
  return { source: path, steps, cycles: cycles ? Number(cycles[1]) : undefined };
}
