import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { makePublicClient } from "./chain/client.ts";
import { MODERATO } from "./chain/config.ts";
import { idle, load, type Loadable } from "./chain/loadable.ts";
import { HARDFORK_BATCH, readAttestLine, readZoneAttest, verifyZoneNow, type AttestLine, type VerifyNow, type ZoneAttest } from "./chain/zone.ts";
import { DataFlow, Footer, Hero, OperationsTest, ProofFlow, ReviewGap, Topbar } from "./ui/sections.tsx";
import { ZoneSection } from "./ui/Zone.tsx";
import "./ui/styles.css";

const client = makePublicClient(MODERATO);

function App() {
  const [zone, setZone] = useState<Loadable<ZoneAttest>>(idle);
  const [also, setAlso] = useState<Loadable<AttestLine>>(idle);
  const [check, setCheck] = useState<Loadable<VerifyNow>>(idle);
  const started = useRef(false);

  const readZone = useCallback(() => load(() => readZoneAttest(client, MODERATO), setZone), []);
  const readAlso = useCallback(() => load(() => readAttestLine(client, MODERATO, HARDFORK_BATCH), setAlso), []);
  const verifyNow = useCallback(() => load(() => verifyZoneNow(client, MODERATO), setCheck), []);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev
    started.current = true;
    // Read only the submission's Zone evidence: the withdrawal-batch receipt, a live verify and the first attest.
    void (async () => {
      await readZone();
      await verifyNow();
      await readAlso();
    })();
  }, [readZone, verifyNow, readAlso]);

  return (
    <>
      <Topbar />
      <main className="page">
        <Hero />
        <ReviewGap />
        <ProofFlow />
        <DataFlow />
        <OperationsTest />
        <ZoneSection attest={zone} also={also} check={check} onRetry={() => { void readZone(); void readAlso(); }} onVerify={() => void verifyNow()} />
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
