# MIDEN_INTEGRATION.md

> **Retired from the live path, 2026-07-28.** Everything below is the accurate historical record of real engineering work (self-issued faucet, actor-thread `Send` fix, genesis bootstrap, all proven end-to-end on Miden's devnet) — kept, not deleted, per standing instruction. But live traffic no longer goes through it: the paper-key timelock now runs on real drand/tlock and double-submission prevention now runs on `SubmissionRegistry`'s own on-chain guard (knowledge_base.md §11o-§11q), because Miden's testnet RPC infrastructure never became reliably compatible with any published client version during this project's window. `contracts/miden/bridge/` still compiles and runs; nothing in `apps/api` calls it anymore.

**Network: Miden testnet only. There is no Miden mainnet as of this writing** ("alpha stage... NOT ready for production use," per the Miden protocol/VM repos). Every badge, log line, and doc referencing Miden in this project says "testnet" explicitly — see knowledge_base.md §2/§5.

## Why Miden, given that constraint

Two Miden primitives map directly onto real requirements and aren't available (in this documented form) anywhere else in the stack:

1. **P2IDE time-locked notes** (`timelock_height`) → cryptographic enforcement of "the exam paper's decryption key cannot be obtained before exam start," stronger than an app-level clock check.
2. **Nullifiers** → protocol-level "this note can't be consumed twice," which is exactly "a student can't submit their answer sheet twice."

Both are used as **defense-in-depth on top of**, not instead of, ordinary backend authorization — if Miden testnet is unreachable, the system fails closed (exam cannot start / submission cannot be accepted), it does not silently fall back to trusting the app server alone.

## Client setup

Backend (`apps/api`) uses the Rust `miden-client` via a small sidecar service (`contracts/miden/bridge`, a thin Axum HTTP binary called from `apps/api/src/lib/miden-bridge.ts` — Node doesn't have a first-party Miden client, so bridging to the real Rust SDK is required rather than reimplementing protocol logic in TS). Frontend (`apps/web`) uses `@miden-sdk/miden-sdk` + `@miden-sdk/react` directly for anything a student/teacher wallet must locally sign/prove (submission notes), consistent with Miden's client-side-proving model — the whole point is that the network never sees the student's raw answers, only a proof.

The Rust snippet below is the **real, verified-compiling** version (confirmed via a WSL Ubuntu build on 2026-07-26 — see "WSL build result" below; do not use the older snippet that used to be here, it had three real bugs). Full source: `contracts/miden/bridge/src/miden.rs`.

```rust
// contracts/miden/bridge/src/miden.rs — connects the service account to Miden testnet
let store = SqliteStore::new(PathBuf::from("miden-bridge-store.sqlite3")).await?;
let keystore = FilesystemKeyStore::new(keystore_path)?; // NOT generic — no <StdRng> etc.

// for_testnet() is real but unusable here: it takes zero arguments, so
// nothing pins the generic AUTH type parameter — replicate it manually so
// `.authenticator()`'s concrete argument type does the pinning instead.
let endpoint = Endpoint::testnet();
let client = ClientBuilder::new()
    .rpc(Arc::new(GrpcClient::new(&endpoint, 10_000)))
    .store(Arc::new(store))
    .authenticator(Arc::new(keystore.clone()))
    .build().await?;
```

```javascript
// apps/web — student-side note consumption at exam start
import { MidenClient } from "@miden-sdk/miden-sdk";
const client = await MidenClient.createTestnet();
await client.sync();
```

## Use 1 — Paper key timelock (P2IDE)

At paper-generation time (`docs/API_REFERENCE.md` → `POST /admin/papers/generate`), the service account wraps the master paper's AES content key and creates a P2IDE note. `P2ideNote` construction is a `bon`-generated builder (the underlying `#[builder] fn new(...)` is literally named `new`, which `bon` special-cases into a `::builder()` entry point to avoid the name clash) — `P2ideNoteStorage` is built internally from `sender`/`target`/`reclaimer`/heights, not constructed separately as an earlier version of this doc implied:

```rust
let note: Note = P2ideNote::builder()
    .sender(service_account_id)
    .target(service_account_id)      // self-targeting for now, see below
    .reclaimer(service_account_id)
    .reclaim_height(BlockNumber::from(reclaim_height))     // NOT Some(...) — bon setters
    .timelock_height(BlockNumber::from(timelock_height))   // for Option<T> fields take T
    .generate_serial_number(client.rng())
    .asset(key_asset)   // ← the one unresolved piece, see below
    .build()?
    .into();
```

**Real, confirmed constraint, not previously known**: `P2ideNote::new` rejects an empty asset list — *"a P2IDE note must contain at least one asset."* Miden notes carry *assets* (fungible/non-fungible), not arbitrary payloads, so sealing an AES key inside one needs a purpose-built asset (or non-fungible) encoding backed by a real faucet account — infrastructure this pass didn't provision. `contracts/miden/bridge/src/miden.rs` leaves this one step as an explicit, compiling `todo!()` rather than fabricating a bogus `Asset` value to force a green build.

- Before `timelock_height`: the note cannot be consumed by anyone — including the Admin service account itself. This is the cryptographic backbone of "no administrator can download the paper early."
- Between `timelock_height` and `reclaim_height`: the target (center/exam-session release account) may consume it, unwrapping the key.
- After `reclaim_height` if unconsumed: the original sender may reclaim it (safety valve — e.g. exam postponed).

`MidenNote` (Prisma) mirrors `{noteId, purpose: PAPER_KEY_TIMELOCK, status, timelockHeight, reclaimHeight}` for dashboard display; the mirror is refreshed by a sync worker polling `client.sync()`, never treated as authoritative (the Center's `/center/authorization/:paperId` endpoint re-checks the real note state before allowing exam start).

## Use 2 — Private submission commitment + nullifier

At submission time (`POST /student/exam/submit`), the student's client (browser, via `@miden-sdk/miden-sdk`) builds a **private** note carrying the answers' content-hash as note data, addressed to an "evaluation intake" account (P2ID-style: only that account can consume it). The student's own client proves this transaction locally — Miden's actor model means the network only sees a proof and a commitment, never the answer content.

- Committing the note = the tamper-evident "I submitted this exact ciphertext at this time" record.
- The evaluation intake account consuming it later (Evaluation Engine) marks its nullifier spent — a second submission attempt with a fresh note referencing the same session is rejected by the app layer using the session's `midenNoteId`/status before it would ever reach Miden, but if that check were ever bypassed, the protocol-level nullifier is the actual backstop.

## Why not do everything in Miden

Miden proves *account state transitions*, not arbitrary compute over large encrypted blobs (question banks, master papers). AI validation and paper assembly are therefore **not** Miden operations — they happen in `apps/api` / 0G Compute as documented in `SYSTEM_ARCHITECTURE.md`. Miden's job here is narrowly: prove/commit small facts (a key release condition, a submission commitment) with strong cryptographic guarantees, not host the whole pipeline.

## Windows build blocker — confirmed real, and resolved by building on WSL

`miden-client` (checked at both `0.15.4` and `0.16.0-alpha.1`) transitively depends on `miden-node-proto-build`, whose build script fails on native Windows with a reproducible include-path bug:

```
Error:   × file '...\miden-node-proto-build-<version>\proto\remote_prover.proto'
    │ is not in any include path
```

Confirmed this is **not**: a missing-`protoc` issue (installed a real one via winget; the build uses pure-Rust `protox`, which doesn't shell out to `protoc` at all — ruled out, not just assumed); a version-specific bug (reproduced on both the 0.15 and 0.16 lines); or a missing file (the `.proto` genuinely exists at that path — the include-path *computation* itself is broken, almost certainly a Windows path-separator bug in `protox::compile`'s caller).

**Resolution**: installed Ubuntu 24.04 under WSL2 (`wsl --install -d Ubuntu-24.04`), installed a Rust toolchain there, copied the project into WSL's native ext4 filesystem (not the `/mnt/c/...` Windows mount — cross-filesystem builds work but are slow), and ran `cargo check` there. **`miden-node-proto-build` compiled clean on the first try** — confirming the diagnosis. Build/run `contracts/miden/bridge` from WSL or a Linux CI runner; it does not build on native Windows and that's an upstream bug, not something to keep working around here.

## API corrections found via the WSL build (real compiler feedback, not docs.rs guesses)

The docs.rs research below this point (done before the WSL build was possible) got the shapes right in spirit but wrong in several specifics — docs.rs's rendered pages don't always match what a given pinned version actually compiles to, especially in an alpha-stage crate. These corrections came from the real compiler against real downloaded crate source, the same discipline used throughout this project:

1. **Version pinning is load-bearing.** `miden-client` 0.15.4 depends on `miden-protocol` 0.15.3; `miden-standards` (latest, 0.16.0-beta.1) depends on `miden-protocol` 0.16.0-beta.1. Mixing them produces two incompatible `Account` types in the dependency graph (a real `E0308` type mismatch, not a hypothetical). The fix: `miden-client = "=0.16.0-alpha.1"` pairs with `miden-standards = "=0.16.0-alpha.4"` and `miden-protocol = "=0.16.0-alpha.4"` **exactly** (confirmed by reading miden-client's own `Cargo.toml`) — pin all three explicitly rather than letting Cargo's resolver pick a newer prerelease that satisfies the version string but not the crate's actual internal API dependency.
2. `BasicWallet`/the auth component live in a separate crate, **`miden-standards`**, not `miden-client`, not `miden-lib`, not `miden-base` (that one's the WASM/component-authoring SDK, repo `0xMiden/compiler` — a different thing entirely).
3. `miden_standards::account::wallets::create_basic_wallet(init_seed: [u8; 32], approver: Approver, account_type: AccountType) -> Result<Account, AccountError>` — confirmed real, one-call convenience constructor.
4. `miden_standards::account::auth::Approver::from(&PublicKey) -> Self` (preferred) or `Approver::new(pub_key: PublicKeyCommitment, auth_scheme: AuthScheme)`.
5. `AuthSecretKey::new_falcon512_poseidon2_with_rng<R: Rng>(rng: &mut R) -> Self` — **not** `new_rpo_falcon512` (doesn't exist; that was an unverified guess in an earlier pass of this doc, now corrected).
6. `AccountType` has exactly two variants in this version: `Private`, `Public` — not `RegularAccountUpdatableCode`-style names from an older API generation.
7. `FilesystemKeyStore` is **not generic** (no `<StdRng>` or similar) — `FilesystemKeyStore::new(keys_directory: PathBuf) -> Result<Self, KeyStoreError>`, implements `Clone` and the `Keystore` trait (import it to get `.add_key()` into scope).
8. `SqliteStore` is **not** in `miden-client` at all — it's a separate crate, `miden-client-sqlite-store`, `SqliteStore::new(database_filepath: PathBuf) -> Result<Self, StoreError>` (async).
9. `Client::add_account(&mut self, account: &Account, overwrite: bool)` — takes a single `&Account`, not `&[Account]`.
10. `BlockNumber` is at `miden_client::block::BlockNumber`.
11. `P2ideNoteStorage::new` takes **four** arguments now: `(reclaimer: AccountId, target: AccountId, reclaim_height: Option<BlockNumber>, timelock_height: Option<BlockNumber>)` — reclaimer and target are now explicit and separate, where an earlier API generation implied only one account id.
12. `P2ideNote` construction is a `bon`-generated builder (`P2ideNote::builder()...build()`), not a plain `P2ideNote::create(...)` function — and its `Option<T>`-typed builder setters (`reclaim_height`, `timelock_height`) take `T` directly, not `Option<T>` (calling the setter implies `Some`; omitting it means `None`).
13. `ClientBuilder::for_testnet()` is real and does compile as part of the crate, but is **unusable as documented**: it takes zero arguments, so nothing pins the generic `AUTH` type parameter at the call site, and neither plain inference nor an explicit turbofish resolves it (a real rustc method-resolution limitation through a blanket-impl'd marker trait, `BuilderAuthenticator`, not a mistake in our code). Workaround: replicate what `for_testnet()` does internally (`Endpoint::testnet()` + `GrpcClient::new(&endpoint, timeout)` via `.rpc(...)`), letting `.authenticator(Arc::new(keystore.clone()))`'s concrete argument type pin `AUTH` instead. `GrpcClient` needs the `tonic` Cargo feature enabled explicitly.

## Asset requirement — precisely scoped, not guessed at

`P2ideNote::new` requires at least one asset. Narrowed down further in a follow-up session: this is **`P2ideNote::new`'s own business-logic check**, not a protocol constraint — `NoteAssets::new(Vec<Asset>)` at the protocol level accepts an empty vector fine (confirmed by reading its source: it only rejects >64 assets or duplicates). A generic/custom note type could skip this, but then we'd lose P2IDE's actual value — the timelock/reclaim enforcement lives in the P2IDE note's *script* (MASM, executed on consumption), not in `P2ideNoteStorage` alone, and reimplementing that ourselves is out of scope. So a real asset is genuinely required if we want P2IDE's real enforcement.

**Explicitly considered and rejected**: `miden_protocol::testing::asset` provides `NonFungibleAsset::mock()`/`FungibleAsset::mock()`, gated behind the `testing` Cargo feature, which would satisfy the type system — but they're issued by fake, non-existent faucet IDs (`ACCOUNT_ID_PUBLIC_*_FAUCET` testing constants), fine for Mockchain unit tests but rejected by the real Miden testnet. Using `.mock()` in the real code path would be exactly the kind of hidden fake this project's no-mocks rule exists to prevent, so `contracts/miden/bridge/src/miden.rs` doesn't use it — the gap stays an honest `todo!()`.

**Real options, neither implemented yet**:
1. Provision our own faucet account, then mint + consume a token before `create_paper_key_timelock` runs. Confirmed via source this is meaningfully more setup than the wallet account: `miden_standards::account::faucets::fungible::create_singlesig_user_fungible_faucet(init_seed, faucet: FungibleFaucet, auth_component: AuthSingleSigAcl, token_policy_manager: TokenPolicyManager, account_type: AccountType)` needs an ACL-based auth component and a policy manager, neither of which this pass researched the constructors for.
2. Fund the service account from Miden's own public testnet faucet — documented at the CLI level (`miden mint --target-account <ID> --amount 1000`, per `miden_context.md`), but the programmatic (non-CLI) equivalent wasn't located in `miden-client`'s own source; it likely lives in the separate `miden-client-cli` crate, not researched in this pass.

**Important simplification this research surfaced**: the actual AES key material was **never going to be transportable through the Miden asset system anyway** — `NonFungibleAsset` only ever stores a *hash* of its data on-chain (`Hasher::hash(asset_data)`), never the raw bytes (confirmed by reading `NonFungibleAsset::new`'s implementation). So "encode the key in the asset" was based on a wrong mental model from the start. The correct pattern: the asset's only role is to be *the thing whose transfer this specific transaction proves is timelock-gated* — a generic, minimal, really-held asset works exactly as well as an elaborate custom one. The actual AES key stays in the bridge's own storage the whole time (it's generated by `apps/api`, which is what needs strong isolation from it, not Miden), released by the bridge only after it has successfully proved and submitted a real consume-transaction against the real network. This means whichever of the two options above gets picked, it doesn't need to encode anything — it just needs to be *a real asset the service account legitimately holds*.

## Live runtime verification (not just compiling — actually run)

`mod miden` is now wired into `main.rs` via Axum shared state, built once at startup: `GET /health` and `GET /notes/:noteId/status` are real (the two creation endpoints stay honest 501s pending the asset question above — wiring them would trade a 501 for a `todo!()` panic on every call).

This was **actually run**, not just compiled — `cargo build` (full codegen, ~8 min for this dependency tree) then the resulting binary directly, in WSL. Real, observed results:

```
building Miden testnet client...
provisioning service account...
service account ready service_account_id=0x9232be7e324315017cfa661ba0b507
nvei-miden-bridge listening on :50151 (Miden testnet only)
```

```bash
$ curl http://localhost:50151/health
{"network":"testnet","ok":true,"service":"nvei-miden-bridge","serviceAccountId":"0x9232be7e324315017cfa661ba0b507"}

$ curl http://localhost:50151/notes/0x0011.../status   # well-formed but nonexistent NoteId
{"found":false,"noteId":"0x0011..."}

$ curl -X POST http://localhost:50151/notes/paper-key-timelock
{"error":"Not implemented yet — blocked on a real Miden asset ...", "path":"/notes/paper-key-timelock"}
```

Confirmed real, not fabricated: a genuine cryptographic account ID gets generated by real `AccountBuilder`/`create_basic_wallet` logic (no network call needed for this — consistent with "accounts become visible onchain only when they undergo a state change"), the real `NoteId::try_from_hex` parser correctly rejects malformed input and correctly reports "not found" for a well-formed-but-unknown id via a real `client.get_input_note()` call against the real local store, and the still-blocked endpoints return their honest, specific 501 rather than crashing.

**Two things this surfaced, both real and worth tracking**:
1. **The service account is not persisted across restarts** — `provision_service_account` generates a fresh random `init_seed` every time `main()` runs, so each restart gets a *different* account ID (observed directly: two separate runs produced `0x79d83b18...` and `0x9232be7e...`). For this to be useful beyond a single process lifetime, the account (and its keystore) needs to be created once and then loaded on subsequent starts — not implemented yet, a real follow-up.
2. **Two `ERROR`-level log lines appear during account provisioning on every run**: `miden_core::mast::serialization: UntrustedMastForest expected HASHLESS input; supplied artifact includes wire node hashes...`. The process continues and succeeds despite them (not fatal), but they're logged at `ERROR` severity during otherwise-successful operation — worth a closer look before this ever runs unattended in a real deployment, not investigated further in this pass.

**Current state overall**: `contracts/miden/bridge` compiles clean *and runs* on WSL with the real `miden-client`/`miden-standards`/`miden-client-sqlite-store` dependencies, and its account-provisioning + health/status endpoints are verified working end-to-end against real (if freshly-generated) Miden client state. Do not re-derive the API surface above from scratch; start from these confirmed facts.

## Testing

Local development uses the **Mockchain** (`MidenClient.createMock()` / Rust `Mockchain` builder) so the P2IDE-timelock and submission-note flows can be integration-tested without live testnet dependency and without waiting on real block heights. CI runs these mock-chain tests on every PR; a separate, manually-triggered pipeline exercises the same flows against live Miden testnet before any demo, per Miden's own recommended split ("mock client for logic tests, local/live node when you need real node state").
