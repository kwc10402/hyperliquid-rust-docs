---
id: claim.outcome_settlement_and_question_surface
title: Outcomes are 1x isolated settlement markets with explicit question and fallback metadata
subsystem: outcomes
promotion: confirmed
status: active
confidence: confirmed
scope: testnet_impl
sources: ["source.hip4_outcomes_note", "source.exchange_state_note", "source.outcome_solvency_review_2026_04_03"]
docs_targets: ["whitepaper", "yellowpaper", "findings", "status"]
updated: 2026-04-03
---

## Summary

The current repo truth is that outcomes are not ordinary leveraged markets.
They are settlement-driven instruments with:

- 1x isolated-only risk treatment
- no funding
- deployer-designated `oracleUpdater` settlement authority
- settlement-triggered order cancellation and rejection
- question-level metadata including `fallbackOutcome`, `namedOutcomes`, and `settledNamedOutcomes`
- user operations `SplitOutcome`, `MergeOutcome`, `MergeQuestion`, and `NegateOutcome`

## Evidence

- [`docs/obsidian/HIP-4 Outcomes.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/HIP-4%20Outcomes.md) documents the lifecycle, settlement behavior, user action family, and question metadata fields.
- [`docs/obsidian/Exchange State.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/Exchange%20State.md) places outcome state in the broader `Exchange` surface and keeps it separate from ordinary liquidation families.
- [`docs/generated/outcome_solvency_review_2026-04-03.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/generated/outcome_solvency_review_2026-04-03.md) reinforces that the main unresolved risk lives above simple pairwise token mechanics.

## Open Questions

- Exact binary branch identity for `MergeQuestion`.
- Exact operational meaning of `Cannot trade fallback token`.
- Exact collateral-conservation proof across fallback and settled named outcomes.

## Implementation Impact

- Keep outcomes out of the ordinary perp/PM liquidation path.
- Treat settlement, question metadata, and token operations as the primary modeling surfaces.
- Keep the `MergeQuestion` / fallback lane explicitly marked as higher-risk and still-open.
