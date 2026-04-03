# Action Inventory

This page is the action-surface companion to the [Yellow Paper](./index.md). It collects the current repo truth on:

- top-level action families
- high-frequency wire actions
- important sub-variant enums discovered from the binary
- which parts of the system each family primarily touches

Primary supporting notes:

- [Action Types](../obsidian/Action%20Types.md)
- [Hypurrliquid Paper action chapter](../paper/index.html#actions)
- [Block Lifecycle](../block-lifecycle/index.html)

## 1. High-Frequency Action Surface

From the current 2.3-hour mainnet sample in the notes:

| Action | Count | Share |
| --- | ---: | ---: |
| `order` | 1,422,571 | 68.2% |
| `cancelByCloid` | 348,407 | 16.7% |
| `cancel` | 219,274 | 10.5% |
| `evmRawTx` | 36,189 | 1.7% |
| `noop` | 23,817 | 1.1% |
| `batchModify` | 18,728 | 0.9% |
| `scheduleCancel` | 5,216 | 0.3% |
| `updateLeverage` | 2,952 | 0.1% |
| `SetGlobalAction` | 1,271 | 0.1% |
| `ValidatorSignWithdrawal` | 1,177 | 0.1% |

Practical implication: a working node lives or dies first on trading, cancels, and the surrounding execution pipeline, even though the protocol surface is much broader.

## 2. Top-Level Action Families

### 2.1 Trading

| Wire name | Purpose | Main state touched |
| --- | --- | --- |
| `order` | place order | books, balances, positions |
| `cancel` | cancel by asset/order id pairs | books, open-order indices |
| `cancelByCloid` | cancel by client order id | cloid routing, books |
| `modify` | cancel + replace | books, order identity |
| `batchModify` | multi-leg modify | books |
| `scheduleCancel` | delayed or condition-based cancel surface | user cancel scheduling |
| `twapOrder` | create TWAP | TWAP tracker |
| `twapCancel` | cancel TWAP | TWAP tracker |
| `liquidate` | explicit liquidation entry | clearinghouse / liquidation |

### 2.2 Account and User Controls

| Wire name | Purpose | Main state touched |
| --- | --- | --- |
| `updateLeverage` | change leverage | user margin config |
| `updateIsolatedMargin` | adjust isolated margin | isolated state |
| `topUpStrictIsolatedMargin` | top up strict isolated mode | isolated state |
| `approveAgent` | approve API/agent signer | agent tracker |
| `approveBuilderFee` | builder fee approval | builder-fee state |
| `setReferrer` | set referral state | referral state |
| `setDisplayName` | set display name | display-name map |
| `userPortfolioMargin` | opt into PM mode | user mode state |
| `userDexAbstraction` | user abstraction config | routing / mode state |
| `userSetAbstraction` | user abstraction mode | routing / mode state |
| `agentSetAbstraction` | agent abstraction config | routing / mode state |

### 2.3 Transfers

| Wire name | Purpose | Main state touched |
| --- | --- | --- |
| `usdSend` | USDC transfer | balances |
| `usdClassTransfer` | USD-class transfer | balances / class routing |
| `spotSend` | spot token transfer | spot balances |
| `sendAsset` | cross-universe/general asset transfer | routing + balances |
| `withdraw3` | withdrawal v3 | bridge / balances |
| `subAccountTransfer` | sub-account value transfer | sub-account tracker |
| `subAccountSpotTransfer` | sub-account spot transfer | sub-account tracker + spot |
| `sendToEvmWithData` | L1 -> EVM transfer with calldata | EVM bridge surface |

### 2.4 Vaults

| Wire name | Purpose | Main state touched |
| --- | --- | --- |
| `createVault` | create vault | vault registry |
| `vaultTransfer` | deposit/withdraw | vault balances |
| `vaultDistribute` | distribute vault funds | vault accounting |
| `vaultModify` | modify vault params | vault config |
| `netChildVaultPositions` | reconcile child vault positions | vault children |
| `setVaultDisplayName` | label vault | vault metadata |

### 2.5 Staking and Validator

| Wire name | Purpose | Main state touched |
| --- | --- | --- |
| `tokenDelegate` | delegate / undelegate | staking |
| `claimRewards` | claim rewards | staking |
| `linkStakingUser` | link staking identity | staking link tracker |
| `registerValidator` | validator registration | validator profile/state |
| `extendLongTermStaking` | extend lock | staking |
| `CValidator` | validator profile/admin actions | `c_staking` |
| `CSigner` | signer control / jailing lane | `c_staking` |
| `validatorL1Vote` | oracle vote | validator vote tracker |
| `validatorL1Stream` | stream / rate vote | validator stream tracker |

### 2.6 Governance and Control

| Wire name | Purpose | Main state touched |
| --- | --- | --- |
| `SetGlobalAction` | broadcaster global state update | oracle / config / prices |
| `govPropose` | governance proposal | governance state |
| `govVote` | governance vote | governance state |
| `voteAppHash` | validator app-hash vote | app-hash vote tracker |
| `ForceIncreaseEpoch` | force epoch advance | staking epoch state |

### 2.7 Bridge and EVM

| Wire name | Purpose | Main state touched |
| --- | --- | --- |
| `evmRawTx` | raw EVM transaction | HyperEVM + CoreWriter |
| `VoteEthDeposit` | vote ETH deposit | bridge vote tracker |
| `ValidatorSignWithdrawal` | sign bridge withdrawal | bridge vote tracker |
| `VoteEthFinalizedWithdrawal` | finalize withdrawal | bridge vote tracker |
| `VoteEthFinalizedValidatorSetUpdate` | finalize validator-set update | bridge vote tracker |
| `signValidatorSetUpdate` | sign bridge validator-set update | bridge vote tracker |

### 2.8 Special / System

| Wire name | Purpose | Main state touched |
| --- | --- | --- |
| `noop` | no-op / heartbeat | none |
| `multiSig` | wrapper / redispatch | multisig tracker |
| `convertToMultiSigUser` | promote user to multisig | multisig tracker |
| `borrowLend` | BOLE operations | BOLE |
| `userOutcome` | outcome user ops | outcomes |
| `spotDeploy` | spot deploy surface | spot config |
| `perpDeploy` | HIP-3/HIP-4 deploy surface | perp deploy / outcomes |
| `ReassessFees` | fee tier reassessment | fee tracker |
| `ReserveRequestWeight` | BOLE reserve request weighting | BOLE |
| `FinalizeEvmContract` | finalize EVM contract | HyperEVM |

## 3. Important Sub-Variant Enums

### 3.1 VoteGlobalAction

Current binary-derived sub-variants include:

- `SetPerpDexDailyPxRange`
- `SetReserveAccumulator`
- `SetOutcomeFeeScale`
- `ModifyCStakingPeriods`
- `SetPerpDexMaxNUsersWithPositions`
- `UserIsUnrewarded`
- `SetPerpDexTransferLimits`
- `SetPerpDexOpenInterestCap`
- `HaltPerpTrading`
- `ModifyReferrer`
- `UnjailSigner`
- `DisableCValidator`
- `UserCanLiquidate`
- `ModifyNonCirculatingSupply`
- `CancelUserOrders`
- `DisableNodeIp`
- `SetMaxOiPerSecond`
- `QuarantineUser`
- `ResetHip3PxAlert`
- `SetEvmBlockDuration`
- `SetEvmPrecompileEnabled`
- `SetHip3BackstopLiquidatorParams`
- `DeployGasAuctionChange`
- `CValidator`
- `SetCoreWriterActionEnabled`
- `ModifyBroadcaster`

### 3.2 SpotDeployAction

- `RegisterHyperliquidity`
- `RegisterSpot`
- `SetFullName`
- `UserGenesis`
- `RegisterToken2`
- `SetDeployerTradingFeeShare`
- `RevokeFreezePrivilege`
- `FreezeUser`
- `RequestEvmContract`
- `Genesis`
- `EnableFreezePrivilege`
- `EnableAlignedQuoteToken`
- `EnableQuoteToken`

### 3.3 Hip3DeployAction / PerpDeploy

- `registerAsset`
- `registerAsset2`
- `setOracle`
- `setSubDeployers`
- `setPerpAnnotation`
- `setFeeScale`
- `setFeeRecipient`
- `haltTrading`
- `insertMarginTable`
- nested `OutcomeDeploy`

### 3.4 OutcomeDeploy

- `RegisterQuestion`
- `RegisterOutcome`
- `RegisterNamedOutcome`
- `ChangeOutcomeDescription`
- `SettleOutcome`
- `ChangeQuestionDescription`
- `RegisterOutcomeToken`
- `RegisterTokensAndStandaloneOutcome`

### 3.5 SetBole

- `BackstopLiquidatorTokenParams`
- `Adl`
- `TestnetAction`
- `RateLimit`
- `ResetIndex`
- `Reserve`

### 3.6 CValidatorAction

- `Register`
- `ChangeProfile`

## 4. Binary Expansion Since the 2026-04-03 Testnet Pass

The current testnet binary surfaced additional actions beyond the older top-level count. Notable newly surfaced names include:

- `GossipPriorityBidAction`
- `ReserveRequestWeightAction`
- `SystemAlignedQuoteSupplyDeltaAction`
- `DeployerSendToEvmForFrozenUserAction`
- `SystemUsdClassTransferAction`
- `FinalizeEvmContractAction`
- `SubAccountSpotTransferAction`

This is one reason the repo separates:

- protocol truth
- chain-specific implementation truth
- local implementation coverage

## 5. Practical Reading Order

If you are trying to implement or review execution:

1. read [Block Lifecycle](../block-lifecycle/index.html)
2. read [Liquidation & ADL](../liquidation/index.html)
3. use [Action Types](../obsidian/Action%20Types.md) for the broader catalog
4. use [Claims Index](../findings/claims-index.md) and [Open Claims](../status/open-claims.md) for unresolved edges
