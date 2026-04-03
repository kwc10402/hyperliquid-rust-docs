---
id: claim.validator_lifecycle_and_jail_flow
title: Validator lifecycle is time-epoch gated, jail-aware, and signer-checked against current epoch state
subsystem: consensus
promotion: confirmed
status: active
confidence: confirmed
scope: testnet_impl
sources: ["source.validator_lifecycle_note", "source.hyperbft_spec_note", "source.gossip_protocol_note", "source.exchange_state_note"]
docs_targets: ["whitepaper", "yellowpaper", "findings", "status"]
updated: 2026-04-03
---

## Summary

The current repo truth is that validator eligibility is not a loose stake check.
It is tied to the current epoch state:

- epochs are time-based via `epoch_duration_seconds`
- active validators are recomputed at epoch boundaries
- proposer rotation excludes jailed validators
- signer validity checks search `epoch_states[cur_epoch]`
- `CSignerAction` currently exposes `unjailSelf`, `jailSelf`, and `jailSelfIsolated`
- manual unjail is rate-limited through `signer_to_last_manual_unjail_time`

## Evidence

- [`docs/obsidian/HyperBFT.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/HyperBFT.md) ties proposer rotation, jailing, and time-based epochs together.
- [`docs/obsidian/HyperBFT Protocol Specification.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/HyperBFT%20Protocol%20Specification.md) documents active-set checks, jailed-signer checks, and the signer gate before voting.
- [`docs/obsidian/Gossip Protocol.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/Gossip%20Protocol.md) records the current-epoch signer lookup and the exact `"Signer invalid or inactive for current epoch"` gate.
- [`docs/obsidian/Exchange State.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/Exchange%20State.md) lists the `staking` and `c_staking` fields that carry epoch state, jailed signers, and manual unjail timing.

## Open Questions

- Exact latency-EMA jail threshold and trigger semantics.
- Exact relationship between governance-driven unjail flows and `unjailSelf`.
- Exact trigger semantics for `ForceIncreaseEpoch`.

## Implementation Impact

- Keep validator admission and signer recovery tied to current epoch state, not just stake snapshots.
- Treat jailing, manual unjail, and proposer exclusion as one lifecycle surface.
- Keep broadcaster authorization separate from validator active-set eligibility even though both live in the control plane.
