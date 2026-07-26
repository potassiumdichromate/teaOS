# Miden — Developer Context

> Compiled reference notes for building on Miden (0xMiden), assembled from `https://docs.miden.xyz/llms.txt`, `https://docs.miden.xyz/skill.md` (Miden's own compact AI-assistant routing map), a full crawl of the 265-page current stable docs tree (everything under `docs.miden.xyz/builder/*` and `docs.miden.xyz/reference/*`, served unversioned — the site's own convention for "latest stable," currently **v0.14**, deliberately excluding both the archived `/0.1x/` snapshots and the `/next/` v0.15-unstable docs), and a survey of the `github.com/0xMiden` organization (52 repositories) plus npm registry checks for the published SDK packages.
>
> **What Miden is, in one paragraph**: a privacy-preserving ZK rollup where accounts are programmable smart contracts and *users themselves* execute and prove transactions locally on their own devices — the network only ever receives a validity proof and a state commitment, never the underlying computation or (for private accounts/notes) the data itself. This is a fundamentally different trust model from a typical EVM chain or even a typical rollup: there is no sequencer or centralized prover computing on your behalf by default: "not only maintain and update their own state, but they can also prove the validity of their own state transitions to the rest of the network," as Miden's own docs put it.
>
> **⚠️ Version-drift warning — read before trusting anything version-specific here**: this compile has a directly-observed internal inconsistency worth flagging up front. The docs site labels its unversioned/"current" tree as v0.14 (per `skill.md`'s `docs_default: "0.14 (latest stable)"`), yet (a) the actual published npm packages `@miden-sdk/miden-sdk` and `@miden-sdk/react` are already at **0.15.8** at time of writing, and (b) the "current" (non-`/next/`) migration guide is explicitly titled **"Miden 0.15 Migration"** and documents changes *from* 0.14 *to* 0.15. In other words, parts of the nominally-"stable-0.14" docs tree already describe 0.15 behavior. Treat every concrete field name, formula, and API signature below as "accurate as observed on the date of this crawl" and re-verify against the live `https://docs.miden.xyz/llms.txt` before relying on it for anything version-sensitive — this is a fast-moving alpha-stage protocol (Miden's own `protocol` and `miden-vm` repo READMEs both carry an explicit "WARNING: This project is in an alpha stage... NOT ready for production use" banner), and **there is no mainnet yet** — only testnet and devnet exist.

## Table of Contents

