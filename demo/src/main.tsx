import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { makePublicClient } from "./chain/client.ts";
import { loadConfig } from "./chain/config.ts";
import { Chain, ErrorBox } from "./ui/common.tsx";
import { PhonePage } from "./pages/Phone.tsx";
import { WalletPage } from "./pages/Wallet.tsx";
import "./ui/styles.css";

function App() {
  const ctx = useMemo(() => {
    try {
      const cfg = loadConfig(import.meta.env as Record<string, string | undefined>);
      return { cfg, client: makePublicClient(cfg) };
    } catch (e) {
      return e as Error;
    }
  }, []);
  if (ctx instanceof Error)
    return (
      <main className="page">
        <ErrorBox error={ctx} title="Demo is not configured" />
      </main>
    );
  return <Chain.Provider value={ctx}>{location.pathname.startsWith("/phone") ? <PhonePage /> : <WalletPage />}</Chain.Provider>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
