**Recommendation: do a smaller version, not the proposed rewrite verbatim.**

A sharper hero is worth it: this is the form’s live-product link, and the current hero makes the judge read before seeing the product. But with ~1.5 days, don’t move the async evidence machinery into the hero or reorder every section. Keep the stable 3/1/1 card and scope line; change H1, subhead, and CTA. The current app already runs the re-check on load ([main.tsx:29-41](</Users/hiroyusai/src/sworn/site/src/main.tsx:29>)); a dynamic hero card adds RPC/loading/error states precisely where first impression matters.

Suggested minimal hero:

> **Prove a private Zone batch ran correctly—without publishing its transactions.**  
> For an operator-supplied batch, Sworn runs Tempo’s Zone verifier in SP1 and binds a proof to the exact portal-shaped inputs. Anyone can re-check that proof on chain.

CTA: **“Re-check the demonstrated own-Zone batch”**; retain **“Watch the 1:49 pitch.”**

The pitch is slide-based, not a capture of the site ([record-pitch-d.mjs:35-37](</Users/hiroyusai/src/sworn/video/record-pitch-d.mjs:35>)). The demo does show the interior live re-check and own-Zone section ([record-demo-d.mjs:118-128](</Users/hiroyusai/src/sworn/video/record-demo-d.mjs:118>)), but not the hero. No re-record is needed if the hero stays as narrow as the videos: fixture and own-Zone runs are explicitly separate ([DEMO-D.md:39-51](</Users/hiroyusai/src/sworn/video/DEMO-D.md:39>)).

- **MAJOR [V] — “Prove a private ledger is right” is broader than the statement.** The verifier proves `prove_zone_batch` accepted one supplied batch, bound to pinned Zone/genesis and `IVerifier`-shaped fields; it does not establish the whole ledger, completeness, solvency, canonical genesis authenticity, liveness, or Tempo-Zone withdrawal security ([003-zone-verifier.md:75-86, 153-167](</Users/hiroyusai/src/sworn/docs/specs/003-zone-verifier.md:75>); [SwornZoneVerifier.sol:43-59](</Users/hiroyusai/src/sworn/contracts/src/SwornZoneVerifier.sol:43>)). Use “private Zone batch,” not “ledger.”

- **MAJOR [V] — “only the operator can see the ledger” is materially imprecise.** Users see their own activity; the operator’s *sequencer set* sees every transaction. Zones are private from the public, not their operator ([README.md:3-12](</Users/hiroyusai/src/sworn/README.md:3>)). Minimal version: “The full ledger is private from the public: users see their own activity, while the operator’s sequencer set sees every transaction.”

- **MAJOR [V] — “Sworn proves each batch” implies a deployed general service / Tempo-Zone coverage.** Built evidence is three batches on the founder’s own, one-operator Zone; Tempo-created Zones are unchanged ([README.md:19-28](</Users/hiroyusai/src/sworn/README.md:19>); [OwnZone.tsx:107-123](</Users/hiroyusai/src/sworn/site/src/ui/OwnZone.tsx:107>)). Say “Sworn can prove an operator-supplied batch”; put directly below it: “Demo: 3 proof-gated batches on our own one-operator Zone — testnet, not Tempo-created.”

- **MINOR [V] — “Verify a private batch now” is nearly honest, but too unspecific.** `verifyOwnZoneNow` fetches one fixed settled transaction, checks it contains recorded proof/hash material, calls the fixed own-Zone verifier with a recorded vector, then confirms `nextZoneHeight + 1` reverts ([ownZone.ts:171-197](</Users/hiroyusai/src/sworn/site/src/chain/ownZone.ts:171>)). It does not generate a proof, verify an arbitrary visitor’s batch, or itself check the forged transaction. The forged result comes from the separate receipt/trace read ([ownZone.ts:139-148](</Users/hiroyusai/src/sworn/site/src/chain/ownZone.ts:139>)). “Re-check the demonstrated own-Zone batch” is exact.

Do not defer the current mono scope line to a late table. Above the fold must retain: **Moderato testnet; unaudited; own one-operator Zone, not Tempo-created; demonstrated batch only; withdrawal payout was separately sequencer-triggered.** The existing line does this well ([sections.tsx:101-104](</Users/hiroyusai/src/sworn/site/src/ui/sections.tsx:101>)).

**X post**

- **MINOR [I] — a ZK engineer could correct “even though no one can see.”** Shielded transaction details are not public, but participants and holders of appropriate viewing authority can see authorized data.  
- **MINOR [I] — “only the operator can see” should say users see their own activity and the sequencer set sees all transactions.** This is also inconsistent with the project’s own careful wording ([PITCH-D.md:12-16](</Users/hiroyusai/src/sworn/video/PITCH-D.md:12>)).

A short corrective reply is warranted, because it improves rather than distracts:

> Precision: Zone users see their own activity; the operator’s sequencer set sees the full transaction set. By “private” I mean private from the public reviewer. Likewise, Zcash transaction details are not public, though parties/viewing-key holders can disclose authorized data.

“Zcash showed ZK can do this for a transaction” is a reasonable narrow analogy, though “Zcash proves a shielded transaction is valid” is cleaner.

**Current submission:** no BLOCKER or MAJOR found. **Proposed copy as written:** the three MAJOR wording issues above should not ship. Network check failed DNS resolution for `api.github.com`; live X replies and external source wording were not independently checked **[I]**.