1. [What Is Miden — Core Concepts](#file-01_core_concepts) — actor model, notes vs. accounts, client-side proving, privacy-by-default, the "Common Pitfalls" list from Miden's own AI-assistant skill file
2. [Get Started — Installation, CLI, First Contract](#file-02_get_started) — `midenup` toolchain install, CLI basics, the counter-contract walkthrough, FAQ, glossary
3. [Accounts](#file-03_accounts) — builder-level account model: types, storage, components, custom types, operations, cryptography, authentication
4. [Notes](#file-04_notes) — note scripts, note types (P2ID/P2IDE/SWAP/PSWAP/MINT/BURN), output notes, reading notes
5. [Transactions & Cross-Component Calls](#file-05_transactions) — transaction context, transaction scripts, the advice provider, cross-component calls, design patterns
6. [Core SDK Types & Standard Components](#file-06_sdk_types) — Felt/Word/AccountId/Asset and the standard component library (wallets, auth, policies, access control)
7. [Client SDKs — Rust, Web, React](#file-07_client_sdks) — full API surface of all three official clients, plus common errors and local-node testing
8. [Tutorials — Miden Bank & Recipes](#file-08_tutorials) — the flagship 9-part end-to-end tutorial, plus the recipe catalog and dev helpers (testing/debugging/pitfalls)
9. [Miden Guardian — Assisted Self-Custody](#file-09_guardian) — OpenZeppelin's off-chain coordination layer, deltas/canonicalization, the multisig SDK (directly relevant to threshold-custody designs)
10. [Protocol Reference — The Deep Formal Spec](#file-10_protocol_reference) — precise account/note/transaction/asset/state/blockchain/fee formulas, including the **exact** RECIPIENT and nullifier hash formulas
11. [Miden VM](#file-11_miden_vm) — STARK-based stack machine architecture, performance benchmarks, MASM, core library
12. [Compiler](#file-12_compiler) — the Rust → Wasm → MASM pipeline (`midenc`, `cargo-miden`)
13. [Node & RPC](#file-13_node_rpc) — node services (sequencer/full node/validator/NTX-builder/remote prover), full public RPC method list, official network URLs
14. [GitHub Organization Catalog](#file-14_github_catalog) — all 52 `0xMiden` repos, plus verified npm package names/versions
15. [Building with Miden + 0G — Bridging Notes](#file-15_bridge) — how this maps onto the exam-paper-leak-prevention design, with corrections to what was said earlier in conversation now that the formal spec has been checked

---

<a id="file-01_core_concepts"></a>

# What Is Miden — Core Concepts

> Source: `docs.miden.xyz/skill.md`, `builder/faq/`, `builder/glossary/`, `builder/smart-contracts/overview/`

## The actor-model mental shift

Miden's single biggest departure from EVM-style chains: **a transaction is the state transition of exactly one account.** Sending assets between two parties is therefore *two* transactions, not one — the sender's transaction creates a note (a sealed, addressed "envelope"), and a separate transaction by the recipient consumes it. This is deliberate: it lets every account's state transitions be executed and proved independently and in parallel, and it's what makes client-side (rather than sequencer-side) proving tractable at all.

## Key mental-model shifts, verbatim from Miden's own skill file

- **Transactions involve one account.** Sending assets usually means one transaction creates a note and another transaction consumes it.
- **Notes are programmable messages.** A note carries assets plus script logic that controls how it can be consumed.
- **Privacy is the default.** Private accounts and notes reveal commitments on-chain, not full state.
- **Users prove transactions.** Clients execute transactions, produce proofs, and submit proven state transitions to the network.
- **State is account-centric.** Accounts own storage, vault assets, code, and nonce; account updates can be processed independently.
- **MASM is still relevant.** Rust smart contracts compile down to Miden Assembly, and some low-level account, note, and transaction logic is still authored or debugged in MASM.

## FAQ highlights (full list)

- **Privacy mechanism**: "Miden leverages zero-knowledge proofs and client side execution and proving to provide security and privacy."
- **Encrypted notes**: *"At the moment, Miden does not have support for encrypted notes but it is a planned feature."* — important: privacy on Miden today comes from keeping data **off-chain** (private storage mode reveals only a commitment), not from the protocol natively encrypting on-chain payloads. If you need the actual bytes encrypted, you encrypt at the application layer before they ever become note inputs/storage.
- **Delegated proving**: exists because proof generation is too computationally intensive for many end-user devices; it separates transaction creation, proof generation, and verification, and lets specialized hardware handle the STARK math. This means resource-constrained clients (e.g. embedded devices) are not stuck doing local proving.
- **Transaction lifecycle** (8 stages): creation and signing → submission to network mempool → sequencer selection and bundling → execution on the Miden VM → STARK proof generation → block assembly with recursive proofs → L1 submission with verification → finalization with state updates.
- **Time-conditioned note consumption**: *"Yes, Miden enables consumption of notes based on time conditions, such as: A specific block height being reached, A timestamp threshold being passed, An oracle providing specific data, Another transaction being confirmed."* — this is stated as a general capability, not limited to the one built-in P2IDE note type (see [Notes](#file-04_notes) and the [bridging synthesis](#file-15_bridge)).
- **Operator role**: runs sequencer nodes, operates prover infrastructure, submits proofs to L1, maintains data availability, participates in consensus.
- **Bridging**: *"Miden does not yet have a fully operational bridge, work in progress"* — see [testnet-sandbox bridge](#file-07_client_sdks) for what exists today (Sepolia↔Miden-testnet only).
- **Fee model**: the FAQ page says *"Miden does not yet have a fully implemented fee model, work in progress."* **This directly contradicts the formal protocol reference**, which describes a fully implemented logarithmic fee formula — see the explicit caveat in [Protocol Reference § Fees](#file-10_protocol_reference).

## Glossary — the terms worth knowing cold

| Term | Definition (verbatim from the glossary) |
|---|---|
| Account | "A data structure that represents an entity (user account, smart contract) on the Miden blockchain — analogous to smart contracts." |
| AccountCode | "The executable code associated with an account." |
| AccountComponent | "A modular unit of code representing a piece of an account's functionality. Each `AccountCode` is composed of multiple `AccountComponent`s." |
| AccountStorage | "A key-value store associated with an account. Made up of storage slots." |
| MultiSig | "A multi-signature account on Miden that requires a configurable threshold (N-of-M) of authorized signers to approve transactions before execution." |
| Note | "A fundamental data structure that represents an offchain asset or a piece of information that can be transferred between accounts." |
| Note script | "A program that defines the rules and conditions under which a note can be consumed." |
| Nullifier | "A cryptographic commitment that marks a note as spent, preventing it from being consumed again." |
| Block | "A fundamental data structure that groups multiple batches together and forms the blockchain's state." |
| Batch | "A collection of transactions grouped together, to be aggregated into blocks — improves network throughput." |
| Prover | "Responsible for generating zero-knowledge proofs that attest to correctness of program execution without revealing underlying data." |
| Felt | "A Felt (Field Element) is the primitive cryptographic data type used by the Miden VM. It represents an element in the finite (Goldilocks) field: `p = 2^64 − 2^32 + 1`." |
| Word | "A data structure that represents the basic unit of computation and storage in Miden. Composed of four `Felt`s." |
| Miden Guardian | "Infrastructure built by OpenZeppelin for managing private account state on Miden." |
| Delta | "Represents the changes between two states `s` and `s'`. Applying a Delta `d` to `s` produces `s'`." |
| Threshold Signature | "A cryptographic scheme where a minimum number of signers (the threshold) out of a total group must sign for a transaction to be valid." |

## Distinguishing itself from EVM (per the overview page)

"Transactions execute locally on the client — and only a cryptographic proof is submitted to the network" — contrast with Ethereum, where contract code runs identically on every node. Notes resemble Bitcoin-style UTXOs but carry arbitrary Turing-complete logic, not just a spending condition. Failed assertions during local execution prevent proof generation entirely — the transaction never reaches the network and there's no on-chain trace or gas cost, unlike Ethereum's visible `revert`.

---

<a id="file-02_get_started"></a>

# Get Started — Installation, CLI, First Contract

> Source: `builder/get-started/*`, `builder/faq/`, `builder/glossary/`

## The six-step learning path (per the Get Started landing page)

1. Installation (`midenup`)
2. CLI Basics (wallet + mint tokens)
3. Accounts (create/manage programmatically in Rust/TypeScript)
4. Notes & Transactions (private transfers)
5. Read Storage (query account data)
6. Your First Smart Contract (build/test/deploy in Rust)

## Installation

**Prerequisites**: Rust via rustup (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y`); for TypeScript work, Node.js v22.x+ and Yarn 1.22.x+.

**Toolchain install**:
```bash
cargo install midenup   # or from GitHub source until published to crates.io
midenup init             # creates $MIDENUP_HOME, symlinks `miden` into ~/.cargo/bin
which miden               # verify
midenup install stable    # fetches VM, compiler, client, stdlib, tx kernel as one release channel
midenup show active-toolchain   # should print "stable"
```
Compilation from source (if no pre-built binary is available for your platform) can take 15–30 minutes.

**Troubleshooting**: `command not found` → check `~/.cargo/bin` is on `PATH`. Config errors → `rm -f miden-client.toml store.sqlite3` and re-run `miden client init`.

**Project scaffolding**: `miden new my-test-project`. Rust binaries live in `integration/src/bin/`, run via `cargo run --bin <name> --release`. TypeScript/Vite projects use `@miden-sdk/miden-sdk` and run via `npm run dev`.

## CLI basics (`midenup` delegates to `miden-client` under the hood)

| Command | Purpose |
|---|---|
| `miden client new-wallet` | Create a new wallet account (auto-deployed with default config) |
| `miden client account` | List all tracked accounts (ID, type, storage mode, nonce, status) |
| `miden client account -s <ID>` | Full detail: address, commitment hashes, vault/storage roots, nonce, assets, storage items |
| `miden client account --default <ID>` | Set the default account for subsequent commands |
| `miden mint --target-account <ID> --amount 1000` | Request tokens from the public testnet faucet, auto-consumes the resulting note |
| `miden client sync` | Update local account state from the network |
| `miden new my-project` | Scaffold a Rust workspace |
| `yarn create-miden-app` / `npx create-miden-app` | Scaffold a Vite frontend |
| `miden client init --network [testnet\|devnet\|localhost]` | Initialize a custom client (`miden-client.toml`, `store.sqlite3`, `keystore/`, `templates/`) |

The `miden` entry point routes intelligently: `miden new`→`cargo miden new`, `miden build`→`cargo miden build`, `miden send`→`miden-client send`, `miden faucet`→`miden-client mint`, `miden account`→`miden-client account`.

## Accounts, notes & storage — the get-started-level summary

- **Account types**: Public (fully transparent on-chain state) vs. Private (only a commitment on-chain; full state held by the owner).
- **Notes = sealed envelopes**: "Alice puts 100 tokens in a sealed envelope (note) addressed to Bob"; "Only Bob can open envelopes addressed to him." The standard P2ID pattern restricts consumption to a specific account ID. Benefits called out: unlinkable transactions, concurrent processing, flexible note conditions, reduced sync overhead.
- **Reading storage** (Rust example, reading a public counter contract's map slot):
```rust
let counter_account_id = AccountId::from_hex("0x224a96d294e10d006aef3d4f1b0876")?;
client.import_account_by_id(counter_account_id).await?;
let slot_name = StorageSlotName::new("miden::component::miden_counter_account::count_map")?;
let count_key = Word::from([0u32, 0, 0, 1]);
let count = counter_account.storage().get_map_item(&slot_name, count_key)?;
```
- **Reading token balances**:
```rust
let balance_key = AssetVaultKey::new_fungible(faucet_account_id, AssetCallbackFlag::Disabled);
let balance = alice_account.vault().get_balance(balance_key)?;
```

## Your First Smart Contract — the counter tutorial

Builds three pieces: a **Counter Account** (stores/manages a counter value), an **Increment Note** (a note script that increments it), and **integration scripts** for deployment/lifecycle. No prior blockchain/Miden experience assumed.

**Project structure** (`miden new counter-project`):
```
counter-project/
├── contracts/
│   ├── counter-account/{miden-project.toml, src/lib.rs}
│   └── increment-note/{miden-project.toml, src/lib.rs}
├── integration/{src/{bin/,lib.rs,helpers.rs}, tests/}
├── Cargo.toml
└── rust-toolchain.toml
```

`counter-account/miden-project.toml`:
```toml
[package]
name = "counter-account"
version = "0.1.0"
[lib]
kind = "account-component"
namespace = "miden:counter-account/[email protected]"
[dependencies]
miden-core = "*"
miden-protocol = "*"
```

`increment-note/miden-project.toml` (depends on the account):
```toml
[package]
name = "increment-note"
version = "0.1.0"
[lib]
kind = "note"
namespace = "miden:increment-note/[email protected]"
[dependencies]
counter-account = { path = "../counter-account" }
[package.metadata.miden.dependencies]
counter-account = { wit = "../counter-account/target/generated-wit/" }
```

Build with `miden build --release` from each contract directory, producing a `.masp` (Miden Assembly Package) file.

**Deploying**: `cd integration && cargo run --bin increment_count --release`. Six stages: client setup (connect to testnet) → compile both packages → create the counter account (with storage config) → create a sender account → publish the increment note → the counter account processes the note, incrementing. **Critical**: "accounts (contracts) become visible onchain only when they undergo a state change" — creating an account locally does *not* deploy it; the first state-changing transaction does. Verify results on [MidenScan](https://testnet.midenscan.com).

**Testing**: uses the **Mockchain** — "a purpose-built testing framework that enables fast, local testing without network dependencies." Tests live in `integration/tests/`, run via `cargo test --release`. Six-step pattern: init Mockchain builder + sender → compile both contracts → configure initial storage (count=0) → populate the mockchain → execute locally → assert count == 1.

---

<a id="file-03_accounts"></a>

# Accounts

> Source: `builder/smart-contracts/accounts/*`

## The four (formally five, counting ID) components

Every account — wallet, contract, or faucet — is: **ID** (unique identifier, encodes type/version), **Code** (one or more Components defining behavior — public API + internal logic), **Storage** (persistent state, up to 255 named slots), **Vault** (held fungible/non-fungible assets), **Nonce** (replay-protection counter, increments exactly once per state-changing transaction).

The network stores only cryptographic **commitments** (hashes) to code/storage/vault for private accounts — the owner (or, for public accounts, anyone) holds the actual data.

## Storage

Two field types on a `#[component_storage]` struct:

- **`StorageValue<T>`** — single fixed slot. `.get()` reads; `.set()` **returns the previous value**, not the new one (easy to trip on):
```rust
pub fn initialize(&mut self) {
    let old: Word = self.initialized.set(Word::from([felt!(1), felt!(0), felt!(0), felt!(0)]));
}
```
- **`StorageMap<K, V>`** — key-value pairs within a slot (backed by a sparse Merkle tree on-chain):
```rust
pub fn set_balance(&mut self, account_id: AccountId, amount: Felt) {
    let old: Felt = self.balances.set(account_id, amount);
}
```

Low-level escape hatches outside the component-trait system: `storage::get_item(slot_id)` / `set_item`, `storage::get_map_item(slot_id, &key)` / `set_map_item`.

**Slot ID derivation is a footgun**: slot IDs are derived from `{project_name}::{component_name}::{field_name}` — **renaming a field is a breaking, data-migrating change.**

## Components — the building blocks

"Components are the building blocks of Miden accounts. Each component defines a storage layout, exposes public methods, and can be composed with other components on the same account." A component crate needs three Rust pieces: a `#[component_storage]` struct, a `#[component]` trait (public interface), and a `#[component] impl Trait for Storage` block (logic). Read-only methods take `&self`; mutating methods take `&mut self` (compiler-enforced, gates which kernel operations are legal). The `#[component]` macro auto-generates boilerplate: `add_asset`/`remove_asset`, nonce handling, commitment computation.

## Custom types

Any custom type appearing in a *public* method signature on a `#[component]` trait needs `#[export_type]`; purely internal types don't. Struct fields must all be `pub` and limited to SDK types (`Felt`, `Word`, `Asset`, `AccountId`) or other exported types. Enums currently support unit variants only. Nested/forward-referenced exported types resolve automatically; submodule types each need their own annotation.

## Operations (the full `#[component]`-generated API)

**Read-only** (`&self`): `get_id()`, `get_nonce()`, `get_balance(asset_key)`, `get_initial_balance(asset_key)`, `has_non_fungible_asset(asset)`, `get_vault_root()` / `get_initial_vault_root()`, `compute_commitment()`, `compute_storage_commitment()`, `get_code_commitment()`, `get_procedure_root(index)`, `has_procedure(proc_root)`.

**Mutating** (`&mut self`): `add_asset(asset)`, `remove_asset(asset)` (fails if insufficient/absent), `incr_nonce()` (mandatory for any state-modifying transaction), `compute_delta_commitment()`, `was_procedure_called(proc_root)`.

Proof generation fails on: removing an unavailable asset, invalid asset-key reference, out-of-bounds procedure index, failed assertions, or a transaction that made **neither** a state change **nor** consumed any notes.

## Cryptography available to account code

- **Signature verification**: `rpo_falcon512_verify(pk, msg)` — pk and msg as Poseidon2 hashes; actual signature bytes load via the advice stack.
- **Hashing**: Poseidon2 (`hash_words(&words)`, the native VM hash), BLAKE3 (`blake3_hash()`), SHA-256 (`sha256_hash()`).

## Authentication

Two supported schemes via the scheme-agnostic `AuthSingleSig` component (as of the docs' stated "v0.15" — see the version-drift warning up top): **Falcon-512 Poseidon2** (scheme ID 2, post-quantum) and **ECDSA K256 Keccak** (scheme ID 1 — i.e. the same curve/hash Ethereum uses, notable for potential key-reuse across Miden and EVM chains). Flow: `AuthSingleSig` stores a pubkey commitment + scheme ID in well-known slots → the kernel invokes an `@auth_script`-annotated procedure → it increments the nonce, computes a transaction summary hash (`hash([ACCOUNT_DELTA_COMMITMENT, INPUT_NOTES_COMMITMENT, OUTPUT_NOTES_COMMITMENT, [0,0,ref_block_num,final_nonce]])`), requests a signature from the advice provider, and verifies it. Failed verification fails proof generation before the transaction ever reaches the network. Custom auth is possible: mark exactly one procedure `#[auth_script]`; panics = auth failure; standards components auto-increment the nonce, custom ones must do it manually and bind it into the signed message.

## Design patterns (per `builder/smart-contracts/patterns/`)

- **Access control**: unlike Solidity, procedures cannot check "who is calling me" — auth is enforced by the auth component the kernel invokes automatically; at note level, check `active_note::get_sender()`.
- **Rate limiting**: store the last action's block number in a slot, compare against `tx::get_block_number()`.
- **No error strings / no `Result`**: use `assert!`/`assert_eq!`; failures halt proof generation.
- **Felt arithmetic is modular** — use `saturating_sub` and validate in `u64` space before subtraction; Felt division computes multiplicative inverses, not integer division.
- **`#![no_std]` environment**: `alloc::vec::Vec` not `std::vec::Vec`, `BTreeMap` not `HashMap`.
- **Secrets never belong in contract code** — it's visible on-chain.

---

<a id="file-04_notes"></a>

# Notes

> Source: `builder/smart-contracts/notes/*`, `builder/smart-contracts/standards/standard-notes/`

## What a note is (builder-level)

"Notes are Miden's primary mechanism for cross-account communication — they carry assets, execute programmable logic, and trigger state changes on the consuming account." Four parts: **Assets** (0–256 fungible/non-fungible), **Script** (executable consumption logic, Turing-complete, no size limit), **Storage** (parameterizes the script — e.g. P2ID stores the target account ID, up to 1024 items / 8KB), **Metadata** (always public: sender, note type, 32-bit discovery tag, up to 4 attachments).

**Storage modes**: Public (full data on-chain, anyone can attempt consumption) vs. Private (only a commitment hash on-chain — off-chain transport required between sender and recipient; see [Note Transport](#file-07_client_sdks)).

## Note scripts — the `#[note]` pattern

```rust
#[note]
struct MyNote { target_account_id: AccountId }   // struct fields = note storage, by order/type

#[note]
impl MyNote {
    #[note_script]
    pub fn run(self, _arg: Word, account: &mut Wallet) {
        for asset in active_note::get_assets() {
            account.receive_asset(asset);
        }
    }
}
```
Method constraints: receiver must be `self` (by value), return type `()`, exactly one required `Word` argument, optional `&AccountWrapper`/`&mut AccountWrapper` (either order). Omitting the account parameter yields a logic-only note that can't call account methods. The account wrapper needs `#[account(package::Interface)]` plus a matching WIT dependency in `miden-project.toml`.

## Standard note types (the full library)

| Note | Storage | Mechanics |
|---|---|---|
| **P2ID** (Pay to ID) | `target_account_id` (AccountId) | Only the named account can consume; transfers all assets on success. `P2idNote::create(sender, target, assets, note_type, attachments, rng)` |
| **P2IDE** (Pay to ID w/ Expiration) | `target_account_id_prefix`/`_suffix` (Felt), `timelock_height` (Felt), `reclaim_height` (Felt) — **4 storage items total** | *"The note can't be consumed before `timelock_height`, and if the target hasn't consumed it by `reclaim_height`, the creator can reclaim the assets."* `P2ideNote::create(sender, P2ideNoteStorage::new(target, reclaim_height, timelock_height), assets, note_type, attachments, rng)` — see the [precise protocol-reference confirmation](#file-10_protocol_reference) of this same mechanic, and the [bridging synthesis](#file-15_bridge) for how this maps onto a time-locked-release design |
| **SWAP** | offered/requested asset descriptors — 16 storage items | Trustless atomic exchange: consumer receives the offered asset, and a P2ID *payback* note carrying the requested asset is auto-created back to the original issuer, both within one transaction |
| **PSWAP** | — | Partially-fillable variant of SWAP (`PswapNote` / `miden::standards::notes::pswap`) |
| **MINT** | — | Faucet minting fungible tokens into a note (`MintNote` / `miden::standards::notes::mint`) — **minting never directly credits a vault**; the recipient must consume the mint note |
| **BURN** | — | Faucet burning fungible tokens returned via a note (`BurnNote` / `miden::standards::notes::burn`) — the standard-library approach, preferred over custom burn logic |

## Output notes (creating notes from account/transaction code)

```rust
use miden::{output_note, Asset, NoteType, Recipient, Tag};
pub fn send_assets(recipient: Recipient, asset: Asset, tag: Tag) {
    let note_idx = output_note::create(tag, NoteType::Public, recipient);
    output_note::add_asset(asset, note_idx);   // callable repeatedly to bundle multiple assets
}
```
Queries: `output_note::get_assets_info(note_idx)`, `get_assets(note_idx)`, `get_recipient(note_idx)`, `get_metadata(note_idx)`.

## Reading note data

Two modules depending on context:
- **`active_note::*`** (inside a note script, for the note currently executing): `get_storage()` (raw `Vec<Felt>` — prefer the `#[note]` struct auto-deserialization instead), `get_assets()`, `get_sender()`, `get_recipient()`, `get_script_root()`, `get_serial_number()`, `get_metadata()`.
- **`input_note::*`** (inside transaction/account code, by index, for *any* input note): mirrors the above but takes a `NoteIdx`. Critically, for storage it only exposes the **commitment and count**, not actual values — "the kernel lacks full storage for unconsumed notes."

---

<a id="file-05_transactions"></a>

# Transactions & Cross-Component Calls

> Source: `builder/smart-contracts/transactions/*`, `builder/smart-contracts/cross-component-calls/`

## Execution model

Five stages: **Build** (client assembles params) → **Execute** (VM runs locally, storage mutates) → **Prove** (ZK proof generated) → **Submit** (proof + public updates sent) → **Verify** (network checks the proof, records changes). "Transactions execute locally on the user's machine, not on a shared VM." Failed assertions are rejected pre-submission — no on-chain trace, no cost. Single-account scope enables parallelism; cross-account effects only happen through notes. Client-side rejects fully-empty transactions (no state change, no notes consumed) before even attempting a proof.

## Transaction context (the `tx` module)

`tx::get_block_number()`, `get_block_commitment()`, `get_block_timestamp()` (seconds since epoch); `get_input_notes_commitment()`, `get_output_notes_commitment()`, `get_num_input_notes()`, `get_num_output_notes()`; `get_expiration_block_delta()` / `update_expiration_block_delta()` — "the expiration delta determines how many blocks after creation the transaction remains valid."

## Transaction scripts

"A top-level function that runs once per transaction, after all note scripts have executed" — orchestrates cross-note logic (moving vault assets into output notes, calling account methods).
```rust
#[tx_script]
fn run(arg: Word, account: &mut Wallet) { /* ... */ }
```
Constraints: function must be named `run`, return `()`, take exactly one `Word` (script argument) plus an optional `&`/`&mut AccountWrapper`; no generics, no async.

## The advice provider (non-deterministic auxiliary data)

Supplies "non-deterministic auxiliary data to the VM during proof generation" — an advice map (`Word → Vec<Felt>`) and an advice stack, both host-supplied and therefore **untrusted by default**. Two access patterns:
- **`adv_push_mapvaln`** — unverified; caller must independently check integrity if security-sensitive (e.g. Falcon signatures get pushed unverified, then explicitly verified via `rpo_falcon512_verify`).
- **`adv_load_preimage`** — commitment-verified; "the VM verifies that the loaded data hashes to the provided commitment before returning it. If the host tampers with the data, the hash won't match and proof generation fails." **Prefer this for anything security-sensitive.**

Writing: `adv_insert`, `adv_insert_mem`. Requesting signatures: `emit_falcon_sig_to_stack`.

## Cross-component calls

Two patterns:
1. **`#[note]` with a mutable `AccountWrapper`** (recommended, native account calls): declare `#[account(basic_wallet::BasicWallet)] pub struct Wallet;`, then call methods on `account: &mut Wallet` inside the note/tx script.
2. **Foreign Procedure Invocation (FPI)** — reading a *different* account's state: `let counter = CounterAccount::new(counter_account_id); counter.get_count()`. Config requires two entries in `miden-project.toml`: a package dependency (locates the component) and a generated-WIT dependency (Rust bindings).

Building a component generates WIT interfaces other projects import to call its methods across the boundary.

---

<a id="file-06_sdk_types"></a>

# Core SDK Types & Standard Components

> Source: `builder/smart-contracts/types/`, `builder/smart-contracts/standards/*`

## Core Rust SDK types

- **`Felt`** — element of the Goldilocks prime field (`p = 2^64 − 2^32 + 1`); wraps modularly, not standard integer overflow. Create via `felt!(42)`, `Felt::from_u32()`, `Felt::new()`.
- **`Word`** — exactly four `Felt`s, `#[repr(C)]`; "the standard unit for storage, hashing, and data passing in Miden." `Word::new([felt!(1), felt!(2), felt!(3), felt!(4)])`.
- **`Asset`** — two Words: `key` (asset class) + `value` (amount or NFT payload); encoding differs between fungible and non-fungible (see the exact bit layout in [Protocol Reference](#file-10_protocol_reference)).
- **`AccountId`** — two `Felt`s (`prefix`, `suffix`).
- Others: `NoteIdx`, `Tag`, `NoteType`, `Recipient`, `Digest`, `StorageSlotId` (full docs on docs.rs).

## Standard account components (`miden_standards::account::*`)

| Component | Purpose |
|---|---|
| `BasicWallet` | Hold assets, receive from standard notes, move assets into output notes |
| `FungibleFaucet` | Bundles token metadata (symbol, decimals, max supply, name, faucet ID) with mint/burn procedures |
| `AuthSingleSig` / `AuthSingleSigAcl` | Single-sig auth, optionally with an access-control list |
| `AuthMultisig` / `AuthMultisigSmart` / `AuthGuardedMultisig` | Threshold or policy-aware multisig, optionally Guardian-protected |
| `AuthNetworkAccount` | Auth via note allowlists, for network (operator-executed) accounts |
| `Ownable2Step` | Two-step owner transfer/access control |
| `RoleBasedAccessControl` | Role-based authorization for policy management |
| `Authority` | Shared authority component used by policy standards |
| `TokenPolicyManager` | Registers/updates mint, burn, send, receive policies (AllowAll/OwnerOnly etc.) |
| `BasicBlocklist` / `BasicAllowlist` | Block or restrict transfers to specific accounts |

## Faucets and policies

"A token issuer is an account" — `FungibleFaucet` bundles metadata (symbol, decimals, max supply, name, faucet account ID) with mint/burn. **Minting never directly credits a vault**: the faucet creates a note carrying the minted asset; the recipient must consume it. Burning works the same way in reverse via `BurnNote`. `TokenPolicyManager` governs four independently-configurable gates: mint, burn, send, receive policies.

---

<a id="file-07_client_sdks"></a>

# Client SDKs — Rust, Web, React

> Source: `builder/tools/clients/*`

## Rust client

**Install**: `cargo install miden-client-cli --locked` (CLI) or `miden-client = { version = "0.11" }` (library).

**Architecture** (six components): **Store** (persists accounts w/ history, transactions, notes, tags, headers — no full-chain-history requirement), **RPC Client** (trait-based gRPC, works native + Wasm), **Transaction Executor** (runs the Miden VM inside the tx kernel via a `DataStore` interface), **Keystore** (manages signing keys, Rust + web implementations), **Note Screener** (static + dry-run checks of which tracked accounts can consume a given note), **State Sync** (polls nodes to chain tip, customizable new-note callbacks), **Note Transport** (private note exchange via gRPC, tag-based, `SendNote`/`FetchNotes` with pagination).

**Library usage**:
```rust
let sqlite_store = SqliteStore::new("path/to/store".try_into()?).await?;
let client = ClientBuilder::for_testnet()   // or for_devnet() / for_localhost()
    .store(Arc::new(sqlite_store))
    .filesystem_keystore("path/to/keys")?
    .build().await?;

// account creation
let key_pair = SecretKey::with_rng(client.rng());
let new_account = AccountBuilder::new(init_seed)
    .account_type(AccountType::Private)
    .with_auth_component(AuthRpoFalcon512::new(key_pair.public_key()))
    .with_component(BasicWallet)
    .build()?;
keystore.add_key(&AuthSecretKey::RpoFalcon512(key_pair), new_account.id()).await?;
client.add_account(&new_account, false).await?;

// payment transaction
let transaction_request = TransactionRequestBuilder::new()
    .build_pay_to_id(payment_description, None, NoteType::Private, client.rng())?;
let result = client.new_transaction(sender_account_id, transaction_request).await?;
client.submit_transaction(result).await?;

// note screening
let screener = client.note_screener();
let account_statuses = screener.can_consume(&note).await?;   // or can_consume_batch()
```

**CLI reference** (full command surface): `init` (writes `miden-client.toml`), `info` (`--rpc-status` for node detail), `account` (`--show <ID>`), `new-wallet`, `new-account` (custom component-composed accounts), `notes` (list/show/send/fetch, partial-ID matching), `network-note-status`, `export`/`import`, `mint`, `consume-notes`, `send` (with recall), `swap`, `sync`, `tags`, `tx`, `address` (bech32 encode/track), `exec` (run a script against accounts against), `note-transport`. All support `--help` and `--debug`.

**Peer-to-peer example (private)**:
```bash
miden-client send --sender <A> --target <B> --asset 50::<faucet-id> --note-type private
miden-client sync
miden-client consume-notes --account <B> <note-id>
```
(Public variant is identical but `--note-type public`, and the recipient discovers it via `sync` instead of needing the note transported out-of-band.)

## Web SDK (`@miden-sdk/miden-sdk`, npm-verified current version **0.15.8**)

```bash
npm install @miden-sdk/miden-sdk
```
Requires modern browsers with WASM + Web Worker support, or Node 20+.

```javascript
import { MidenClient } from "@miden-sdk/miden-sdk";
const client = await MidenClient.createTestnet();   // also createDevnet(), createMock(), create({...})
await client.sync();
const wallet = await client.accounts.create();
```

Config options: `rpcUrl` ("testnet"/"devnet"/"localhost"/custom), `proverUrl` ("local" or remote), `noteTransportUrl`, `autoSync`, `storeName` (IndexedDB isolation key for multiple concurrent clients).

**Accounts**: `client.accounts.create({ storage: "public", auth: "ecdsa", seed })` (wallet); `create({ type: 0, symbol, decimals, maxSupply })` for a faucet (`type: 0`=fungible, `1`=non-fungible); contract accounts need a compiled component via `client.compile.component(...)`, default to public storage. `get()` (local-only, `null` if untracked), `getOrImport()`, `list()` (lightweight `AccountHeader[]`), `getDetails()`, `getBalance()`; import/export via ID, file, or seed (public accounts only for seed-import).

**Notes**: status filters `committed`/`consumed`/`expected`/`processing`/`unverified`; `client.notes.get()`, `listSent()`, `listAvailable(accountId)`; export formats `Id` (public only), `Full` (+ inclusion proof), `Details`; private notes route through transport via `sendPrivate`/`fetchPrivate`; tags (`u32`) filter sync scope, managed via `client.tags.add()`.

**Transactions**:
```javascript
const { txId } = await client.transactions.send({
  account: senderWallet, to: recipientWallet, token: faucet, amount: 100n,
  type: "private", reclaimAfter: 100, timelockUntil: 90   // ← P2IDE time-lock exposed as first-class options
});
```
Also: `mint`, `consume`/`consumeAll(limit?)`, `swap`. All submit-on-mempool-acceptance; `waitFor()` blocks for network commitment; `preview()` dry-runs without submitting, returning a `TransactionSummary`. Custom scripts via `client.compile.txScript()` + `.execute()`. FPI via `foreignAccounts` param. Read-only `executeProgram()` mirrors Ethereum's `eth_call`. Manual `TransactionRequest` building + `client.transactions.submit()` for fine-grained control. Remote proving configurable globally (`ClientOptions.proverUrl`) or per-call. History via `client.transactions.list()`.

**Sync**: `client.sync()` → `SyncSummary` (block number, notes committed/consumed, committed transactions, accounts with advanced state). `getSyncHeight()` is a cheap local-only check. `exportStore()`/`importStore()` for IndexedDB backup — **import is destructive**, overwrites everything.

**Compile**: `client.compile.component({code, slots?, supportAllTypes?})` (default `true`, auto-injects auth-kernel invocation), `client.compile.txScript({code, libraries?})`, `client.compile.noteScript({code, libraries?})`. Linking: **Dynamic** (default, DYNCALL, fetches on-chain contracts at proving time — for FPI) vs. **Static** (inlined at compile time, for self-contained off-chain libs). FPI needs the target's procedure hash: `component.getProcedureHash("get_count")`.

**Testing**: `MidenClient.createMock()` — fully in-memory, same API surface as production. Pattern: create accounts/resources → `client.proveBlock()` → `client.sync()` → transact → repeat. Uses dummy proofs (near-instant regardless of script complexity). Mock-only: `proveBlock()`, `usesMockChain()`, `serializeMockChain()`/`serializeMockNoteTransportNode()` (state snapshot/restore across test instances). Mock includes note transport for private-note flows too.

## React SDK (`@miden-sdk/react`, npm-verified **0.15.8**, requires React 18+)

```bash
npm install @miden-sdk/react @miden-sdk/miden-sdk
```
```jsx
<MidenProvider config={{ rpcUrl: "testnet", prover: "testnet", autoSyncInterval: 15_000, noteTransportUrl: "testnet" }}
  loadingComponent={<Loading />} errorComponent={<Error />}>
  <YourApp />
</MidenProvider>
```

**Query hooks** (read local store): `useAccounts()`, `useAccount(id)` (incl. `getBalance()`), `useNotes(filter?)`, `useNoteStream(options?)` (temporal, for notification UIs), `useTransactionHistory(options?)`, `useSyncState`, `useAssetMetadata(assetIds?)`. All auto-refetch after sync.

**Mutation hooks** (serialized under a concurrency lock): transaction-producing — `useSend`, `useMultiSend`, `useMint`, `useConsume`, `useSwap`, `useTransaction` (general escape hatch, accepts prebuilt requests or builder callbacks, supports `skipSync`/`privateNoteTarget`); account-creating — `useCreateWallet`, `useCreateFaucet`, `useImportAccount`; polling — `useWaitForCommit`, `useWaitForNotes`.

**Signers** — pluggable `SignerContext` contract (`MidenProvider` accepts any implementation exposing `signCb`): built-in providers for **Para** (`@miden-sdk/para` — EVM wallets, though this exact npm package was **not found** on the registry at time of writing, unconfirmed), **Turnkey** (`@miden-sdk/miden-turnkey-react`, npm-verified v1.15.1), **MidenFi wallet adapter** (`@miden-sdk/wallet-adapter-react`, also not found on npm at time of writing — verify before depending on it). `MultiSignerProvider` allows runtime switching. Custom implementations can route to internal HSMs/hardware wallets.

**Advanced hooks**: `useExecuteProgram` (view-call, "Miden's `eth_call`"), `useCompile`, `useSessionAccount` (ephemeral "session wallet" pattern, persists across reloads), `useExportStore`/`useImportStore`, `useImportNote`/`useExportNote` (QR/offline note delivery), `useSyncControl` (pause/resume auto-sync without unmounting).

**Recipes worth knowing**: `formatAssetAmount()`/`parseAssetAmount()` for decimal-aware display; `getNoteSummary()`/`formatNoteSummary()`; `runExclusive()` to guard against double-click races; per-user `storeName` isolation for multi-wallet UIs; `toBech32AccountId()` for display formatting.

## Common client errors (the diagnostic table)

| Error | Cause | Fix |
|---|---|---|
| `ClientError::MissingOutputRecipients` | MASM emitted a note whose recipient wasn't in `expected_output_recipients` | Align MASM recipient data with Rust structures |
| `TransactionRequestError::MissingAuthenticatedInputNote` | Note's `InputNoteRecord` missing locally | Import/sync before executing |
| `TransactionRequestError::NoInputNotesNorAccountChange` | Empty transaction | Add at least one input note or explicit state change |
| `TransactionRequestError::StorageSlotNotFound` | Bad ABI/component-ordering addressing | Verify auth component is ordered first, check slot index |
| `TransactionExecutorError::ForeignAccountNotAnchoredInReference` | FPI proof generated against the wrong block | Re-fetch the foreign account proof at the correct reference block |
| `TransactionExecutorError::TransactionProgramExecutionFailed` | Kernel assertion/constraint failure | Debug mode + inspect VM diagnostics |
| `ClientError::StoreError(AccountCommitmentAlreadyExists)` | Resubmitting an already-applied final commitment | Sync first; reset store for a clean dev slate |
| `NoteNotFoundOnChain` / `RpcError::NoteNotFound` | Wrong note ID or not yet committed | Verify ID, sync, retry |

## Local node testing

```bash
git clone https://github.com/0xMiden/node.git miden-node && cd miden-node
make docker-build-node docker-build-monitor compose-genesis compose-up
```
RPC at `http://localhost:57291`. Use a local node when tests "need real node state: public accounts, block commits, transaction submission, network notes, or RPC error details" — otherwise prefer the mock client. Web SDK: `rpcUrl: "localhost"`, `proverUrl: "local"`, dedicated `storeName`. Rust: `TEST_MIDEN_NETWORK=localhost`. Export the genesis account: `docker run --rm -v miden-node_node-data:/data:ro -v "$PWD":/out alpine:3.20 cp /data/accounts/account.mac /out/account.mac`.

## Note transport network (private-note delivery)

A lightweight, **stateless-about-chain-truth** indexing/retrieval layer, deliberately decoupled from the Miden network itself: *"The transport node does not connect to a Miden node and does not know whether a note has been committed on-chain."* It doesn't validate note contents, attach commitment context, or attach inclusion proofs — clients remain fully responsible for chain-state reconciliation.

Flow: sender's client calls `SendNote` (serialized header + details) → node extracts note ID + tag, stores in SQLite → recipient calls `FetchNotes` for tags of interest, gets matching notes + a pagination cursor → recipient persists the cursor. Limits: up to 128 tags per `FetchNotes` request, max 500 notes per response, single-snapshot query (avoids race conditions across multi-tag lookups). `StreamNotes` gives server-side streaming per tag (~500ms poll interval) as a supplement to, not replacement for, durable sync. A `Stats` endpoint gives network-wide aggregate counts.

**Running an operator node**: `cargo install --path bin/node --locked` → binary `miden-note-transport-node-bin`. Production example:
```bash
miden-note-transport-node-bin --host 0.0.0.0 --port 57292 \
  --database-url /var/lib/miden-note-transport/node.db --retention-days 30
```
`--max-note-size` defaults to 512000 bytes. OTel/structured-logging env vars supported; `make docker-node-up` launches a full observability stack (node + Collector + Tempo + Prometheus + Grafana).

## Bridging (testnet-only, immature — do not build production dependencies on it)

Current scope: **Sepolia (Ethereum testnet) ↔ Miden testnet only**, described explicitly as a *"mock NEAR Intents 1Click-style bridge sandbox"* and *"Testnet-only local service for app integration testing."* AggLayer and "Epoch" bridging are mentioned as future work.

Actors: user wallet, builder app, Bridge API, a solver (implemented inside the sandbox service), Sepolia, Miden testnet. Both directions use **public** Miden notes deliberately — "the bridge can observe and validate deposits without requiring per-quote Miden account setup," and a stable bridge account can be targeted with a programmable note rather than needing EVM-style per-address discovery. Outbound (Miden→Sepolia) deposits carry `BridgeOutV1` memo data.

**API** (`/v0/*` for integration; `/demo/*` and `/lab` are local-only sandbox helpers): `GET /v0/tokens` (supported assets, e.g. `eth-sepolia:ethmiden-testnet:eth`), `POST /v0/quote` (returns `correlationId`, `quote.depositAddress`, `quote.amountIn`/`amountOut`, and for outbound quotes `quote.depositMemo`), `POST /v0/deposit/submit` (submits a landed Sepolia tx hash for verification), `GET /v0/status` (polls by deposit address or bridge account + memo).

**Lifecycle statuses**: `PENDING_DEPOSIT` → `KNOWN_DEPOSIT_TX` → `PROCESSING` → `SUCCESS` | `REFUNDED` | `FAILED`.

Running the sandbox locally requires Docker Compose v2, a Sepolia RPC endpoint, and two funded Sepolia testnet accounts (solver + tester); launched via `make sepolia`; inspected via the `bridgectl` utility. **Explicit warning**: "Do not use production keys or mainnet assets."

---

<a id="file-08_tutorials"></a>

# Tutorials — Miden Bank & Recipes

> Source: `builder/tutorials/*`

## Miden Bank — the flagship 9-part end-to-end tutorial

Builds a working banking application: **Bank Account Component** (manages depositor balances + vault), **Deposit Note**, **Withdraw Request Note**, and an **Initialization Script**. Includes integration tests validated against both the Mockchain and live testnet.

**Setup**: `miden new miden-bank`. Each contract needs `Cargo.toml` (`miden = "0.13"` dependency, `crate-type = ["cdylib"]`), `miden-project.toml` (`kind = "account-component"`, namespace, supported account types), and `.cargo/config.toml` (`target = "wasm32-wasip2"`). Build via `miden build --release`, producing a `.masp` file.

**Account component**: `BankStorage` with two slots — `initialized` (`StorageValue<Word>`) and `balances` (`StorageMap<Word, Felt>`, keyed on `[depositor.prefix, depositor.suffix, asset.key[3], asset.key[2]]`). Exported methods: `initialize()`, `get_depositor_balance(depositor, asset) -> Felt`. Slot IDs derive from `{package_name}::{component_struct}::{field_name}`.

**Asset management** — the security-critical section: fungible assets split into a **value word** `[amount, 0, 0, 0]` and a **key word** (faucet ID across indices 2–3, with index 2 folding in a metadata byte). Deposit: validate fungible type (`value[1] == 0`) → validate against `MAX_DEPOSIT_AMOUNT` → build the composite balance key → **validate entirely in u64 before storing as Felt** ("Felt arithmetic is modular... wraps at the Goldilocks prime") → `native_account::add_asset()`. Withdrawal has the mirror-image risk: "You MUST validate before ANY subtraction," since under-subtracting silently wraps to a massive positive number rather than erroring.

**Note scripts**: deposit-note pattern —
```rust
#[account(bank_account::Bank)]
pub struct Wallet;
#[note]
struct DepositNote;
#[note]
impl DepositNote {
    #[note_script]
    fn run(self, _arg: Word, account: &mut Wallet) {
        let depositor = active_note::get_sender();
        for asset in active_note::get_assets() { account.deposit(depositor, asset); }
    }
}
```

**Output notes / withdrawal**: `note::build_recipient()` builds the RECIPIENT commitment from (serial number, P2ID script MAST root, target storage items `[suffix, prefix]`); `output_note::create()` (tag, type, recipient); `output_note::add_asset()`. The withdraw-request note packs 14 Felts: indices 0–3 asset encoding, 4–7 serial number, 8–9 tag+type, 10–13 the **P2ID script root read directly by the bank** — a deliberate design choice so the bank contract stays version-agnostic (callers supply the current script root rather than the bank hardcoding it — see Pitfall #9 below).

**Transaction scripts**: owner-initiated (vs. note-triggered), same `#[tx_script]` + `#[account(...)]` pattern as elsewhere, commonly used to deploy/initialize (recall: an account is only visible on-chain after its first state change).

**Constants & constraints**: `MAX_DEPOSIT_AMOUNT: u64 = 1_000_000`; `MAX_BALANCE: u64 = 9_223_372_034_707_292_160` (= 2⁶³ − 2³¹, matching the protocol's `FungibleAsset::MAX_AMOUNT`). **Never compare `Felt` values with `<`/`>`/`<=`/`>=` directly** — convert via `.as_canonical_u64()` first; field-element ordering produces wrong results otherwise.

**Complete flows / tests**: `deposit_test.rs` (happy path + `deposit_exceeds_max_should_fail` + `deposit_without_init_should_fail`), `init_test.rs` (flag flips 0→1), `withdraw_test.rs` (full init→deposit→withdraw, asserts the P2ID output note has correct payload). Run via `cargo test --package integration --release -- --nocapture --test-threads=1`. Live-testnet binaries also provided (`cargo run --bin initialize`, `cargo run --bin deposit`).

## Recipe catalog (Rust + Web variants, listed at `builder/tutorials/recipes/{rust,web}/`)

Rust: `counter_contract_tutorial`, `create_deploy_tutorial`, `creating_notes_in_masm_tutorial`, `custom_note_how_to`, `delegated_proving_tutorial`, `foreign_procedure_invocation_tutorial`, `mappings_in_masm_how_to`, `mint_consume_create_tutorial`, `network_transactions_tutorial`, `oracle_tutorial`, `public_account_interaction_tutorial`, `unauthenticated_note_how_to`.

Web: `bridging_with_epoch_tutorial`, `counter_contract_tutorial`, `create_deploy_tutorial`, `creating_multiple_notes_tutorial`, `foreign_procedure_invocation_tutorial`, `mint_consume_create_tutorial`, `react_wallet_tutorial`, `setup_guide`, `unauthenticated_note_how_to`.

(Titles crawled from the sitemap; not individually deep-dived given scope — notable ones for a builder to seek out directly: `oracle_tutorial` [external-data-into-notes pattern], `delegated_proving_tutorial` [remote proving], `network_transactions_tutorial` [operator-executed public accounts].)

## Dev helpers

**Testing** (MockChain): "simulates block production and proving, account state management, note creation and consumption, and transaction execution." Recommended structure: a separate integration crate; key deps `miden-testing`, `miden-client` (testing features), `cargo-miden`. Pattern: `cargo_miden::run()` to compile contracts → `MockChain::builder()` → add faucets/wallets/custom accounts → build → configure storage slots by name → configure notes (assets, inputs via `active_note::get_inputs()`, metadata) → execute with context builders → apply deltas → prove blocks sequentially → read back storage by slot/key name and assert.

**Debugging**: no `console.log`/print in contract code — the primary technique is strategic `assert_eq(a, b)` placement (note: **a function, not a macro** — no `!`) combined with reading the **cycle count** in the failure output: assertion fails at an earlier cycle → the tested value itself is wrong; assertion passes but execution still fails at the same cycle → the bug is downstream. `assert_eq` is limited to `Felt` values.

**Common pitfalls (all 10, verbatim summarized)**:
1. Never use `<`/`>`/`<=`/`>=` directly on `Felt` — convert to `u64` first.
2. Stack only directly accesses the first 16 elements — break up complex functions.
3. Functions accept at most 4 Words (16 Felts) as arguments — group into Words or pass via note storage/keyed lookup.
4. Arrays passed Rust→VM arrive **reversed** — be consistent constructing/parsing.
5. Felt arithmetic wraps silently on underflow/overflow — always validate before subtracting.
6. `active_note::add_assets_to_account()` fails without a `BasicWallet` component — add it, or use `native_account::add_asset()` directly.
7. Inconsistent storage-map key construction silently returns zeros — define one key-building pattern and reuse it everywhere.
8. Note type values are specific integers: `1` = Public, `2` = Private.
9. Don't hardcode P2ID script digests (fragile across upgrades) — carry the script root on the initiating note's storage and read it at runtime via `P2idNote::script().root()` (exactly the pattern the Miden Bank withdraw-note uses).
10. A transaction with **neither** a state change **nor** any consumed notes is rejected outright — every code branch must do one or the other.

---

<a id="file-09_guardian"></a>

# Miden Guardian — Assisted Self-Custody

> Source: `builder/miden-guardian/*`. **Directly relevant if you need multi-party/threshold custody** — see [the bridging synthesis](#file-15_bridge).

## What it is and why it exists

"An offchain coordination service built by **OpenZeppelin** for Miden accounts" — non-custodial, and explicitly *not* a private execution environment, sequencer, or rollup. It exists because Miden's client-side-private-state model creates three concrete problems it's designed to solve:

1. **Backup risk** — a solo user loses their account if local state isn't backed up (there's no public ledger holding private state to fall back on).
2. **Staleness** — shared-account participants need protection against another participant withholding state updates.
3. **Multi-device sync** — devices need a shared source of truth, again because there's no public ledger for private state.

## Architecture (four layers)

Miden network (canonical commitments) → Miden client (local execution/proving/keys) → **Guardian server** (state snapshots + auth) → storage backend (append-only, verifiable). Clients retain full cryptographic control — "the provider cannot move funds unilaterally."

## Core concepts

- **Deltas**: append-only changes to account state, each referencing the prior commitment, forming an unbroken chain.
- **Canonicalization**: candidate deltas (signed by Guardian, not yet on-chain) get promoted to **canonical** (observed on Miden, durable) or **discarded** (failed verification) by a background worker that polls the network.
- **Signer architecture**: Guardian typically acts as *one signer in a multisig arrangement* — a hot key + Guardian key handle everyday transactions, while a **cold key enables recovery without Guardian's cooperation at all**. Guardian holds only an acknowledgement (ACK) key, never a spending key; clients are expected to verify the ACK signature on every accepted delta to confirm Guardian genuinely accepted the change.

## Services (per the architecture doc)

Transport: gRPC (`:50051`, primary for Rust clients), HTTP (`:3000`, REST for TypeScript + the operator dashboard), a feature-gated EVM proposal API. Persistence: PostgreSQL (production) or filesystem (dev) for account/delta/proposal/audit data, plus a separate metadata store for auth credentials. Identity: Guardian signs its own responses (Falcon and/or ECDSA) so clients can verify they're talking to the trusted Guardian instance. Dual auth mode: per-account signing for mutations, Falcon-signed challenges for the operator dashboard.

## Quickstart (60 seconds)

```bash
docker compose up --build -d      # filesystem backend, HTTP :3000, gRPC :50051
curl http://localhost:3000/       # liveness
curl http://localhost:3000/pubkey # {"commitment":"0x..."} — the ACK key clients pin
```
Demo app: `cd examples/demo && cargo run --release` (needs a Miden RPC endpoint; devnet by default).

## The Multisig SDK — M-of-N threshold signing

This is the piece most directly reusable for a **threshold-custody / multi-party release** design: an M-of-N framework where **Threshold (M)** = minimum signatures required, **Signers (N)** = total authorized cosigners, each holding a Falcon public-key commitment (32 bytes / 64 hex chars).

**Proposal lifecycle**: **Pending** (collecting signatures, shows X/Y signed) → **Ready** (threshold met) → **Finalized** (executed on-chain or discarded).

**API surface**: proposers call `createP2idProposal()` (transfers), `createAddSignerProposal()` (membership changes), `createConsumeNotesProposal()` (asset claims); cosigners call `signProposal(id)`; any authorized party calls `executeProposal(id)` once threshold is met, triggering on-chain settlement.

**Offline/air-gapped support**: proposals export to JSON; signers import, sign locally (no connectivity needed), and export the signed result back — genuinely useful if some of your M-of-N signers are meant to be offline/cold.

**Availability**: TypeScript (`npm: @openzeppelin/miden-multisig-client`, npm-verified current version **0.16.0**, description "TypeScript SDK for Miden multisig accounts with GUARDIAN integration") and Rust (`cargo: miden-multisig-client`) — identical workflow on both.

## Production deployment (AWS reference architecture)

Single Fargate service behind an ALB, RDS PostgreSQL, AWS Secrets Manager: "There is no API gateway, no sidecar. The ALB does layer-7 routing on path so HTTPS clients and gRPC clients share port 443." Requirements: `DEPLOY_STAGE=prod`, `postgres` feature (add `evm` if EVM proposal support is needed), RDS for state/deltas/proposals/metadata/audit rows, Secrets Manager for ACK signing keys. New deployments should prefer **AWS KMS over Secrets Manager for the ECDSA ACK signer** — "the private key is generated in and never leaves KMS" — existing deployments migrate via `SwitchGuardian`. Also required: explicit `GUARDIAN_CORS_ALLOWED_ORIGINS`, a pinned `GUARDIAN_DASHBOARD_CURSOR_SECRET` for multi-task deployments, RDS backup/deletion-protection config, and (optionally) Prometheus metrics. `prod` stage auto-enables autoscaling, upsizes RDS, and inserts an RDS Proxy between ECS and RDS. Deliberately excluded from the reference architecture: remote Terraform state, WAF, read replicas, KMS-managed Secrets-Manager keys — observability today is CloudWatch logs + Container Insights only.

**Practical guides available** (each "a complete, copy-pasteable configuration... Docker Compose artifacts and `.env.example` files"): AWS-managed ACK signers (Postgres + Secrets Manager/Falcon + KMS/ECDSA), the Miden Dashboard operator UI, Prometheus/Grafana observability, and Postgres TLS.

---

<a id="file-10_protocol_reference"></a>

# Protocol Reference — The Deep Formal Spec

> Source: `reference/protocol/*`. This is the authoritative layer — where it differs from the more casual `builder/*` phrasing, **this section is correct**.

## Account (formal)

Five parts: **ID**, **Code**, **Storage**, **Vault**, **Nonce**. "A hybrid UTXO- and account-based model" enabling "expressive smart contracts via a Turing-complete language." The nonce increments **exactly once per transaction, only if state changed** — matched SWAP notes, for instance, need not increment it. First-time on-chain registration happens when an incoming note is first consumed, not at local account creation.

### Account ID

A **120-bit** identifier. Derivation: hash(random seed + commitments to initial code and initial storage) → apply **6 bits of proof-of-work** to hit the desired account-type encoding → truncate the resulting 256-bit hash to 120 bits. Encodes account **type** (public/private) and **version** directly, readable without the full account state. Type is fixed at creation, immutable thereafter. Two encodings: **bech32** (preferred, e.g. `mm1ap86qhrsrs4gcy2ntrerfkwylure4ly5`) and hex (e.g. `0x4fa05c701c2a8c115358f234d9c4ff`).

### Address (distinct from Account ID)

Format: `{identifier}_{routing-params}`, e.g. `mm1arp0azyk9jugtgpnnhle8daav58nczzr_qpgqqwcfx0p`. The identifier is bech32-encoded; routing params are *also* bech32-encoded but without the HRP/`1` separator, giving them an independent checksum. Relationship to Account ID is **n-to-1** — one account ID can have many distinct addresses, each encoding different routing/interface/encryption-capability metadata for senders, all resolving to the same underlying account.

### Account Code

"A collection of procedures defining the Account's programmable interface." Each procedure's **MAST root** (32-byte commitment over the code tree) is its callable identity — "a function's behavior cannot change without changing the MAST root." Only an account's own procedures can mutate its own storage/vault. Faucet accounts' procedures can create assets. **Exactly one authentication procedure is mandatory**, executed in the transaction epilogue.

### Account Storage

Up to **255** name-addressable slots (the builder-level docs round this to "255"; the account-page phrasing above independently says "up to 256" — minor internal inconsistency, treat 255 as the more precisely-stated figure). Slot naming: `project_name::component_name::slot_name`, hashed to a compact slot ID for kernel/MASM use (names are too large to use directly). **Value slots**: a single `Word` (~32 bytes via the recommended 8×32-bit-element encoding). **Map slots**: sparse-Merkle-tree-backed key-value storage — root in the slot, entries as tree leaves, "efficient storage and proof of inclusion for a large number of entries" without needing every entry present during execution; keys are hashed for tree balance but originals retained separately for introspection.

### Account Component (protocol-level formal structure)

Three parts: **Component Code** (a function library, can read/write storage), **Component Metadata** (name/description/version + storage layout with named slots — each slot's ID deterministically derived from its name), **Storage Schema** (`ValueSlotSchema` for single-word entries or `MapSlotSchema` for key-value collections, with typed keys/values and optional static entries; supported Felt types include `void`, `u8`, `u16`, `u32`, `felt`, and domain types like `miden::standards::auth::pub_key`; a composite schema is exactly four `FeltSchema` descriptors per Word). Instantiation needs `InitStorageData` — provided programmatically or via `InitStorageData::from_toml()`, values as TOML strings (including numerics), validated against the schema at instantiation time.

## Note (formal)

- **Assets**: 0–**64** distinct assets per note (a tighter cap than the "0–256" figure quoted at the builder-doc level — **the protocol reference's 64 is the authoritative number**, and it also matches the separately-stated note-vault fixed-capacity limit of 64 assets under [Asset](#asset-formal) below).
- **Script**: consumption logic, Turing-complete, no size limit.
- **Storage**: up to **1024 items (8 KB max)**, accessible during script execution, used to parameterize reusable scripts (e.g. P2ID's target account ID).
- **Serial Number**: random 32 bytes; ensures uniqueness and, for private notes, unlinkability between the note's hash and its nullifier — **leaking it compromises privacy**.
- **Metadata**: always public — sender account ID, note type (private/public), a 32-bit discovery **tag**, up to **4 attachments**.

### RECIPIENT — the exact formula

```
RECIPIENT = hash(hash(hash(serial_num, [0; 4]), script_root), storage_commitment)
```
Only a party who knows the complete preimage (serial number, script, storage) can construct a valid consumption proof — this is what makes a note "addressed" to whoever the creator shared the recipient-computation inputs with.

### Nullifier — the exact formula

```
Nullifier = hash(SERIAL_NUM, SCRIPT_ROOT, STORAGE_COMMITMENT, ASSET_COMMITMENT, METADATA, ATTACHMENTS_COMMITMENT)
```
**This is a correction to note carefully** if you've seen a shorter/looser version of this formula stated elsewhere (including earlier in this project's own design conversation, which described it as `hash(serial_num, script_root, input_commitment, vault_hash)`): the authoritative formula has **six** inputs — `SERIAL_NUM`, `SCRIPT_ROOT`, `STORAGE_COMMITMENT`, `ASSET_COMMITMENT`, `METADATA`, `ATTACHMENTS_COMMITMENT` — not four, and it includes the note's `METADATA` and `ATTACHMENTS_COMMITMENT`, not just an "input"/"vault" pairing. Properties remain as previously understood: the nullifier proves uniqueness/spent-status, cannot be reversed to derive the note's hash, and requires complete note knowledge to compute — so an observer without the full note data cannot tell which note a given nullifier corresponds to, and cannot forge one.

### Note types (exact storage-item counts, protocol-authoritative)

| Type | Storage items | Mechanics |
|---|---|---|
| P2ID | 2 (target account ID) | Consumable only by the matching account |
| **P2IDE** | **4** (target account ID, reclaim block height, time-lock block height) | *"Prevents consumption before time-lock; permits sender reclamation post-reclaim height."* Confirms the builder-level description precisely. |
| SWAP | 16 (requested-asset + payback-note params) | Exactly 1 asset per SWAP note; creates a payback note to the original issuer on consumption |

### Discovery & tags

Tags are "best-effort filters" enabling efficient note queries without fully revealing consumer intent on-chain. Account-targeted notes encode (potentially partial) receiver-ID bits into the tag for a privacy/efficiency tradeoff; use-case notes conventionally encode script-root/asset identifiers instead.

## Transaction (formal)

**Inputs**: one account (full state required), up to **1,024** consumable notes (executor needs complete data for each), blockchain state (reference block + note DB info from the operator), an optional transaction script, optional transaction arguments (runtime injections for dynamic note execution), and optional foreign-account data for cross-account reads.

**Four-phase execution**:
1. **Prologue** — validates on-chain commitments against the supplied data.
2. **Note processing** — sequential execution against the account; each note must fully resolve (via account methods, further note-script invocation, asset creation, or storage mutation).
3. **Transaction script processing** — optional executor code after all notes: signing, minting, note creation, cross-account reads.
4. **Epilogue** — finalization checks: auth-procedure verification, fee computation and removal, "state change or note consumption" requirement, nonce increment if state changed, asset-sum equality (non-faucet accounts).

**Local vs. Network transactions**: **Local** = client-side proving, private, arbitrary computation complexity, no gas-limit-style ceiling per se. **Network** = operator-executed, for managing **public** smart-contract state autonomously (this is the mechanism behind the `network_transactions_tutorial` recipe and `AuthNetworkAccount`).

**Performance/limits**: ~90K cycles for a typical transaction proof; 1–2 seconds proving time on a MacBook Pro baseline; max VM cycles per transaction = **2³⁰**; max **1,000** notes produced and **1,000** consumed per transaction (a tighter *per-transaction* number than the 1,024 *max-input* figure above — read the 1,000 as the practical operative ceiling).

## State (the three node-level databases)

1. **Account database** — sparse-Merkle-tree commitments for all accounts; **full data on-chain for public accounts**, only a 40-byte record (15-byte ID + 32-byte commitment + 4-byte block number) for private ones. Concretely: "1 billion private accounts take up only 47.47 GB of State."
2. **Note database** — append-only Merkle Mountain Range; full content for public notes, commitment-only for private ones. "Only unconsumed public notes and enough information to construct membership proofs must be stored explicitly. Private notes, as well as consumed public notes, can be discarded."
3. **Nullifier database** — sparse Merkle tree of 32-byte nullifiers, each tagged with the block it was created in; unconsumed nullifiers show block `0`, consumed ones show a non-zero block.

## Blockchain (batches → blocks → epochs)

Two-tier aggregation: transactions → **batches** (the batch producer enforces correct ordering for multi-transaction-same-account cases, rejects duplicate/double-spend nullifiers, sets batch expiration to the *minimum* of all included transaction expirations, and strips "erasable" unauthenticated notes that were both created and consumed within the same batch) → **blocks** (multiple batch proofs recursively aggregated into one block proof; the block producer validates account-DB integrity, nullifier-DB updates, block-hash-chain continuity, global note uniqueness across batches, and monotonic timestamps). New nodes verify block **proofs** rather than re-executing every historical transaction — "exponentially faster" genesis sync.

## Fees — ⚠️ direct contradiction with the FAQ page, flagged explicitly

The protocol reference states the fee model **is implemented**, not planned: fee = `verification_base_fee` (a reference-block parameter) × `ceil(log₂(total VM cycles executed))` — i.e. logarithmic in cycle count. Fees are paid exclusively in the chain's native asset (fixed at genesis, consistent across all blocks), charged automatically in the transaction epilogue with no explicit kernel call required, and the transaction **fails during the epilogue** if the account's vault can't cover it. **This directly contradicts** the `builder/faq/` page, which states *"Miden does not yet have a fully implemented fee model, work in progress."* Given the protocol reference is the more precisely-specified, formula-bearing source, treat the fee mechanism as real and budget for it — but verify against the live network before hardcoding the formula into anything cost-sensitive, since the FAQ's staleness suggests this is an area that changed recently.

## Protocol MASM Library

Wraps raw transaction-kernel procedures into "a more convenient interface for common operations," callable from account code, note scripts, and transaction scripts. Module categories: **Account ops** (ID validation/comparison, active-account data retrieval, storage/vault access, native mutations), **Note management** (active-note data, input-note data for consumed notes, output-note creation, recipient/commitment computation utilities), **Transaction-level** (block metadata, note commitments, foreign-account procedure execution, expiration-delta management), **Asset & faucet ops** (fungible/non-fungible creation, mint/burn, validation). Procedures enforce execution-context restrictions (Account [native/foreign], Auth, Faucet, Note, Any — combinable with `&`, e.g. "Native & Account") mirroring the underlying kernel procedures' own security constraints.

<a id="asset-formal"></a>
## Asset (formal encoding)

Unified 256-bit vault-key structure across both asset kinds:
```
[asset_id_suffix (64b) | asset_id_prefix (64b) | faucet_id_suffix (56b) | reserved (5b) | callback_flag (1b) | composition (2b) | faucet_id_prefix (64b)]
```
- **Fungible**: asset-ID limbs zeroed (so all units of the same token type share one key); value = `[amount, 0, 0, 0]`; **max supply 2⁶³ − 2³¹**; instances auto-merge (sum) on combination without faucet involvement; `composition` = `Fungible`.
- **Non-fungible**: asset-ID limbs derived from a hash (guarantees uniqueness); value = `[hash0, hash1, hash2, hash3]`; `composition` = `None`, which prevents kernel-level merging — every instance stays distinct.
- **`callback_flag`**: enables custom issuance logic.
- **Vaults**: account vaults use a sparse Merkle tree (effectively unlimited assets); **note vaults use a fixed list, capacity 64 assets** — this is the authoritative source for the "0–64 assets per note" figure above.

---

<a id="file-11_miden_vm"></a>

# Miden VM

> Source: `reference/miden-vm/*`

## What it is

A stack-based VM operating over the same 64-bit Goldilocks prime field as everything else in Miden (`p = 2^64 − 2^32 + 1`), designed as a compilation target for higher-level languages, with STARK-based proof generation as the core value proposition — "no trusted setup," "minimal cryptographic assumptions," and STARKs' generally-cited post-quantum-resistance profile, per the background page (originating from Technion research, building on Vitalik Buterin's polynomial-proof writeups and StarkWare's FRI/arithmetization work).

## Architecture

Four components: **Stack** (push-down, up to 2³² items deep, only the top 16 directly addressable by most instructions), **Memory** (linear, element-addressable, address range `[0, 2^32)`, optimized for 4-element batch operations), **Chiplets** (specialized circuits — Poseidon2 hashing, 32-bit binary ops, 16-bit range checks — accelerating specific computation kinds), **Host** (the prover-VM communication interface: manages non-deterministic inputs via the advice provider, processes VM-emitted messages). I/O: public inputs seed up to 16 stack values at start; secret inputs flow through the advice provider (stack + key-value map + Merkle store, effectively unbounded); outputs are the remaining stack, capped at 16 elements to avoid errors.

## Program structure — MAST

Programs are a **Merkleized Abstract Syntax Tree**: a binary tree of code blocks, execution starting at the root. Block types: **Join** (sequential, left-then-right), **Split** (conditional — top-of-stack `1` executes left, `0` executes right, anything else fails), **Loop** (top-of-stack `1`/`0` gates entry, re-evaluated after each iteration), **Dyn** (target determined dynamically from the stack — VM must already know a program matching the stack-specified hash), **Call**/**Syscall** (function calls in a separate user context or kernel-level root context respectively, each fixing stack depth to 16 at entry and verifying it on return), and leaf **Basic blocks** (linear op sequences, grouped into hash-friendly batches, padded with NOOPs as needed). Every program reduces to a single domain-separated hash over this structure — the program's identity.

## Performance (Apple M4 Max, Blake3, 96-bit security — single core)

Single-core throughput ≈ **20–25 KHz**; execution itself is under 0.01% of total proving time.

| Cycles | Execution | Proving |
|---|---|---|
| 2¹⁴ | 0.3 ms | 885 ms |
| 2¹⁶ | 0.7 ms | 3.6 s |
| 2¹⁸ | 1.2 ms | 14.7 s |
| 2²⁰ | 11.1 ms | 59 s |

Proving time roughly doubles per cycle-count doubling. Multi-core scales substantially: 16-core M4 Max ≈170 KHz; 64-core Graviton4 ≈205 KHz; 64-core EPYC 9R45 ≈270 KHz (fastest observed) — at 2²⁰ cycles this brings proving down to 3.7–16.0 s depending on hardware. Using **Poseidon2 instead of BLAKE3** enables efficient recursive proof verification but costs a 1.6×–2.2× slowdown. Verification itself is consistently fast: under 1–3 ms.

## Usage (native binary)

Requires Rust 1.90+ (VM itself; the compiler wants 1.93+, the client 1.88+ — worth pinning per-component rather than assuming one Rust version covers the whole toolchain). Three core crates: `miden-processor` (execute), `miden-prover` (execute + prove), `miden-verifier` (verify); the unified `miden-vm` crate bundles all three plus a CLI.
```bash
make exec        # multi-threaded optimized build
make exec-single  # single-threaded
make exec-avx2    # AVX2 SIMD
make exec-sve     # SVE SIMD
./target/optimized/miden-vm [run|prove|verify|compile|example] ...
```
Programs need `.masm` + `.inputs` files. `MIDEN_LOG=trace` for logging, `RAYON_NUM_THREADS=N` for parallelism control, `--debug` to enable debug instructions during `run`.

## Miden Assembly (MASM)

"Stands just above raw Miden VM instruction set" — many instructions map 1:1 to VM opcodes, but MASM adds native control-flow expressions (the assembler transforms these into the program's MAST), macro instructions (expand to raw-instruction sequences), and inlined procedures for modularity. Each MASM instruction encodes as a single byte. Design goals: good compilation target for higher-level languages, human readability, formal-verification-friendliness, compact serialization. 32-bit integers and linear memory are treated as VM-native operations.

## Core library modules (`miden::core::*`)

| Module | Purpose |
|---|---|
| `collections::mmr` | Merkle Mountain Ranges |
| `collections::smt` | Sparse Merkle Trees (4-element keys/values) |
| `collections::sorted_array` | Search over sorted word arrays |
| `crypto::aead` | Poseidon2-based authenticated encryption |
| `crypto::dsa::ecdsa_k256_keccak` | secp256k1 ECDSA verification |
| `crypto::dsa::eddsa_ed25519_sha512` | Ed25519 EdDSA verification |
| `crypto::dsa::falcon512_poseidon2` | Post-quantum signature verification |
| `crypto::hashes::{blake3,keccak256,poseidon2,sha256,sha512}` | Hash functions |
| `math::{u64,u128,u256}` | Extended unsigned-integer arithmetic |
| `pcs::fri::frie2f4` | FRI proofs (field extension 2, folding factor 4) |
| `mem` | Random-access memory procedures |
| `stark::mod` | STARK proof-verification helpers |
| `sys` / `sys::vm` | System utilities / VM-facing recursive proof verification |
| `word` | Word manipulation utilities |

---

<a id="file-12_compiler"></a>

# Compiler

> Source: `reference/compiler/*`

The Rust→MASM pipeline: `rustc` compiles Rust to WebAssembly → the Miden compiler frontend converts that Wasm into **Miden IR** (an SSA-based intermediate representation, designed to support multiple future source languages, though Rust/rustc-produced Wasm is the only supported input today) → IR lowers to Miden Assembly. Two developer-facing tools: **`midenc`** (the compiler driver itself, analogous to `rustc` — orchestrates Wasm→IR→MASM and exposes a CLI), and **`cargo-miden`** (a Cargo extension automating `rustc`+`midenc` orchestration, providing project templates, and auto-configuring the Miden SDK dependency). Known limitation: the Wasm frontend doesn't yet support all Wasm extensions — reference types and GC-proposal features specifically called out as unsupported.

---

<a id="file-13_node_rpc"></a>

# Node & RPC

> Source: `reference/node/*`

## Node roles

- **Sequencer** — the centralized block producer: accepts submitted transactions, batches them, proposes blocks, coordinates validator signatures, publishes the block stream.
- **Full Nodes** — replicate the chain from upstream, serve the public RPC API from local state; multiple full nodes can sit behind a load balancer to insulate the sequencer from public traffic, and support block/proof subscriptions.
- **Validator** — independently verifies proposed blocks before commitment and signs accepted ones; on official networks typically run by a separate entity as part of the block-verification/recovery path.
- **Network Transaction Builder (NTX-Builder)** — follows committed blocks, tracks network notes, constructs and proves network transactions (via remote provers), submits them via RPC.
- **Remote Provers** — dedicated workers for expensive proof generation (transaction/batch/block kinds), potentially with their own external-facing load balancer.

"The current network design remains centralized while the proving system and protocol mature" (per the node repo's own README) — worth internalizing: Miden today is *architecturally* headed toward more decentralized sequencing, but is not there yet.

## Full-node quick start

```bash
miden-node bootstrap --data-directory full-node-data --network testnet
miden-node full --data-directory full-node-data --rpc.listen 127.0.0.1:57291 \
  --sync.block-source.url https://rpc.testnet.miden.io
grpcurl -plaintext localhost:57291 rpc.Api/Status   # -plaintext because the local listener has no TLS
```
Swap `testnet` for another network + matching RPC URL as needed.

## Public RPC API (the full `rpc.Api` gRPC surface)

| Method | Purpose |
|---|---|
| `Status` | Node RPC version, genesis commitment, store/block-producer status |
| `GetLimits` | Returns configured per-endpoint parameter limits (see table below) |
| `GetAccount` | Witness data + optional details, public accounts |
| `GetBlockByNumber` | Raw block data, optionally with proof |
| `GetBlockHeaderByNumber` | Header + optional MMR authentication data |
| `GetNotesById` | Committed notes matching requested IDs |
| `GetNoteScriptByRoot` | A note script by its script root |
| `SubmitProvenTx` | Submit one proven transaction, returns current block height |
| `SubmitProvenTxBatch` | Submit an atomic batch of proven transactions |
| `SyncTransactions` | Tx records for specified accounts within a block range |
| `SyncNotes` | Note metadata + inclusion proofs for matching tags within a range |
| `SyncNullifiers` | Nullifiers matching 16-bit prefixes within a range |
| `SyncAccountVault` | Public account vault updates within a range |
| `SyncAccountStorageMaps` | Public account storage-map updates within a range |
| `SyncChainMmr` | MMR delta for chain-MMR sync |
| `BlockSubscription` | Streams committed blocks, replays history before going live |
| `ProofSubscription` | Streams block proofs, replays existing before going live |
| `GetNetworkNoteStatus` | Lifecycle status of an NTX-builder-tracked network note |

**Request limits** (via `GetLimits`): `GetAccount` 64 storage-map keys; `GetNotesById` 100 note IDs; `SyncNotes` 1000 tags; `SyncNullifiers` 1000 prefixes; `SyncTransactions` 1000 account IDs.

**Error model**: standard gRPC status codes plus method-specific enums in the `details` field. `SubmitProvenTx`/`SubmitProvenTxBatch` specifically: `Internal(0)`, `Expired(1)`, `StateConflict(2)` (nullifier conflicts/duplicate notes/account mismatch), `CapacityExceeded(3)` (mempool full). Write operations require an explicit `Accept` header with a `genesis` parameter — "ensuring the client explicitly targets the intended network" (a safety mechanism against accidentally submitting testnet transactions to devnet or vice versa).

**Streaming best practice**: persist your local progress *before* confirming work complete; on disconnect, reconnect from the last saved checkpoint rather than assuming undelivered items were actually lost.

## Official network URLs

| Service | Testnet | Devnet |
|---|---|---|
| RPC | `https://rpc.testnet.miden.io` | `https://rpc.devnet.miden.io` |
| Explorer | `https://explorer.testnet.miden.io` (MidenScan; also seen as `https://testnet.midenscan.com`) | `https://explorer.devnet.miden.io` (`https://devnet.midenscan.com`) |
| Faucet | `https://faucet.testnet.miden.io` | `https://faucet.devnet.miden.io` |
| Status | `https://status.testnet.miden.io` | `https://status.devnet.miden.io` |

General pattern: `https://<service>.<network>.miden.io`. **The docs explicitly warn against hard-coding these for anything beyond demos** — "the Miden ops team moves endpoints as new nodes come online" — pull current URLs from the status pages for production use. **No mainnet exists yet** — testnet and devnet are the only live networks as of this crawl.

---

<a id="file-14_github_catalog"></a>

# GitHub Organization Catalog (github.com/0xMiden)

> Source: GitHub REST API (`api.github.com/orgs/0xMiden/repos`), 52 repositories surveyed directly. Both `protocol` and `miden-vm`'s own READMEs carry an explicit alpha-stage warning: *"This project is in an alpha stage. It has not been audited and may contain bugs and security flaws. This implementation is NOT ready for production use."* Treat that as applying to the whole stack, not just those two repos.

## ⚠️ Naming correction (matches skill.md's own warning)

The docs' `skill.md` file lists the client repo as `0xMiden/miden-client` — but that name now **redirects** (HTTP 301) to the actual current repo, **`0xMiden/rust-sdk`**. This is exactly the kind of stale-path trap `skill.md`'s own "Common Pitfalls" section warns about ("Do not assume old `builder/develop` docs paths still exist... Do not cite a GitHub blob URL unless the referenced file still exists at that branch or tag") — ironic that its own repo-map table hadn't caught up to this particular rename at time of writing. **Use `0xMiden/rust-sdk` as the canonical name.** Separately, the browser-facing SDKs (`@miden-sdk/miden-sdk`, `@miden-sdk/react`, `@miden-sdk/vite-plugin`) live in their own dedicated repo, `0xMiden/web-sdk`, not inside `rust-sdk`.

## Core protocol & VM
| Repo | Language | Stars | Notes |
|---|---|---|---|
| `miden-vm` | Rust | 759 | The STARK-based VM — highest-starred repo in the org by a wide margin |
| `crypto` | Rust | 136 | "Cryptographic primitives used in Polygon Miden rollup" (note the legacy "Polygon Miden" naming in the description — Miden was previously a Polygon-affiliated project before becoming the independent `0xMiden` org) |
| `protocol` | Rust | 127 | Core protocol types/structures — the account model, notes, assets, transactions |
| `compiler` | Rust | 111 | Rust → Miden Assembly compiler |
| `node` | Rust | 100 | Reference node implementation (sequencer + full node), defines the public gRPC API |
| `air-script` | Rust | 97 | DSL for writing AIR constraints for STARKs (a supporting/general-purpose crypto tool, not Miden-specific business logic) |
| `rust-sdk` | Rust | 75 | **The actual current name for what `skill.md` still calls "miden-client"** — the Rust client library + CLI |

## Client SDKs, tooling, examples
| Repo | Language | Stars | Notes |
|---|---|---|---|
| `examples` | TypeScript | 21 | Example usage of Polygon Miden (older naming again) |
| `tutorials` | Rust | 16 | Source for the docs tutorials (Miden Bank, recipes) |
| `midenup` | Rust | 7 | The toolchain installer |
| `agentic-template` | Shell | 7 | "Mono repo template for agentic assisted full-stack development on Miden" — notable for AI-agent-assisted dev workflows specifically |
| `rust-templates` | Rust | 1 | Starter-project templates |
| `web-sdk` | TypeScript | 1 | The `@miden-sdk/*` browser SDK source (separate from `rust-sdk`, despite skill.md implying otherwise) |
| `frontend-template` | TypeScript | 0 | Template repo for a Miden web app |
| `project-template` | Rust | 0 | Generic Rust project template |
| `developer-playground` | Rust | 0 | Source for the browser playground at playground.miden.xyz |
| `miden-lsp` / `vscode-extension` | Rust / TypeScript | 1 / 1 | Language server + VS Code extension for MASM/Miden projects |
| `zed-extension` | Tree-sitter Query | 2 | Editor support for Zed |
| `tree-sitter-masm` | JavaScript | 0 | MASM grammar for Tree-sitter-based editor tooling |
| `agent-tools` | — | 1 | "A shared knowledge base for agentic skills for building with Miden" |
| `awesome-miden` | — | 0 | Community-curated links/resources list |
| `faucet` | Rust | 10 | Testnet token faucet application |
| `clob-example` | Rust | 3 | An example (central-limit-order-book) application |
| `takeoff` | TypeScript | 2 | "Miden Takeoff" — purpose unclear from README alone, check before depending on it |
| `wallet` | TypeScript | 1 | A wallet implementation |

## Multisig, Guardian & bridging
| Repo | Language | Stars | Notes |
|---|---|---|---|
| `MultiSig` | TypeScript | 12 | "Building a MultiSig PoC" — likely the multisig-client SDK's home or an earlier iteration of it |
| `para-sdk` | JavaScript | 6 | "The Miden x Para SDK integration" — backing `@miden-sdk/para` (not found on npm at crawl time, verify before use) |
| `turnkey-sdk` | JavaScript | 3 | "Miden x Turnkey" — backing `@miden-sdk/miden-turnkey-react` (npm-confirmed v1.15.1) |
| `wallet-adapter` | TypeScript | 1 | "Modular TypeScript wallet adapters and components for Miden applications" — likely backs `@miden-sdk/wallet-adapter-react` (also not found on npm at crawl time) |
| `guardian-dashboard` | TypeScript | 0 | The operator Dashboard UI referenced in the Guardian docs |
| `note-transport-service` | Rust | 3 | The note-transport-network node implementation |
| `bridge-portal` | TypeScript | 0 | Likely the front-end for the Sepolia↔Miden testnet bridge sandbox |

Notably, **no standalone `miden-guardian` repo appears in the public `0xMiden` org** despite Guardian being extensively documented — since Guardian is explicitly "built by OpenZeppelin," its core server implementation most likely lives in an OpenZeppelin-controlled repo rather than under `0xMiden`; only the dashboard and (likely) the multisig client are visible here.

## STARK/proving internals & forks
| Repo | Language | Stars | Notes |
|---|---|---|---|
| `Plonky3` | Rust | 4 | Fork — "A toolkit for polynomial IOPs (PIOPs)," the proving-system base Miden VM builds on |
| `p3-miden` | Rust | 4 | **Archived** — Miden-specific Plonky3 crates |
| `rust-fn-dsa` | — | 0 | Fork — FN-DSA (Falcon) signature scheme implementation |
| `rowan` | — | 0 | Fork (general-purpose syntax-tree library, likely a compiler dependency) |
| `miden-diagnostics` / `miden-parsing` / `miden-formatting` | Rust | 0 each | Compiler-support crates (error diagnostics, parsing, pretty-printing) |
| `miden-miette` | Rust | 0 | Fork — pretty error-reporting extension |
| `midenc-hir-type` | Rust | 0 | **Archived** — shared compiler/assembler component |
| `miden-signature` | Rust | 0 | Signature-related crate, purpose unclear from name alone |
| `miden-debug` | Rust | 1 | "Interactive debugger for Miden programs" |

## Governance & misc
| Repo | Notes |
|---|---|
| `miden-proposals` | Protocol improvement proposals |
| `feedback` | "collect feedback on everything Miden related" |
| `.github` | Org-wide GitHub config/templates |
| `homepage` | Content for the miden.xyz marketing site |
| `docs` | The Docusaurus documentation site source (this whole crawl's origin) |
| `wasm-bridge` | Purpose unclear from name/description alone — check before depending on it |

---

<a id="file-15_bridge"></a>

# Building with Miden + 0G — Bridging Notes

> Synthesis written specifically for the exam-paper-leak-prevention design discussed earlier in this project. This section corrects a few specifics now that the formal spec has been checked directly, and points at building blocks discovered during this crawl that weren't known about when the architecture was first sketched.

## Corrections to what was said earlier

1. **The nullifier formula has six inputs, not four.** Earlier conversation described it as `hash(serial_num, script_root, input_commitment, vault_hash)`. The [protocol reference](#file-10_protocol_reference) gives the authoritative formula as `hash(SERIAL_NUM, SCRIPT_ROOT, STORAGE_COMMITMENT, ASSET_COMMITMENT, METADATA, ATTACHMENTS_COMMITMENT)` — six fields, including the note's metadata and attachments commitment. This doesn't change the forensic-tracing argument (post-leak, a nullifier still can't be reverse-engineered to reveal which note produced it without already knowing the note's full data), but cite the correct formula if this ends up in anything technical.
2. **Time-locking is not P2IDE-exclusive.** The FAQ states plainly that Miden "enables consumption of notes based on time conditions, such as: A specific block height being reached, A timestamp threshold being passed, An oracle providing specific data, Another transaction being confirmed." P2IDE is the *standard, ready-made* note type for the simplest case (block-height time-lock + reclaim), but custom note scripts can gate consumption on richer conditions — including, notably, **"an oracle providing specific data,"** which is directly relevant if the release condition should be "N independent authorities confirm exam-start" rather than a bare block height. There's also a dedicated `oracle_tutorial` recipe (see [Tutorials](#file-08_tutorials)) worth reading before implementing this.
3. **Miden notes do not natively encrypt payloads.** Per the FAQ: *"At the moment, Miden does not have support for encrypted notes but it is a planned feature."* The privacy the exam-paper design needs — "custodians can transport a package without being able to read it" — comes from **application-level encryption before the data ever becomes note inputs/storage**, combined with Miden's private-note storage mode (which only publishes a commitment, not the data itself). These are two separate, stacked privacy layers, not one built-in feature — worth being precise about this distinction if describing the design to a security-literate audience.
4. **The exact P2IDE storage layout is now confirmed precisely**: `target_account_id_prefix`/`target_account_id_suffix` (Felt), `reclaim_height` (Felt), `timelock_height` (Felt) — 4 storage items — with creation via `P2ideNote::create(sender, P2ideNoteStorage::new(target, reclaim_height, timelock_height), assets, note_type, attachments, rng)` at the Rust-client level, or exposed as simple high-level options (`reclaimAfter`, `timelockUntil`) on `client.transactions.send({...})` in the **Web SDK** — meaning the time-lock mechanic is genuinely easy to reach, not a low-level obscure feature (see [Client SDKs](#file-07_client_sdks)).
5. **Fee reality check**: the FAQ says fees are "not yet implemented," but the [protocol reference](#file-10_protocol_reference) describes a fully specified, implemented logarithmic fee formula. Both can't be simultaneously current — treat fees as real (budget for them) but verify against the live testnet before finalizing any cost model, since this contradiction itself suggests the fee model is an area that changed recently and the FAQ simply hasn't caught up.

## A building block that wasn't in the original design: Miden Guardian's Multisig SDK

This is the single most useful discovery from this crawl for the exam-paper use case. The original design called for "a threshold of independent key-holders (judiciary, opposition-nominated observers, external auditors) who release key shares simultaneously at T-0" — that's *exactly* what [Miden Guardian's M-of-N Multisig SDK](#file-09_guardian) already implements, off the shelf: configurable threshold (M) out of N authorized cosigners, each holding a Falcon key commitment, with a **Pending → Ready → Finalized** proposal lifecycle and, critically, **offline/air-gapped signing support** (export a proposal to JSON, sign it on a disconnected device, re-import) — which maps directly onto "some custodians should be able to hold a cold, network-isolated key." Rather than designing a bespoke threshold-release mechanism from scratch, the paper-release step could plausibly be modeled as a Guardian multisig proposal requiring M of N designated authorities to co-sign before the P2IDE-style release note becomes consumable. This is a concrete, already-implemented (`npm: @openzeppelin/miden-multisig-client`, currently v0.16.0) building block worth prototyping against directly, rather than something to design from first principles.

## What to re-verify before committing this to an actual build

- **No mainnet exists yet.** Testnet and devnet only, and both `protocol` and `miden-vm` explicitly carry alpha-stage, not-production-ready warnings. Any real deployment timeline for a paper-leak system needs to account for Miden's own maturity curve, not just the exam board's institutional adoption curve discussed earlier.
- **Bridging is testnet-only and explicitly a mock/sandbox** (Sepolia↔Miden-testnet). If any part of the design assumed moving value or attestations between Miden and another chain (e.g. anchoring a periodic public commitment on a more established chain, or interacting with 0G Chain directly), that bridge doesn't exist in a production-usable form today — a cross-chain anchor would need to be built and operated independently rather than relying on Miden's own bridge tooling.
- **Version drift is real and active** — the docs' own nominal "stable" tree already shows 0.15-era package versions and a "0.15 Migration" guide living outside the `/next/` unstable path. Anything built today should pin exact `miden`/`miden-client`/`@miden-sdk/*` versions rather than trusting "stable" as a fixed target, and should re-check `https://docs.miden.xyz/llms.txt` for the current default version before implementation begins in earnest.
