# MAINNET_DEPLOYMENT.md

Specifically about going live against **0G Chain mainnet (Aristotle, chain 16661)** and **drand mainnet (quicknet)** — real gas, real money, real public transactions. See [DEPLOYMENT.md](DEPLOYMENT.md) for the general hosting shape first.

This isn't a hypothetical checklist — every step below has already been executed for real in this project (knowledge_base.md §11k, §11p) and this doc is the accurate record of what that took, so a future deployment doesn't have to rediscover it.

## Prerequisites — real credentials, nothing simulated

1. **A funded 0G mainnet EVM wallet.** Its private key is `ZG_SERVICE_PRIVATE_KEY`. It pays gas for every contract deployment and every registry anchor tx at runtime, and signs every 0G Storage upload.
2. **A 0G Compute API key with `private` trust mode access.** Create at [pc.0g.ai](https://pc.0g.ai) → Dashboard → API Keys, with `inference` permission. This is what routes AI validation calls to a real TeeML-attested provider.
3. Everything else in `apps/api/.env.example` filled in for the `mainnet` values specifically (see below).

## Step 1 — Deploy the five registry contracts

```bash
npm run contracts:deploy:mainnet
```

Runs `contracts/evm/scripts/deploy.ts` against `zg_mainnet` (Hardhat network config in `contracts/evm/hardhat.config.ts`), using `ZG_SERVICE_PRIVATE_KEY`. Writes real addresses to `contracts/evm/deployments/zg_mainnet.json`. Copy those five addresses into `apps/api/.env`'s `QUESTION_REGISTRY_ADDRESS` / `PAPER_REGISTRY_ADDRESS` / `SUBMISSION_REGISTRY_ADDRESS` / `RESULT_REGISTRY_ADDRESS` / `AUDIT_LOG_REGISTRY_ADDRESS`.

This project's own deployed mainnet addresses (from the 2026-07-26 run, knowledge_base.md §11k) are recorded there if you want a reference for what a real deployment looks like — they are this project's actual contracts, still live on mainnet.

## Step 2 — Point `.env` at mainnet everywhere, not just the chain RPC

Every one of these needs to agree — mixing testnet and mainnet values across them is the most likely real mistake:

| Var | Mainnet value |
|---|---|
| `ZG_NETWORK` | `mainnet` |
| `ZG_RPC_URL` | `https://evmrpc.0g.ai` |
| `ZG_CHAIN_ID` | `16661` |
| `ZG_STORAGE_INDEXER_URL` | `https://indexer-storage-turbo.0g.ai` |
| `ZG_COMPUTE_ROUTER_URL` | `https://router-api.0g.ai/v1` |
| `TLOCK_NETWORK` | `mainnet` (drand mainnet quicknet — the only network this project has actually run tlock against, see knowledge_base.md §11p) |

## Step 3 — Verify each dependency independently before trusting the app's own dashboards

This project's own discipline (every "proven live" claim in knowledge_base.md was independently re-checked, not just trusted from the app's DB) applies to a fresh deployment too:

- `curl https://evmrpc.0g.ai` (or use `getChainBlockNumber()` via `GET /admin/system-health` / `GET /observer/system-health`) — confirms RPC reachability before you spend gas on anything.
- After the first real anchor tx, fetch its receipt directly: `https://chainscan.0g.ai/tx/<hash>` — don't just trust `GET /admin/blockchain-events`, which is explicitly a read-optimized Postgres mirror, not the source of truth (docs/DATABASE.md).
- After the first real drand/tlock seal, the round number logged (`"Paper generation complete — tlock timelock sealed"`) is independently checkable against `https://api.drand.sh/<quicknet-chain-hash>/public/<round>`.

## Real costs to expect

- **Gas**: five contract deployments (one-time), then one `anchor*` tx per question/paper/submission/result. Each is a normal 0G Chain EVM transaction — check current gas prices on `explorer.0g.ai` before a bulk import of questions.
- **0G Compute**: one `private`-trust-mode inference call per question validation. Real, metered, per pc.0g.ai's pricing at the time.
- **0G Storage**: one upload per question/paper/answer blob. Metered per the indexer's own pricing.
- **drand/tlock**: free — drand's public beacon API has no cost; `tlock-js` only makes HTTP GETs to `api.drand.sh`.

## Rollback / safety notes

- There is no "undo" for an on-chain anchor — `AuditLogRegistry`/`QuestionRegistry`/etc. are append-only by design (that's the point). A mistaken anchor is a permanent, public fact; the mitigation is care before anchoring (this project's own two Papers stuck at `ASSEMBLING` from before the tlock migration, knowledge_base.md §11l/§11m, were left in place rather than "fixed" retroactively, for exactly this reason).
- `Paper.status` reaching `READY` releases a real timelock commitment — once a paper is generated with a real `examStartAt` in the near future, there's no way to "pause" the drand round from arriving. Double-check `examStartAt`/`examWindowCloseAt` before generating a real paper against mainnet.
- Rotate `ZG_SERVICE_PRIVATE_KEY` independently of any other credential if it's ever suspected of leaking — see knowledge_base.md §11k's "credential hygiene incident" for a real instance of this exact risk (a key pasted into the wrong, non-gitignored file) and how it was caught.
