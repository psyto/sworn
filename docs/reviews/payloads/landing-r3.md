# Judgment landing-r3 — old page vs new landing page: which one ships? (2026-10-11)

Read-only: do not edit files, push or send transactions. Working directory: /Users/hiroyusai/src/sworn. Answer in
≤ 700 words. Be decisive; the founder wants an independent judgment, not encouragement.

Attached: the first four 1440×900 screens of the LIVE page (`old-1..4.png`, https://psyto.github.io/sworn/, = main)
and of the NEW page (`new-1..4.png`, branch `landing-page`, uncommitted: `git diff -- site/`). The new page implements
your design in `docs/reviews/landing-design-r1.md` (stacked hero with the FlowDiagram, flat canvas, Space Grotesk +
IBM Plex Mono, open "who verifies" strip, dark "how it works" band, a "For engineers" band with the receipt, then the
unchanged evidence sections, live/not-yet, business test, FAQ, closing CTA). Copy is from landing-r2 with its fixes.

Goal: maximise the chance of winning the CWF Tempo track (Colosseum judging: founder–market fit, insight,
product/execution, market, communication, viability, traction). The page is the form's "Live product link"; judges
also see the pitch and demo videos (the demo shows the evidence sections, not the hero; the pitch is slides).

## What I want

1. **Verdict: ship NEW, keep OLD, or ship NEW with named changes.** Judge as a Colosseum reviewer opening the link
   after the pitch video. Which page communicates what Sworn is, for whom, and what is proven faster and more
   credibly? Any way the new page is worse (lost evidence prominence, judge's first impression, a technical judge's
   trust, the demo video no longer matching)?
2. **Claims check of what changed since r2 only:** the hero figcaption ("The witness stays with the prover; only the
   proof and public batch data reach Tempo. Shown with the real digest of a fixture batch from Tempo's integration
   tests (dev chain 1337).") — note r2 asked to avoid "stays/stops there" wording; the EvidenceIntro copy ("Everything
   below reads Tempo's public Moderato RPC from your browser. Nothing to sign or install." — true for the receipt,
   which is static?); DataFlow's note now says "The diagram at the top of the page…" and "The own-Zone run above is
   separate" — correct given the new order (OwnZone, Zone, DataFlow inside the band)?
3. Any BLOCKER/MAJOR before merging to main (which auto-deploys Pages). Mark [V]/[I], file:line, minimal fixes.
