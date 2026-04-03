---
id: claim.aligned_quote_token_sampling
title: Aligned quote token state samples validator risk-free-rate votes in begin-block effect 9
subsystem: execution
promotion: confirmed
status: active
confidence: confirmed
scope: testnet_impl
sources: ["source.block_lifecycle_note", "source.exchange_state_note"]
docs_targets: ["whitepaper", "yellowpaper", "findings", "status"]
updated: 2026-04-03
---

## Summary

The current repo truth is that aligned-quote-token state lives in `Exchange`
field `hpt`, and the protocol samples validator risk-free-rate votes in
begin-block effect 9. Validators submit SOFR-based rates through
`validatorL1Stream`, with `aqa-publisher` as the current sidecar surface named
in the notes.

## Evidence

- [`docs/obsidian/Block Lifecycle.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/Block%20Lifecycle.md) places `update_aligned_quote_token` at begin-block effect 9 and ties it to validator risk-free-rate votes.
- [`docs/obsidian/Exchange State.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/Exchange%20State.md) identifies `hpt` as the aligned quote token tracker and records the SOFR / `validatorL1Stream` / `aqa-publisher` surface.

## Open Questions

- Exact binary layout and update semantics for all `hpt` sub-fields.
- Whether daily 22:00 UTC publication is protocol-stable or a current operator-side convention.

## Implementation Impact

- Keep aligned-quote-token sampling separate from ordinary oracle updates.
- Treat `update_aligned_quote_token` as a first-class begin-block effect, not paper-only garnish.
