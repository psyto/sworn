import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EvidenceTeaser, Faq, Footer, Hero, OperationsTest, ProofFlow, Topbar, UseSworn, WhoVerifies } from "./ui/sections.tsx";
import "./ui/styles.css";

// Links shared before the split point at the evidence sections on this page (e.g. /sworn/#own-zone): send them on.
const EVIDENCE_HASHES = ["#own-zone", "#zone", "#evidence", "#dg-zone"];
if (EVIDENCE_HASHES.includes(window.location.hash)) window.location.replace(`evidence/${window.location.hash}`);

/** The landing page: static, no chain reads. The live evidence is on evidence/ (src/evidence.tsx). */
function App() {
  return (
    <>
      <Topbar base="./" />
      <main className="page">
        <Hero />
        <WhoVerifies />
        <ProofFlow />
        <EvidenceTeaser />
        <OperationsTest />
        <UseSworn />
        <Faq />
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
