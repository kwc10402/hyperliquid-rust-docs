# Fees

Complete fee system for [[Hyperliquid]], implemented in `hl-engine/src/fees.rs` (2,100 lines).

**CONFIRMED 2026-04-03**: Full fee pipeline implemented and tested. VIP tiers, staking discounts, MM rebates from live API. Outcome token fees CONFIRMED from testnet observation. FeeSchedule 9-field binary layout CONFIRMED from serde chain at `.rodata` 0x543b5d.

## Fee Pipeline

CONFIRMED from binary string analysis:

```
Fill -> compute_fee(user_fee_state, is_maker, is_spot)
  -> base rate from VIP tier (by 14-day NTL volume)
  -> apply MM rebate (maker only, if MM tier qualifies)
  -> apply fee trial override (if active, replaces base rate)
  -> apply stable pair / aligned quote / growth mode modifiers
  -> apply outcome fee scaling (outcome tokens only)
  -> apply staking discount (multiplicative on non-negative fees)
  -> apply referral discount (4% off taker fee, referrer gets that amount)
  -> compute exchange fee and deployer share (HIP-3)
  -> add builder fee (if specified, charged on top)
  -> distribute to (exchange, referrer, builder, deployer)
```

## VIP Tiers (7 tiers)

CONFIRMED from live API at `https://app.hyperliquid.xyz/fees`.

| Tier | 14d NTL Volume | Perp Taker (bps) | Perp Maker (bps) | Spot Taker (bps) | Spot Maker (bps) |
|------|----------------|-------------------|-------------------|-------------------|-------------------|
| Base | $0 | 4.5 | 1.5 | 7.0 | 4.0 |
| VIP1 | $5M | 4.0 | 1.2 | 6.0 | 3.0 |
| VIP2 | $25M | 3.5 | 0.8 | 5.0 | 2.0 |
| VIP3 | $100M | 3.0 | 0.4 | 4.0 | 1.0 |
| VIP4 | $500M | 2.8 | 0.0 | 3.5 | 0.0 |
| VIP5 | $2B | 2.6 | 0.0 | 3.0 | 0.0 |
| VIP6 | $7B | 2.4 | 0.0 | 2.5 | 0.0 |

Volume calculation: `(14d weighted volume) = (14d perps volume) + 2 * (14d spot volume)` when `weigh_spot_volume_double` is true.

## Staking Discount Tiers (7 tiers)

Multiplicative discount on fees based on HYPE staked as bps of max supply (1B tokens).

| Tier | BPS of Max Supply | Discount |
|------|-------------------|----------|
| 0 | 0 | 0% |
| 1 | 0.01 bps | 5% |
| 2 | 0.1 bps | 10% |
| 3 | 1 bps | 15% |
| 4 | 10 bps | 20% |
| 5 | 100 bps | 30% |
| 6 | 500 bps | 40% |

## Market-Maker Rebate Tiers (3 tiers)

Additive rebate applied on top of VIP maker rate. At VIP4+ (0.0 bps maker), this yields a net rebate (negative maker fee).

| Tier | Maker Volume Fraction | Rebate (bps) |
|------|----------------------|--------------|
| MM1 | 0.5% | -0.1 |
| MM2 | 1.5% | -0.2 |
| MM3 | 3.0% | -0.3 |

## Referral System

- **Discount**: 4% of taker fee rebated to referred user
- **Referrer keep**: 100% of the referral discount goes to referrer (configurable via `referrer_keep`)
- **Discount volume cap**: first $25M traded (after that, no discount)
- **Reward volume cap**: first $1B traded (after that, no referrer rebate)
- CONFIRMED: `setReferrer` action, `code_to_referrer` mapping, `ReferrerState` tracking

## Outcome Token Fees (HIP-4)

CONFIRMED from testnet observation (2026-04-03):

- **Opens (buys increasing position)**: FREE -- 0/269 buys charged fees
- **Closes (sells decreasing position)**: Standard taker rate applies
- **Settlement losers (pnl < 0)**: FREE -- 0/16 losers charged
- **Settlement winners (pnl > 0)**: Higher rate than regular sells (settlement premium)
  - CONFIRMED: sell=4.0 bps vs settlement=5.6 bps for same user
- **fee_scale**: Controlled by `OutcomeTracker.fee_scale` (`outr.fs`) in ABCI state
  - 0.0 = fees disabled for outcomes
  - Greater than 0 = fees enabled with scaling
- **Governance**: `SetOutcomeFeeScale` via `VoteGlobal` action

