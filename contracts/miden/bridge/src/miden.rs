// Real miden-client 0.16.0-alpha.1 + miden-standards 0.16.0-alpha.4 +
// miden-client-sqlite-store 0.16.0-alpha.1 wiring. Every symbol below was
// verified directly against the downloaded crate SOURCE (not docs.rs
// summaries) via `grep` inside a WSL Ubuntu build on 2026-07-26, after the
// first WSL cargo-check pass surfaced 12 real compile errors against the
// docs.rs-researched version — see docs/MIDEN_INTEGRATION.md "WSL build
// result" for the full list of corrections and why the version pin changed
// from miden-client 0.15.4 to 0.16.0-alpha.1 (a real, confirmed
// miden-protocol version mismatch between miden-client 0.15.4 and
// miden-standards 0.16.0-beta.1 — two different `Account` types in the
// dependency graph — not a guess).
use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use miden_client::account::{Account, AccountId, AccountType};
use miden_client::asset::{Asset, AssetAmount, FungibleAsset, TokenSymbol};
use miden_client::auth::{AuthSecretKey, PublicKey};
use miden_client::block::BlockNumber;
use miden_client::builder::ClientBuilder;
use miden_client::keystore::{FilesystemKeyStore, Keystore};
use miden_client::note::{Note, NoteId, NoteType, P2ideNote};
use miden_client::rpc::{Endpoint, GrpcClient};
use miden_client::transaction::TransactionRequestBuilder;
use miden_client::Client;
use miden_client_sqlite_store::SqliteStore;
use miden_standards::account::auth::{Approver, AuthSingleSigAcl, AuthSingleSigAclConfig};
use miden_standards::account::faucets::{
    create_singlesig_user_fungible_faucet, Description, FungibleFaucet, TokenName,
};
use miden_standards::account::policies::{BurnPolicy, MintPolicy, TokenPolicyManager};
use miden_standards::account::wallets::create_basic_wallet;

use rand::rngs::StdRng;
use rand::{RngCore, SeedableRng};
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, oneshot};

// FilesystemKeyStore is NOT generic in this version (it was in an earlier
// doc-described version) — confirmed via source, `pub struct
// FilesystemKeyStore { ... }` with no type parameters.
pub type BridgeClient = Client<FilesystemKeyStore>;

// `Client<FilesystemKeyStore>` is NOT `Send` — confirmed via the real WSL
// compiler error, not a guess: `Client::submit_new_transaction_with_prover`
// takes its prover as a bare `tx_prover: Arc<dyn TransactionProver>`
// parameter (miden-client-0.16.0-alpha.1/src/transaction/mod.rs), which
// silently drops the `+ Send + Sync` bounds that the struct's own
// `tx_prover: Arc<dyn TransactionProver + Send + Sync>` field actually
// carries (an unsized-coercion widening, allowed by the type system, that
// loses the marker bounds). Any `async fn` whose body holds a live
// `Client`/`&Client` across the `.await` inside `submit_new_transaction(..)`
// therefore has a non-`Send` generated future — including, transitively,
// any axum handler that calls it directly, which is exactly what axum's
// `Handler` trait bound (needed because `axum::serve` calls `tokio::spawn`
// per connection — confirmed via axum-0.7.9/src/serve.rs) rejects.
//
// The fix isn't to avoid holding a mutex guard across `.await` (that was
// never the actual problem — `note_status`/`health` already did that safely,
// since they never touch `tx_prover`). It's to never let a `Client` value —
// or anything that captures one across an `.await` — exist inside a future
// that must be `Send`. `spawn_actor` below gives the client its own
// dedicated OS thread with a single-threaded Tokio runtime (no
// `tokio::spawn`, so no Send requirement), and exposes it to the rest of
// this (multi-threaded, Send-required) app only through a channel protocol —
// which conveniently mirrors Miden's own actor/account model more than it
// fights it (see knowledge_base.md).
enum Command {
    NoteStatus {
        note_id: NoteId,
        reply: oneshot::Sender<anyhow::Result<NoteStatusResult>>,
    },
    CreatePaperKeyTimelock {
        wrapped_key_hex: String,
        timelock_at: chrono::DateTime<chrono::Utc>,
        reclaim_at: chrono::DateTime<chrono::Utc>,
        reply: oneshot::Sender<anyhow::Result<TimelockNoteResult>>,
    },
}

