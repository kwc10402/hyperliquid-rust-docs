---
id: claim.bridge_finalization_and_validator_set_flow
title: Bridge2 stages withdrawals and validator-set updates through signatures plus finalized-vote state
subsystem: bridge
promotion: confirmed
status: active
confidence: confirmed
scope: testnet_impl
sources: ["source.bridge_note", "source.action_types_note", "source.exchange_state_note", "source.hyperbft_spec_note"]
docs_targets: ["whitepaper", "yellowpaper", "findings", "status"]
updated: 2026-04-04
---

## Summary

The current repo truth is that Bridge2 keeps distinct state for:

- withdrawal signatures
- finalized-withdrawal votes
- validator-set signatures
- finalized validator-set votes
- a standalone `bal` field
- a standalone `last_pruned_deposit_block_number`
- a standalone boolean `oaw` field

The action surface also distinguishes the bridge phases: `withdraw3`,
`ValidatorSignWithdrawal`, `VoteEthFinalizedWithdrawal`,
`SignValidatorSetUpdate`, and `VoteEthFinalizedValidatorSetUpdate`.
Bridge signing is currently tracked as reusing validator consensus signer keys,
not a detached bridge-only signer family.

## Evidence

- [`docs/obsidian/Bridge.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/Bridge.md) lists the Bridge2 field layout, the signer-key reuse claim, and the staged withdrawal / validator-set flow.
- [`docs/obsidian/Action Types.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/Action%20Types.md) records the bridge signing and finalization action families.
- [`docs/obsidian/Exchange State.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/Exchange%20State.md) places the Bridge2 state surface directly on `Exchange`.
- [`docs/obsidian/HyperBFT Protocol Specification.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/HyperBFT%20Protocol%20Specification.md) includes the bridge validator action families in the wider consensus/control surface.

## Open Questions

- Exact timer semantics for the dispute period and finalize-vote closure.
- Exact operational split between hot-signature and cold-signature surfaces on the Ethereum side.
- Exact acronym expansion and operational role of Bridge2 bool field `oaw`.
- Exact concrete runtime type/meaning of Bridge2 field `bal`.

## Implementation Impact

- Keep bridge signatures, finalized votes, and finished-withdrawal timing as separate state transitions.
- Model validator-set updates as a first-class bridge flow, not as a generic governance afterthought.
- Keep bridge signer reuse and withdrawal invalidation risk explicit in the docs and safety model.
