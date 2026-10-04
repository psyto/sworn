import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { makePublicClient } from "./chain/client.ts";
import { MODERATO, TAKES, type Take } from "./chain/config.ts";
import { idle, load, type Loadable } from "./chain/loadable.ts";
import { readProofPins, readTimeline, type ProofPins, type Timeline } from "./chain/timeline.ts";
import { HARDFORK_BATCH, readAttestLine, readZoneAttest, verifyZoneNow, type AttestLine, type VerifyNow, type ZoneAttest } from "./chain/zone.ts";
import { ProofSection } from "./ui/ProofDiagram.tsx";
import { Footer, Hero, Topbar, WhyItMatters } from "./ui/sections.tsx";
import { TimelineSection } from "./ui/Timeline.tsx";
import { ZoneSection } from "./ui/Zone.tsx";
import "./ui/styles.css";

const client = makePublicClient(MODERATO);

function App() {
  const [zone, setZone] = useState<Loadable<ZoneAttest>>(idle);
  const [also, setAlso] = useState<Loadable<AttestLine>>(idle);
  const [check, setCheck] = useState<Loadable<VerifyNow>>(idle);
  const [take, setTake] = useState<Take>(TAKES[0]);
  const [timeline, setTimeline] = useState<Loadable<Timeline>>(idle);
  const [pins, setPins] = useState<Loadable<ProofPins>>(idle);
  // Each slash is read once; switching back shows that read. Only "Verify again" re-reads (the RPC rate-limits).
  const cache = useRef(new Map<string, Loadable<Timeline>>());
  const started = useRef(false);

  const readZone = useCallback(() => load(() => readZoneAttest(client, MODERATO), setZone), []);
  const readAlso = useCallback(() => load(() => readAttestLine(client, MODERATO, HARDFORK_BATCH), setAlso), []);
  const verifyNow = useCallback(() => load(() => verifyZoneNow(client, MODERATO), setCheck), []);
  const readTake = useCallback(async (t: Take) => {
    const r = await load(() => readTimeline(client, MODERATO, t), setTimeline);
    cache.current.set(t.id, r);
    return r;
  }, []);
  const readPins = useCallback(() => load(() => readProofPins(client, MODERATO), setPins), []);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev
    started.current = true;
    // Sequential, in page order: the Zone receipt (batch with a withdrawal), one live verify (three calls),
    // the first batch's attest line, the slash timeline, then the pins.
    void (async () => {
      await readZone();
      await verifyNow();
      await readAlso();
      await readTake(TAKES[0]);
      await readPins();
    })();
  }, [readZone, verifyNow, readAlso, readTake, readPins]);

  const pick = (t: Take) => {
    setTake(t);
    const hit = cache.current.get(t.id);
    if (hit && hit.status === "ok") setTimeline(hit);
    else void readTake(t);
  };

  return (
    <>
      <Topbar />
      <main className="page">
        <Hero />
        <ZoneSection attest={zone} also={also} check={check} onRetry={() => { void readZone(); void readAlso(); }} onVerify={() => void verifyNow()} />
        <WhyItMatters />
        <TimelineSection take={take} state={timeline} onPick={pick} onVerify={() => void readTake(take)} />
        <ProofSection pins={pins} onRetry={() => void readPins()} />
      </main>
      <Footer />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