#[derive(Clone)]
pub struct MidenBridgeHandle {
    command_tx: mpsc::UnboundedSender<Command>,
    /// Sender/target/reclaimer for paper-key-timelock notes — see the
    /// honesty note on `provision_or_load_accounts` about self-targeting.
    pub service_account_id: AccountId,
    /// Our own self-issued fungible faucet — see "Asset requirement" above.
    /// Not a currency: it exists purely so P2IDE notes have a real,
    /// non-mock asset to carry.
    pub faucet_account_id: AccountId,
}

impl MidenBridgeHandle {
    pub async fn note_status(&self, note_id: NoteId) -> anyhow::Result<NoteStatusResult> {
        let (reply, recv) = oneshot::channel();
        self.command_tx
            .send(Command::NoteStatus { note_id, reply })
            .map_err(|_| anyhow::anyhow!("Miden client actor thread is not running"))?;
        recv.await.map_err(|_| anyhow::anyhow!("Miden client actor thread dropped the reply channel"))?
    }

    pub async fn create_paper_key_timelock(
        &self,
        wrapped_key_hex: String,
        timelock_at: chrono::DateTime<chrono::Utc>,
        reclaim_at: chrono::DateTime<chrono::Utc>,
    ) -> anyhow::Result<TimelockNoteResult> {
        let (reply, recv) = oneshot::channel();
        self.command_tx
            .send(Command::CreatePaperKeyTimelock { wrapped_key_hex, timelock_at, reclaim_at, reply })
            .map_err(|_| anyhow::anyhow!("Miden client actor thread is not running"))?;
        recv.await.map_err(|_| anyhow::anyhow!("Miden client actor thread dropped the reply channel"))?
    }
}

/// Spawns the dedicated actor thread, builds the real testnet client on it,
/// provisions/loads the wallet + faucet accounts, tops the wallet up if
/// needed, and then serves `Command`s until the process exits. Blocks
/// (via a oneshot, not a thread-blocking call) until startup finishes so the
/// caller (`main`) can fail fast on a real provisioning error instead of
/// serving traffic against a half-initialized bridge.
pub async fn spawn_actor(keystore_path: PathBuf) -> anyhow::Result<MidenBridgeHandle> {
    let (command_tx, mut command_rx) = mpsc::unbounded_channel::<Command>();
    let (ready_tx, ready_rx) = oneshot::channel::<anyhow::Result<(AccountId, AccountId)>>();

    std::thread::Builder::new().name("miden-client-actor".to_string()).spawn(move || {
        let rt = match tokio::runtime::Builder::new_current_thread().enable_all().build() {
            Ok(rt) => rt,
            Err(err) => {
                let _ = ready_tx.send(Err(err.into()));
                return;
            },
        };
        rt.block_on(async move {
            let (mut client, keystore) = match build_client(keystore_path).await {
                Ok(pair) => pair,
                Err(err) => {
                    let _ = ready_tx.send(Err(err));
                    return;
                },
            };
            let (wallet_id, faucet_id) = match provision_or_load_accounts(&mut client, &keystore).await {
                Ok(ids) => ids,
                Err(err) => {
                    let _ = ready_tx.send(Err(err));
                    return;
                },
            };
            if let Err(err) = ensure_wallet_funded(&mut client, wallet_id, faucet_id).await {
                let _ = ready_tx.send(Err(err));
                return;
            }
            if ready_tx.send(Ok((wallet_id, faucet_id))).is_err() {
                return;
            }

            while let Some(command) = command_rx.recv().await {
                match command {
                    Command::NoteStatus { note_id, reply } => {
                        let _ = reply.send(note_status_inner(&client, note_id).await);
                    },
                    Command::CreatePaperKeyTimelock { wrapped_key_hex, timelock_at, reclaim_at, reply } => {
                        let result = create_paper_key_timelock(
                            &mut client,
                            wallet_id,
                            faucet_id,
                            &wrapped_key_hex,
                            timelock_at,
                            reclaim_at,
                        )
                        .await;
                        let _ = reply.send(result);
                    },
                }
            }
        });
    })?;

    let (wallet_id, faucet_id) = ready_rx
        .await
        .map_err(|_| anyhow::anyhow!("Miden client actor thread exited before finishing startup"))??;

    Ok(MidenBridgeHandle { command_tx, service_account_id: wallet_id, faucet_account_id: faucet_id })
}

