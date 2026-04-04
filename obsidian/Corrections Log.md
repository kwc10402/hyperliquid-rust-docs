# Corrections Log

Wrong assumptions caught and corrected during reverse engineering. Newest first.

## 2026-04-04

| Wrong assumption | Correction | Source |
|---|---|---|
| Signing: `keccak256(domain + content)` | `keccak256(domain + 0x00 + content)` — NULL byte separator | GDB capture |
| Signing content is msgpack | Content is **bincode** (misleading `rmp_signable.rs` filename) | GDB capture |
| App hash = single SHA-256 of all 14 | `first_16(SHA256(L1)) \|\| first_16(SHA256(EVM))` | Node log h=536290000 |
| Port 4001: 6-byte greeting, LE variant | 7-8 byte, **BE** variant (testnet=3, mainnet=2), kind byte in frame | Live peer test |
| Book price from `p` field | `p` is prev-pointer. Price at `c.l[0]` | 267K orders had wrong prices |
| Bridge2 `oaw` is JSON Value | `oaw` is **bool** | Binary deserializer |
| BSS accumulators are live | BSS is **stale heartbeat cache** | Never matches VoteAppHash |
| `szDecimals` fallback = 0 | Fallback = **5** | Price scaling divergence |
| Heartbeat has all 14 accumulators | **EVM only** (3 categories). L1 rebuilt from state. | Ghidra serializer trace |

## 2026-04-03

| Wrong assumption | Correction | Source |
|---|---|---|
| Hash uses compact msgpack | Uses **named** msgpack (map mode, camelCase keys) | Binary RE |
| Order fill hash is flat 9-field struct | **Externally-tagged enum**: `{"filled":{...}}` | Ghidra decompile |
| 12 L1 hash categories | **11 confirmed** from rodata | Binary at 0x65fb61 |
| Bridge2 `baloaw` is one field | Three fields: `bal`, `last_pruned_deposit_block_number`, `oaw` | Binary serde helpers |

## 2026-04-02

| Wrong assumption | Correction | Source |
|---|---|---|
| Bridge uses separate EOA keys | **Same key** as consensus signing | Binary string trace |
| Gossip peer accepts open connections | `connection_checks` verifies IP is known validator/sentry | Binary strings |
