Subject: [Urgent] testnet rejecting the latest published miden-client (0.16.0-alpha.1) — hard deadline tomorrow

Hi Miden team,

I'm building on Miden as part of a project with a hard deadline tomorrow (YC Summer batch application), and I've hit what looks like a live infrastructure issue on your public testnet, not a bug in my own code. Would really appreciate a fast read on whether this is a known issue and whether it's likely to resolve in the next 24 hours.

**What I'm seeing**

Using `miden-client` version `0.16.0-alpha.1` (the newest version published on crates.io — I checked, there's nothing newer to upgrade to), the very first RPC call against `rpc.testnet.miden.io` — fetching the genesis block header, before any account/transaction logic even runs — is rejected by the server:

```
RPC error

Caused by:
    0: accept header validation failed
    1: server rejected request - please check your version and network settings (client version: 0.16.0-alpha.1, genesis commitment: none)
```

This happens on `Client::ensure_genesis_in_place()`'s call to `get_block_header_by_number(Some(BlockNumber::GENESIS), false)` — i.e. the client's mandatory first-ever call to bootstrap genesis state, before it has any commitment to send. So this isn't a stale-commitment issue on my end; the server appears to be rejecting the client purely by its declared `accept: application/vnd.miden; version=0.16.0-alpha.1` header.

**Testnet vs devnet comparison (to rule out a local bug)**

I tested the identical client/binary against `rpc.devnet.miden.io` as a comparison:
- One run got all the way through genesis sync and into real transaction execution (so the client code itself is correct and does work against a compatible server).
- Two subsequent runs against the same devnet endpoint hit the identical version-rejection error.

That inconsistency (same client, same endpoint, different outcomes across runs) suggests devnet is sitting behind a load balancer with multiple backend replicas at different software versions mid-rollout — and testnet may be in a similar state, or simply hasn't started the rollout yet.

**What I need to know**

1. Is testnet (and/or devnet) currently mid-upgrade to accept protocol-0.16 / `miden-client` 0.16.0-alpha.1 clients?
2. If so, is there an ETA — ideally within the next 24 hours?
3. If not, is there a supported client/server version pair I should pin to instead that's known to work against the current live testnet today? (Note: I do need the 0.16 line specifically for `miden-standards`' faucet/policy APIs — `TokenPolicyManager`, `MintPolicy`/`BurnPolicy`, `AuthSingleSigAcl`, `create_singlesig_user_fungible_faucet` — which I use to self-issue an internal asset for a P2IDE note. If there's an older stable combination that still exposes equivalent faucet-creation APIs, that's also a viable path for me.)

Happy to share the full reproduction repo/logs if useful. Given the deadline, any pointer — even just "yes it's mid-rollout, give it N hours" — would be hugely helpful.

Thanks,
[your name]