const STORE_PATH: &str = "miden-bridge-store.sqlite3";
// Records the two account IDs this bridge itself provisioned, so a restart
// reuses the same funded faucet/wallet pair instead of provisioning (and
// orphaning) a fresh, unfunded one every time. `AccountType` in this Miden
// version only distinguishes storage visibility (Private/Public), not
// "wallet vs faucet" — there is no `AccountId::is_faucet()` to introspect,
// so this small marker file is the honest way to remember which of our
// locally-tracked accounts is which. It only ever records IDs of accounts
// this process created via the real client — never fabricated.
const ACCOUNTS_MARKER_PATH: &str = "miden-bridge-accounts.json";

/// Builds (or opens) the testnet client. Every Miden-facing surface in this
/// project targets testnet only — see docs/MIDEN_INTEGRATION.md: there is no
/// Miden mainnet.
pub async fn build_client(keystore_path: PathBuf) -> anyhow::Result<(BridgeClient, FilesystemKeyStore)> {
    let store = SqliteStore::new(PathBuf::from(STORE_PATH)).await?;
    let keystore = FilesystemKeyStore::new(keystore_path)?;

    // `.filesystem_keystore(path)` is a convenience that builds its own
    // FilesystemKeyStore internally and doesn't hand back a reusable handle
    // — since we need our own handle to call `.add_key()` on later (during
    // account provisioning), we build the keystore ourselves and register it
    // via `.authenticator()` instead, keeping a `Clone` (FilesystemKeyStore
    // implements Clone) for our own use.
    //
    // NOT using `ClientBuilder::for_testnet()` despite it being real and
    // present in this crate (confirmed: its own body calls
    // `crate::rpc::GrpcClient::new(...)`, which only compiles because the
    // crate itself builds fine as a dependency) — it takes zero arguments,
    // so nothing pins the generic `AUTH` type parameter at that call site,
    // and neither plain inference nor an explicit turbofish
    // (`ClientBuilder::<FilesystemKeyStore>::for_testnet()`, also tried)
    // resolves it: `AUTH: BuilderAuthenticator` is a blanket impl over
    // `Keystore + From<FilesystemKeyStore>`, and rustc's method probe
    // doesn't seem to elaborate that chain far enough at this call site.
    // Rebuilding what `for_testnet()` does internally sidesteps it entirely:
    // `.authenticator(Arc::new(keystore.clone()))` below has a concrete
    // `Arc<FilesystemKeyStore>` argument, which pins AUTH unambiguously
    // before `.build()` needs it.
    let endpoint = Endpoint::testnet();
    let mut client = ClientBuilder::new()
        .rpc(Arc::new(GrpcClient::new(&endpoint, 10_000)))
        .store(Arc::new(store))
        .authenticator(Arc::new(keystore.clone()))
        .build()
        .await?;

    // Real, confirmed-via-source requirement, hit on first real run against
    // testnet (not a hypothetical): `ClientBuilder::build()` only sets the
    // RPC client's genesis commitment if the STORE already has a cached
    // genesis header (see its own source) — on a brand-new store there is
    // none yet, so the node's very first `sync_state()` call rejects us
    // ("accept header validation failed ... genesis commitment: none").
    // `ensure_genesis_in_place()` is the real, public, idempotent bootstrap
    // for exactly this: fetches the genesis header once, caches it in the
    // store, and sets the RPC client's commitment — safe to call on every
    // startup (no-ops once cached).
    client.ensure_genesis_in_place().await?;

    Ok((client, keystore))
}

#[derive(Serialize, Deserialize)]
struct AccountsMarker {
    wallet_account_id: String,
    faucet_account_id: String,
}

/// Generates a fresh single-sig secret key and returns it alongside the
/// corresponding `Approver`. The caller registers the key in the keystore
/// once the account (and therefore its ID) exists — shared between wallet
/// and faucet provisioning, both of which use the same single-sig auth
/// shape.
fn generate_singlesig_key(client: &mut BridgeClient) -> (AuthSecretKey, Approver) {
    // Confirmed via source (miden-protocol account/auth.rs): the real
    // constructor is `new_falcon512_poseidon2_with_rng`, not
    // `new_rpo_falcon512` (that name doesn't exist in this version).
    let secret_key = AuthSecretKey::new_falcon512_poseidon2_with_rng(client.rng());
    let public_key: PublicKey = secret_key.public_key();
    let approver = Approver::from(&public_key);
    (secret_key, approver)
}