Location: `locus.scl.meta.outr.fs`

## Stable Pairs

Stable pairs (e.g., USDC/USDT) receive reduced fees:

- **Taker fee**: 80% reduction (factor 0.20)
- **Maker rebate**: 80% better (factor 0.20)
- **Volume contribution**: 80% less (factor 0.20)

## Aligned Quote Token

Assets using aligned quote tokens (e.g., USDH) get adjusted fees:

- **Taker fee**: 20% lower (factor 0.80)
- **Maker rebate**: 50% better (factor 0.50)
- **Volume contribution**: 20% more (factor 1.20)

Related: FeeSchedule field [6] `aligned_quote_token_config` with sub-fields `{kink_rate, base_rate, excess_rate}`. Exchange field [51] `last_aligned_quote_token_sample_time`. Exchange field [56] `hpt` (AlignedQuoteTokenTracker).

## HIP-3 Growth Mode

HIP-3 deployed perps in growth mode get reduced fees to attract volume:

- **Fee reduction**: 90% (factor 0.10)
- **Volume contribution**: 90% reduction (factor 0.10)
- **Rate limit**: 90% reduction

## Deployer Share

HIP-3 deployers can configure a share of taker fees:

- **Range**: 0% to 300% (`deployer_fee_share` 0.0 to 3.0)
- **Growth mode cap**: 0% to 100% (capped to 1.0)
- Share is taken from the exchange fee portion, not additional charge to user

## Builder Fees

Front-ends (builders) can add fees on top of exchange fees:

- **Additive**: Builder fee is charged in addition to exchange fee
- **Pre-approval required**: User must call `approveBuilderFee` action first
- **maxFeeRate**: Builder fee rate stored as fraction of notional (NOT bps)
- **Total user debit**: `user_fee + builder_fee`

## Fee Trials

Time-limited fee rate overrides for promotional purposes:

- **Activation**: `startFeeTrial` action (CONFIRMED in binary)
- **Fields** (CONFIRMED from binary RE):
  - `validUntil` -- u64 timestamp
  - `c` -- counter/config value
  - `last_bucket` -- bucket guard tracking
- **Per-product rates**: Trials can override rates per product
- **Global disable**: `trials_disabled` field on FeeTracker
- When active, replaces the user's base rate entirely

## FeeSchedule (9 fields)

CONFIRMED from binary serde chain at `.rodata` 0x543b5d:

| Field | Type | Description |
|-------|------|-------------|
| `tiers` | Vec<(f64,f64,f64,f64,f64)> | VIP tier tables |
| `referral_discount` | f64 | Referral discount fraction (0.04) |
| `referrer_keep` | f64 | Fraction kept by referrer (1.0) |
| `extra_destination_fractions` | HashMap<Address, f64> | Extra fee routing |
| `stake_discount_tiers` | Vec<(f64, f64)> | Staking discount tiers |
| `weigh_spot_volume_double` | bool | Double-count spot volume |
| `aligned_quote_token_config` | Option<AlignedQuoteTokenFeeConfig> | 3 sub-fields |
| `mm_fees` | MmFees(2) | {maker_fraction_cutoff, add} |
| `vip_fees` | VipFees(3) | {ntl_cutoff, rates, staking_keep_frac_for_referrer} |

## FeeTracker (10 fields)

CONFIRMED from Locus.ftr in ABCI state:

| Field | Type | Description |
|-------|------|-------------|
| `fee_schedule` | FeeSchedule | Global fee config |
| `unrewarded_users` | HashSet<Address> | Users excluded from tier benefits |
| `user_states` | HashMap<Address, UserFeeState> | Per-user volume and tier |
| `referrer_states` | HashMap<Address, ReferrerState> | Per-referrer rebate tracking |
| `code_to_referrer` | HashMap<String, Address> | Referral code mapping |
| `referral_bucket_millis` | u64 | Rate-limit bucket interval |
| `total_fees_collected` | f64 | Total exchange fees (USD) |
| `total_spot_fees_collected` | f64 | Total spot fees (USD) |
| `collected_builder_fees` | f64 | Total builder fees (USD) |
| `trials_disabled` | bool | Global fee trial disable |

## Links

- [[Exchange State]] -- FeeTracker at Locus.ftr (field [3])
- [[Matching Engine]] -- fills trigger fee computation
- [[HIP-4 Outcomes]] -- outcome-specific fee logic
- [[Clearinghouse]] -- fee settlement updates balances

#fees #economics #exchange
