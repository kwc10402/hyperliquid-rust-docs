---
id: claim.hyperbft_topology_and_rotation
title: HyperBFT uses broadcaster ingress, validator/sentry admission checks, and RoundRobinTtl proposer rotation
subsystem: consensus
promotion: confirmed
status: active
confidence: confirmed
scope: testnet_impl
sources: ["source.hyperbft_spec_note", "source.gossip_protocol_note", "source.block_lifecycle_note"]
docs_targets: ["whitepaper", "yellowpaper", "findings", "status"]
updated: 2026-04-03
---

## Summary

The current consensus/networking truth in-repo is a HyperBFT surface with:

- stake-weighted round-robin proposer rotation via `RoundRobinTtl`
- QC and TC certificates under a two-chain commit rule
- ingress through a small broadcaster set rather than direct user-to-validator submission
- validator/sentry admission checks on the peer transport
- a split transport surface on ports `4001` and `4002`

## Evidence

- [`docs/obsidian/HyperBFT Protocol Specification.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/HyperBFT%20Protocol%20Specification.md) documents QC/TC flow, `RoundRobinTtl`, broadcaster bundling, and the 4001/4002 split.
- [`docs/obsidian/Gossip Protocol.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/Gossip%20Protocol.md) documents the TCP greeting, validator/sentry admission checks, and concise transport families.
- [`docs/obsidian/Block Lifecycle.md`](/Users/androolloyd/Development/hyperliquid-rust/docs/obsidian/Block%20Lifecycle.md) ties proposer validation and broadcaster authorization into the block-entry path.

## Open Questions

- Exact role split between validators, sentries, and other approved peers in every deployment mode.
- How much of the current transport layout is protocol-stable versus build- or operator-specific.

## Implementation Impact

- Keep the public docs explicit that users normally flow through broadcasters, not directly to every validator.
- Keep proposer rotation and QC/TC language aligned across block-lifecycle, gossip, and consensus pages.