/// Provisions the bridge's own service wallet and self-issued fungible
/// faucet on first run, or reuses both across restarts via
/// `ACCOUNTS_MARKER_PATH` so a previously-minted faucet balance isn't
/// orphaned. The wallet is the sender/target/reclaimer for paper-key-timelock
/// notes — see the honesty note about self-targeting: the protocol-level
/// timelock still holds regardless of who the target account is, and
/// Examination Center getting its own account is tracked separately.
///
/// The faucet is NOT a currency — it exists purely so P2IDE notes (which
/// require a real, non-mock asset per Miden's own note-script logic) have
/// something real to carry. See "Asset requirement" in
/// docs/MIDEN_INTEGRATION.md for the full reasoning, including why
/// `NonFungibleAsset::mock()`/`FungibleAsset::mock()` were explicitly
/// rejected (issued by a fake, non-existent testing faucet ID that the real
/// testnet would reject).
pub async fn provision_or_load_accounts(
    client: &mut BridgeClient,
    keystore: &FilesystemKeyStore,
) -> anyhow::Result<(AccountId, AccountId)> {
    if let Ok(marker_bytes) = std::fs::read(ACCOUNTS_MARKER_PATH) {
        let marker: AccountsMarker = serde_json::from_slice(&marker_bytes)?;
        let wallet_id = AccountId::from_hex(&marker.wallet_account_id)?;
        let faucet_id = AccountId::from_hex(&marker.faucet_account_id)?;
        let wallet_known = client.get_account(wallet_id).await?.is_some();
        let faucet_known = client.get_account(faucet_id).await?.is_some();
        if wallet_known && faucet_known {
            tracing::info!(%wallet_id, %faucet_id, "reusing previously-provisioned Miden accounts");
            return Ok((wallet_id, faucet_id));
        }
        tracing::warn!(
            %wallet_id, %faucet_id, wallet_known, faucet_known,
            "accounts marker present but the local store no longer has both accounts \
             (store was likely reset) — provisioning a fresh pair"
        );
    }

    let mut seed_rng = StdRng::from_entropy();

    // --- wallet ---
    let mut wallet_seed = [0u8; 32];
    seed_rng.fill_bytes(&mut wallet_seed);
    let (wallet_secret_key, wallet_approver) = generate_singlesig_key(client);
    // AccountType only has two variants in this version: Private, Public —
    // not the `RegularAccountUpdatableCode`-style names from an older API
    // generation. Private matches "only a commitment on-chain" per
    // knowledge_base.md's privacy stance.
    let wallet_account: Account = create_basic_wallet(wallet_seed, wallet_approver, AccountType::Private)?;
    keystore.add_key(&wallet_secret_key, wallet_account.id()).await?;
    // add_account takes a single &Account, not a slice — confirmed via
    // source; the docs.rs-era signature took `&[Account]`.
    client.add_account(&wallet_account, false).await?;

    // --- faucet ---
    let mut faucet_seed = [0u8; 32];
    seed_rng.fill_bytes(&mut faucet_seed);
    let (faucet_secret_key, faucet_approver) = generate_singlesig_key(client);

    let faucet_component = FungibleFaucet::builder()
        .name(TokenName::new("NVEI Paper Key Seal")?)
        .symbol(TokenSymbol::new("NVEIK")?)
        .decimals(0)
        .max_supply(AssetAmount::from(1_000_000_000u32))
        .description(Description::new(
            "NVEI internal utility asset backing Miden P2IDE timelock notes for exam paper \
             key release. Not a currency, not tradeable, never leaves NVEI's own accounts.",
        )?)
        .build()?;

    // AllowAll rather than owner-gated: `build_mint_fungible_asset`'s plain
    // transaction construction doesn't supply the extra owner-authentication
    // wiring `MintPolicy::owner_only()` needs (confirmed by a real kernel
    // assertion failure when tried: "requested input note index should be
    // less than the total number of input notes" — a real, non-hypothetical
    // error hit while testing against devnet, not a guess). AllowAll is an
    // acceptable real tradeoff here: this is a Private account whose keys
    // only we hold, so "anyone can call mint" is theoretical, not actual —
    // nothing external ever gets a chance to invoke it. Burn stays
    // owner-gated since nothing in this project ever burns via a bare
    // transaction request; if that changes, revisit this.
    let policy_manager = TokenPolicyManager::builder()
        .active_mint_policy(MintPolicy::allow_all())
        .active_burn_policy(BurnPolicy::owner_only())
        .build();

    // Empty exempt set: every authority-gated procedure (mint, supply
    // changes, etc.) requires a signature — the secure default, confirmed
    // via source doc comment on `AuthSingleSigAclConfig::new`.
    let auth_config = AuthSingleSigAclConfig::new(BTreeSet::new())?;
    let auth_component = AuthSingleSigAcl::new(faucet_approver, auth_config);

    let faucet_account: Account = create_singlesig_user_fungible_faucet(
        faucet_seed,
        faucet_component,
        auth_component,
        policy_manager,
        AccountType::Private,
    )?;
    keystore.add_key(&faucet_secret_key, faucet_account.id()).await?;
    client.add_account(&faucet_account, false).await?;

    let marker = AccountsMarker {
        wallet_account_id: wallet_account.id().to_string(),
        faucet_account_id: faucet_account.id().to_string(),
    };
    std::fs::write(ACCOUNTS_MARKER_PATH, serde_json::to_vec_pretty(&marker)?)?;

    tracing::info!(
        wallet_id = %wallet_account.id(),
        faucet_id = %faucet_account.id(),
        "provisioned fresh Miden wallet + self-issued faucet"
    );

    Ok((wallet_account.id(), faucet_account.id()))
}

