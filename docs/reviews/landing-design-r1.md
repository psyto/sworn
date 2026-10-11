## Diagnosis

The current branch reads as a spec because:

1. Nearly every idea is presented as a bordered rectangle. The eye reads “dashboard/documentation,” not a product story.
2. The grid-paper background, all-caps mono eyebrows, and tight type give every section equal visual weight; there is no campaign-like crescendo.
3. The hero is a familiar “copy left / evidence card right” SaaS layout. The receipt competes with the proposition before the user understands it.
4. The strongest bespoke asset—the animated proof/data-flow—is buried after explanatory cards.
5. Dense proof, status, market, FAQ, and technical material arrive too early, without a visual boundary between narrative and evidence.

## Recommended page sequence

### 1. Hero — proposition plus the FlowDiagram

Use the FlowDiagram as the hero visual. It is Sworn’s distinctive product proof, whereas a receipt is evidence best understood after the proposition.

Layout: a generous, stacked hero. At desktop, put the label, headline, lede, and two actions in a 7-column text area; place the FlowDiagram full-width beneath, with substantial white space. Do not use a right-side panel.

Keep exactly:

- “Sworn · for Tempo Zones”
- “Prove a private batch ran correctly. Without publishing it.”
- The existing lede, including “anyone can re-check the proof on chain”
- “Watch the 1:49 pitch ↗” and “Re-check it on chain ↓”
- The complete scope line, directly beneath the actions/diagram and visible above the fold.

The diagram is allowed to have nodes; it is an explanatory instrument, not another page-card system.

### 2. “The question” — editorial comparison

Keep the existing heading and all three Bitcoin/Zcash/Tempo Zones statements. Make this a three-column editorial strip, not three adjacent cards: columns one and two sit directly on the canvas with generous padding; Tempo Zones is the single cobalt block. Place the existing “Without a proof…” paragraph below at a readable 60–65ch.

### 3. “How it works” — dark product band

Keep the complete “Three steps, from a private batch to a public check.” section and its current step copy. Make it the only dark, full-bleed band before evidence: large heading on the left; three numbered steps on the right or below as an open vertical sequence with hairline dividers, not boxed cards. This creates a deliberate transition from problem to mechanism.

### 4. Evidence — a clearly labelled engineer boundary

Immediately after the dark band, begin a pale-blue/near-white full-bleed area labelled:

`For engineers`  
`Re-check the evidence on Moderato.`

This is a navigational label, not a new claim.

Put the static receipt here, beside the evidence introduction—not in the hero. Retain every receipt statement and transaction link exactly. Its job becomes an evidence index: settled batch, separate payout, rejected forged batch.

Then retain the existing interactive `OwnZoneSection`, `ZoneSection`, and `DataFlow` inside this band, in that order. This is where dense detail belongs. `DataFlow` can retain its heading and explanatory copy, but should not render a second full FlowDiagram; the hero already did that work.

Move `LiveStatus`, `OperationsTest`, `Faq`, and `ClosingCta` below this band. They remain available without interrupting the primary landing-page narrative.

## Type and colour

Avoid copying Billet’s editorial serif. Sworn should feel precise, technical, and recognisably its own: use **Space Grotesk** for display/body and **IBM Plex Mono** for evidence labels, hashes, and scope.

```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

```css
:root {
  --bg: #f7f6f2;
  --surface: #ffffff;
  --surface-2: #eef1ff;
  --text: #17182c;
  --muted: #626579;
  --border: #d9dbe5;
  --accent: #3146b7;
  --accent-text: #fff;
  --ink-band: #151a3a;
  --ink-band-text: #f7f8ff;
  --ok: #15764c;
  --bad: #b42318;
  --sans: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;
  color-scheme: light;
}

