# Yellow Paper

The yellow paper is the protocol-truth and implementation-truth view of the repo. It is where we describe exact surfaces, exact state structure, exact execution order, and the boundaries between:

- protocol invariants
- mainnet implementation details
- testnet implementation details
- current local implementation

Use the [White Paper](../whitepaper/index.md) for the narrative architecture. Use the [Hypurrliquid Paper](../paper/index.html) for the larger reverse-engineering reference. Use this document when the question is “what exactly executes, serializes, hashes, or routes here?”

## 1. Scope and Truth Labels

Every serious protocol claim in this repo should be tagged mentally as one of:

- `protocol`
- `mainnet_impl`
- `testnet_impl`
- `local_impl`

and one of:

- `observed`
- `confirmed`
- `implemented`
- `verified`

This is the only sustainable way to manage a system where binary evidence, official docs, runtime traces, and local implementation all move at different speeds.

## 2. Action Surface

The action plane is broad, but it is not unstructured. The dominant families are:

### 2.1 Trading

- `order`
- `cancel`
- `cancelByCloid`
- `modify`
- `batchModify`
- `scheduleCancel`
- TWAP variants
- liquidation-facing actions

### 2.2 Transfers

- `usdSend`
- `usdClassTransfer`
- `spotSend`
- `sendAsset`
- sub-account transfer families
- EVM-linked transfer actions

### 2.3 Vault, Staking, Governance, and Bridge

- vault create/modify/transfer/distribute
- staking delegation and reward actions
- `SetGlobalAction`
- `VoteGlobalAction`
- bridge validator and withdrawal paths

### 2.4 Action Signing Domains

The signing model is split by *signing family*, not by duplicating every action schema:

- L1 action signing
- user-signed action domain

Chain selection matters for signing and response/hash behavior, but not every action payload itself carries a distinct mainnet/testnet body.

## 3. State Layout

The central object is `Exchange`, currently tracked in this repo as a 57-field struct. It is the execution state that block processing mutates.

Major state clusters include:

- order books and market state
- user/account state
- clearinghouse state
- BOLE state
- bridge and staking state
- EVM-facing state
- validator-linked trackers
- delayed-action state
- response-hash/LtHash-linked accumulators and trackers

The state cardinality claim is maintained explicitly in:

- [Exchange State](../obsidian/Exchange%20State.md)
- [Protocol Sync Report](../status/protocol-sync-report.md)

## 4. Universe and Routing Model

One of the key implementation corrections in this repo is separating:

1. **universe / namespace**
2. **asset family**
3. **account mode**

The current routing model is:

- core perp universe: `""`
- spot universe: `"spot"`
- HIP-3 perp universes: `dexName`

That matters for:

- `sendAsset`
- `spotSend`
- `usdSend`
- sub-account transfers
- collateral placement

If a universe does not exist in state, transfers into it should fail closed rather than being guessed.

## 5. Block Lifecycle

At the highest level, block processing is:

1. recover actor context
2. `begin_block`
3. deliver signed actions
4. block-finalization / end-block surfaces
5. response-hash and app-hash commitment path

The dedicated execution map is:

- [Block Lifecycle](../block-lifecycle/index.html)

### 5.1 Begin-Block Ordering

This repo has a concrete local `begin_block` execution surface, but not every placement question is fully closed from the binary yet.

What is settled:

- there is a high-leverage pre-action hook surface
- funding, BOLE, stale-mark, pruning, and delayed-action logic all live near it

What remains open:

- exact binary placement of BOLE relative to the older 9-effect model
- exact binary placement of matured delayed actions relative to the begin-block body

That open edge is tracked explicitly in:

- [Open Claims](../status/open-claims.md)
- [Claims Index](../findings/claims-index.md)

## 6. Liquidation, ADL, and Product Boundaries

The risk engine is not one uniform path.

### 6.1 Perps and Portfolio Margin

Perps and portfolio margin live in the main liquidation family. Portfolio margin is not a separate liquidation engine; it is a unified account/risk mode over eligible assets.

### 6.2 BOLE

BOLE has its own liquidation family:

- market liquidation
- partial liquidation
- backstop liquidation

and it now runs as an explicit local begin-block lane in this repo.

### 6.3 Spot

Spot is not ordinary perp-style liquidation. Spot dust conversion and related cleanup surfaces are separate from the main perp/PM liquidation family.

### 6.4 Outcomes

Outcomes are not ordinary perp-style liquidations either. They are primarily a settlement/collateral-conservation problem with distinct question-level state.

Detailed execution reference:

- [Liquidation & ADL](../liquidation/index.html)

## 7. Action Delayer and EVM Re-entry

The ActionDelayer is now one of the clearer examples of the repo’s evidence discipline.

What is confirmed:

- delayed entries carry explicit `matured_at`
- snapshots persist that maturity directly
- drain-time execution is keyed off stored maturity
- queue-full rejection is silent

What is not yet closed:

- exact `enabled` semantics
- exact `delayer_mode` semantics
- how `status_guard` and `vty_trackers` influence mode selection or delay scaling
- exact binary placement of the drain relative to the rest of `begin_block`

See:

- [Action Delayer](../obsidian/Action%20Delayer.md)

## 8. Hashing and App-Hash Parity

The hashing model has multiple distinct layers:

1. client action signing
2. execution response hashing
3. LtHash accumulator update
4. concise/public hash projection

The main current repo truth is:

- response hashing is chain-scoped
- mainnet and testnet do not necessarily share the same binary dispatch shape
- the repo must keep protocol truth separate from per-chain implementation truth

The claim tracking this is:

- [Claims Index](../findings/claims-index.md)

## 9. Bridge, Staking, and Governance

These control surfaces matter because they mutate high-value or validator-critical state:

- staking epochs and validator set state
- jailed/unjailed flows
- bridge signatures and finalized withdrawals
- governance and SetGlobal/VoteGlobal actions

They are not secondary systems. They are part of the deterministic state machine and part of replay parity.

## 10. Current Local Implementation Standard

The repo’s implementation rule should remain:

1. implement only from confirmed evidence or chain-scoped evidence
2. keep local behavior fail-closed where semantics are still open
3. add a regression at the same layer as the bug
4. run crate tests
5. update claims/docs when repo truth changes

That is how we avoid smearing guesses into consensus code.

## 11. Current Open Surfaces

The most important remaining protocol edges are:

- exact begin-block ordering closure in a few lanes
- full response serialization parity across chains
- some bridge/staking transition details
- deeper outcome reconciliation behavior
- remaining liquidation and ADL edge semantics

The active open-claim inventory is here:

- [Open Claims](../status/open-claims.md)
- [Protocol Scope Matrix](./protocol-scope-matrix.md)
- [Claims Index](../findings/claims-index.md)

## 12. Companion References

- [White Paper](../whitepaper/index.md)
- [Hypurrliquid Paper](../paper/index.html)
- [Block Lifecycle](../block-lifecycle/index.html)
- [Liquidation & ADL](../liquidation/index.html)