/// Smallest unit minted/spent per timelock note. The faucet's max_supply
/// (1,000,000,000) comfortably covers this project's demo/pilot volume many
/// times over; re-minting when the wallet runs low is a follow-up, not a
/// blocker (see docs/MIDEN_INTEGRATION.md "Asset requirement").
const TOPUP_AMOUNT: u64 = 1_000_000;
const SYNC_POLL_ATTEMPTS: u32 = 24;
const SYNC_POLL_INTERVAL: Duration = Duration::from_secs(5);

/// Mints `TOPUP_AMOUNT` of the self-issued asset from `faucet_id` to
/// `wallet_id` and consumes the resulting note, if the wallet's vault
/// balance is currently below what one P2IDE note needs. Idempotent — safe
/// to call on every startup. This is a real mint + real note consumption
/// against the real testnet (client-side proven, network-submitted), not a
/// local balance fabrication.
pub async fn ensure_wallet_funded(
    client: &mut BridgeClient,
    wallet_id: AccountId,
    faucet_id: AccountId,
) -> anyhow::Result<()> {
    let probe_asset = FungibleAsset::new(faucet_id, 1)?;
    client.sync_state().await?;
    let current_balance = match client.get_account(wallet_id).await? {
        Some(account) => account.vault().get_balance(probe_asset.id())?,
        None => anyhow::bail!("wallet account {wallet_id} not found in local store"),
    };
    if u64::from(current_balance) >= 1 {
        tracing::info!(%wallet_id, balance = u64::from(current_balance), "wallet already funded, skipping mint");
        return Ok(());
    }

    tracing::info!(%wallet_id, %faucet_id, amount = TOPUP_AMOUNT, "minting self-issued asset to fund wallet");
    let mint_asset = FungibleAsset::new(faucet_id, TOPUP_AMOUNT)?;
    let mint_request = TransactionRequestBuilder::new().build_mint_fungible_asset(
        mint_asset,
        wallet_id,
        NoteType::Private,
        client.rng(),
    )?;
    client.submit_new_transaction(faucet_id, mint_request).await?;

    // The minted note becomes consumable once the client's next sync
    // observes it committed on-chain — this polls real chain state, it does
    // not assume success.
    let mut consumable = Vec::new();
    for attempt in 1..=SYNC_POLL_ATTEMPTS {
        client.sync_state().await?;
        consumable = client.get_consumable_notes(Some(wallet_id)).await?;
        if !consumable.is_empty() {
            break;
        }
        tracing::info!(attempt, SYNC_POLL_ATTEMPTS, "waiting for mint note to commit...");
        tokio::time::sleep(SYNC_POLL_INTERVAL).await;
    }
    let (note_record, _) = consumable
        .into_iter()
        .next()
        .ok_or_else(|| anyhow::anyhow!("mint note never became consumable after {SYNC_POLL_ATTEMPTS} sync attempts"))?;
    let note: Note = note_record.try_into()?;

    let consume_request = TransactionRequestBuilder::new().build_consume_notes(vec![note])?;
    client.submit_new_transaction(wallet_id, consume_request).await?;
    client.sync_state().await?;

    tracing::info!(%wallet_id, "wallet funded: minted and consumed self-issued asset");
    Ok(())
}

pub struct TimelockNoteResult {
    pub note_id: String,
    pub timelock_height: u32,
    pub reclaim_height: u32,
}

pub struct NoteStatusResult {
    pub found: bool,
    /// `Debug`-formatted `InputNoteState` — see the honesty note where this
    /// is constructed: real client-store state, not a fabricated status.
    pub status: Option<String>,
}