:root[data-theme="dark"] {
  --bg: #0d1020;
  --surface: #151a2e;
  --surface-2: #1b2344;
  --text: #f4f5fb;
  --muted: #b4b9cb;
  --border: #303958;
  --accent: #9eaeff;
  --accent-text: #10142b;
  --ink-band: #080b18;
  --ink-band-text: #f4f5fb;
  --ok: #5fdb9a;
  --bad: #ff8782;
  color-scheme: dark;
}
```

Remove the graph-paper background. A quiet flat canvas and the animated proof line provide much stronger brand recognition than decorative grid texture.

## Implementation skeleton

Export `FlowDiagram`, extract the existing receipt markup into `Receipt`, and reuse it unchanged.

```tsx
export function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Sworn · for Tempo Zones</p>
        <h1>Prove a private batch ran correctly. Without publishing it.</h1>
        <p className="lede">
          Tempo Zones keep transactions private from the public. Sworn proves, with
          Tempo&apos;s own Zone code, that an operator-supplied batch executed correctly,
          and <strong>anyone can re-check the proof on chain</strong>.
        </p>
        <div className="hero-actions">{/* existing two links */}</div>
      </div>
      <div className="hero-flow"><FlowDiagram /></div>
      <p className="hero-boundary">
        Moderato testnet · unaudited · our own Zone (one operator), not Tempo-created ·
        the payout is a separate action by our sequencer
      </p>
    </section>
  );
}

export function EvidenceIntro() {
  return (
    <section className="evidence-intro">
      <div>
        <p className="eyebrow">For engineers</p>
        <h2>Re-check the evidence on Moderato.</h2>
      </div>
      <Receipt /> {/* current receipt text and links, unchanged */}
    </section>
  );
}
```

```tsx
<main className="page">
  <Hero />
  <WhoVerifies />
  <ProofFlow className="work-band" />
  <div className="evidence-band">
    <div className="evidence-inner">
      <EvidenceIntro />
      <OwnZoneSection {...ownZoneProps} />
      <ZoneSection {...zoneProps} />
      <DataFlow /> {/* prose/details only; FlowDiagram already appeared in Hero */}
    </div>
  </div>
  <LiveStatus />
  <OperationsTest />
  <Faq />
  <ClosingCta />
</main>
```

```css
body { background: var(--bg); }
.page { max-width: 1160px; padding-inline: 24px; }

.hero { display: grid; gap: 38px; padding: 92px 0 44px; }
.hero-copy { max-width: 760px; gap: 20px; }
.hero h1 {
  max-width: 12ch;
  font-size: clamp(3.1rem, 6.8vw, 6.4rem);
  line-height: .94;
  letter-spacing: -.065em;
}
.hero .lede { max-width: 58ch; font-size: clamp(1rem, 1.5vw, 1.2rem); }
.hero-flow { padding-top: 18px; border-top: 1px solid var(--border); }
.hero-boundary { font: 500 11px/1.55 var(--mono); color: var(--muted); }

.work-band, .evidence-band {
  width: 100vw;
  margin-inline: calc(50% - 50vw);
  padding-inline: max(24px, calc((100vw - 1112px) / 2));
}
.work-band {
  background: var(--ink-band);
  color: var(--ink-band-text);
  border: 0;
  padding-block: clamp(64px, 9vw, 120px);
}
.evidence-band { background: var(--surface-2); padding-block: 64px; }
.evidence-inner { max-width: 1112px; margin: auto; }
.evidence-intro {
  display: grid; grid-template-columns: 1fr minmax(300px, .8fr);
  gap: 48px; align-items: start; padding-bottom: 42px;
}
.evidence-intro .receipt { border-left: 2px solid var(--accent); padding-left: 20px; }

.who-grid { gap: 0; border: 0; }
.who-grid li { padding: 28px 36px 28px 0; border: 0; background: transparent; }
.who-grid li + li { margin-left: 0; padding-left: 36px; border-left: 1px solid var(--border); }
.who-grid .who-zone { margin-left: 0; padding: 28px 32px; border: 0; background: var(--accent); }

@media (max-width: 720px) {
  .page { padding-inline: 16px; }
  .hero { padding-top: 56px; gap: 28px; }
  .hero h1 { font-size: clamp(2.8rem, 14vw, 4.3rem); }
  .evidence-intro, .who-grid { grid-template-columns: 1fr; }
  .who-grid li + li { margin: 0; padding: 28px 0; border-left: 0; border-top: 1px solid var(--border); }
}
```

## Cut from above evidence

Move—not delete—`LiveStatus`, `OperationsTest`, FAQ, closing CTA, the static receipt, and the detailed data-commitment prose below the evidence boundary. Above evidence, do not retain the page-wide grid, repeated bordered cards, or a second rendering of the FlowDiagram.