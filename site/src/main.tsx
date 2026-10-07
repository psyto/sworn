import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { makePublicClient } from "./chain/client.ts";
import { MODERATO } from "./chain/config.ts";
import { idle, load, type Loadable } from "./chain/loadable.ts";
import { readOwnZone, verifyOwnZoneNow, type OwnZoneRead, type OwnZoneVerifyNow } from "./chain/ownZone.ts";
import { HARDFORK_BATCH, readAttestLine, readZoneAttest, verifyZoneNow, type AttestLine, type VerifyNow, type ZoneAttest } from "./chain/zone.ts";
import { DataFlow, Footer, Hero, OperationsTest, ProofFlow, ReviewGap, Topbar } from "./ui/sections.tsx";
import { OwnZoneSection } from "./ui/OwnZone.tsx";
import { ZoneSection } from "./ui/Zone.tsx";
import "./ui/styles.css";

const client = makePublicClient(MODERATO);

function App() {
  const [zone, setZone] = useState<Loadable<ZoneAttest>>(idle);
  const [also, setAlso] = useState<Loadable<AttestLine>>(idle);
  const [check, setCheck] = useState<Loadable<VerifyNow>>(idle);
  const [ownZone, setOwnZone] = useState<Loadable<OwnZoneRead>>(idle);
  const [ownCheck, setOwnCheck] = useState<Loadable<OwnZoneVerifyNow>>(idle);
  const started = useRef(false);

  const readZone = useCallback(() => load(() => readZoneAttest(client, MODERATO), setZone), []);
  const readAlso = useCallback(() => load(() => readAttestLine(client, MODERATO, HARDFORK_BATCH), setAlso), []);
  const verifyNow = useCallback(() => load(() => verifyZoneNow(client, MODERATO), setCheck), []);
  const readOwn = useCallback(() => load(() => readOwnZone(client, MODERATO), setOwnZone), []);
  const verifyOwn = useCallback(() => load(() => verifyOwnZoneNow(client), setOwnCheck), []);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev
    started.current = true;
    // Read only the submission's Zone evidence: our own Zone's settlement and payout, the withdrawal-batch receipt,
    // a live verify and the first attest.
    void (async () => {
      await readOwn();
      await verifyOwn();
      await readZone();
      await verifyNow();
      await readAlso();
    })();
  }, [readOwn, verifyOwn, readZone, verifyNow, readAlso]);

  return (
    <>
      <Topbar />
      <main className="page">
        <Hero />
        <ReviewGap />
        <ProofFlow />
        <DataFlow />
        <OperationsTest />
        <OwnZoneSection ownZone={ownZone} check={ownCheck} onRetry={() => void readOwn()} onVerify={() => void verifyOwn()} />
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