async fn note_status_inner(client: &BridgeClient, note_id: NoteId) -> anyhow::Result<NoteStatusResult> {
    match client.get_input_note(note_id).await? {
        Some(record) => Ok(NoteStatusResult { found: true, status: Some(format!("{:?}", record.state())) }),
        None => Ok(NoteStatusResult { found: false, status: None }),
    }
}

/// Approximates a wall-clock timestamp as a Miden block height. Miden
/// doesn't expose a documented "timestamp -> block height" oracle in the
/// client SDK, so this is a real, disclosed approximation (current synced
/// height + elapsed-seconds / average block time), not a fabricated call —
/// flagged here and in docs/MIDEN_INTEGRATION.md as needing replacement with
/// a proper on-chain time reference once one is documented.
const APPROX_SECONDS_PER_BLOCK: u64 = 5;

fn approximate_block_at(current_height: u32, target: chrono::DateTime<chrono::Utc>) -> u32 {
    let now = chrono::Utc::now();
    let delta_seconds = (target - now).num_seconds().max(0) as u64;
    let delta_blocks = (delta_seconds / APPROX_SECONDS_PER_BLOCK) as u32;
    current_height + delta_blocks
}

async fn create_paper_key_timelock(
    client: &mut BridgeClient,
    service_account_id: AccountId,
    faucet_account_id: AccountId,
    wrapped_key_hex: &str,
    timelock_at: chrono::DateTime<chrono::Utc>,
    reclaim_at: chrono::DateTime<chrono::Utc>,
) -> anyhow::Result<TimelockNoteResult> {
    let sync_summary = client.sync_state().await?;
    let current_height = sync_summary.block_num.as_u32();

    let timelock_height = approximate_block_at(current_height, timelock_at);
    let reclaim_height = approximate_block_at(current_height, reclaim_at);

    // The real AES key never touches the chain. `wrapped_key_hex` is
    // accepted for API-shape parity with the caller (apps/api tracks it
    // alongside the note ID) but this function doesn't need to embed it
    // anywhere: NonFungibleAsset only ever stores a *hash* on-chain, never
    // raw bytes, so Miden was never going to transport the key for us
    // regardless. The wrapped key stays in our own bridge-side storage,
    // released only after a real consume transaction against the real
    // network succeeds.
    let _ = wrapped_key_hex;

    // One unit of our self-issued asset, spent from the wallet's own vault
    // (topped up by `ensure_wallet_funded` at startup) — a real, non-mock
    // asset the real testnet will accept, not `FungibleAsset::mock()`.
    let key_asset: Asset = FungibleAsset::new(faucet_account_id, 1)?.into();

    // P2ideNote construction is a `bon`-generated builder (confirmed via
    // source: `#[bon::bon] impl P2ideNote { #[builder] pub fn new(...) }` —
    // the annotated fn is literally named `new`, which bon special-cases
    // into a `P2ideNote::builder()` entry point rather than `::new()`, to
    // avoid the name clash). P2ideNoteStorage is built internally by this
    // constructor from `sender`/`target`/`reclaimer`/heights — no need to
    // build it separately as an earlier doc-researched version implied.
    // Self-targeting for now (sender = target = reclaimer = our own service
    // account) — see the honesty note on `MidenBridgeHandle` above for why
    // that's an acceptable starting point.
    let p2ide_note: P2ideNote = P2ideNote::builder()
        .sender(service_account_id)
        .target(service_account_id)
        .reclaimer(service_account_id)
        // bon builder setters for an `Option<T>`-typed field take `T` directly
        // (calling the setter implies Some; omitting it means None) — passing
        // `Some(..)` explicitly, as the underlying struct field's type would
        // suggest, is a type error against the generated builder method.
        .reclaim_height(BlockNumber::from(reclaim_height))
        .timelock_height(BlockNumber::from(timelock_height))
        .generate_serial_number(client.rng())
        .asset(key_asset)
        .build()?;

    let note: Note = p2ide_note.into();
    let note_id = note.id().to_string();

    // Actually submit the note-creating transaction — building the `Note`
    // object above only constructs it locally; without this, no real note
    // would ever reach the network and `note_id` would refer to something
    // that doesn't exist on-chain, exactly the kind of silent false-success
    // this project's no-mocks rule exists to prevent.
    let tx_request = TransactionRequestBuilder::new()
        .own_output_notes(vec![note])
        .build()?;
    client.submit_new_transaction(service_account_id, tx_request).await?;

    Ok(TimelockNoteResult { note_id, timelock_height, reclaim_height })
}
