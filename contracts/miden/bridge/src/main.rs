// HTTP sidecar consumed by apps/api/src/lib/miden-bridge.ts. Node has no
// first-party Miden client, so the real miden-client Rust SDK lives in this
// process — see docs/MIDEN_INTEGRATION.md for the two flows this bridge
// exists to serve (paper-key P2IDE timelock, private submission
// commitments).
//
// `mod miden` (real, verified-compiling client bootstrap + self-issued
// faucet provisioning + P2IDE note construction) is fully wired in below —
// see miden.rs and docs/MIDEN_INTEGRATION.md "Asset requirement" for how the
// asset gap was resolved: the bridge provisions its own single-sig wallet
// AND a self-issued fungible faucet at startup (or reuses both across
// restarts via the accounts marker file), tops the wallet up with a real
// mint+consume transaction if its vault balance is low, and
// /notes/paper-key-timelock now builds and submits a real P2IDE note against
// the real testnet. /notes/submission-commitment remains an honest 501 — a
// separate flow not yet built.
//
// The real Miden client lives entirely on its own dedicated OS thread (see
// `miden::spawn_actor` and the long comment on `miden::MidenBridgeHandle`
// for why: `Client<FilesystemKeyStore>` isn't `Send`, and axum::serve's
// per-connection `tokio::spawn` requires every handler future to be) — this
// file's `SharedState` is just a cheap-to-clone channel handle, not the
// client itself. Build this crate from WSL/Linux, not native Windows — see
// Cargo.toml.
mod miden;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use miden_client::note::NoteId;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

type SharedState = miden::MidenBridgeHandle;

#[derive(Serialize)]
struct NotImplemented {
    error: &'static str,
    path: String,
}

// Real bug, found by actually running the full Paper Generation pipeline
// (not by inspection): these handlers returned `Json<NotImplemented>` with
// no explicit status code, so Axum defaulted to 200 OK. apps/api's TS
// client only throws on a non-2xx `res.ok` check, so it treated this
// honest-in-body-but-200-in-status response as success, parsed the "error"
// JSON as if it were a real `TimelockNoteResult`, and marked a Paper READY
// with `midenNoteId: null` — a real, silent false-positive this project
// exists specifically to prevent. Fixed by returning the actual 501 status;
// see docs/MIDEN_INTEGRATION.md "Silent-success bug" for the affected
// record and how it was corrected.
fn not_implemented(path: &str, reason: &'static str) -> (StatusCode, Json<NotImplemented>) {
    (StatusCode::NOT_IMPLEMENTED, Json(NotImplemented { error: reason, path: path.to_string() }))
}

#[derive(Deserialize)]
struct CreatePaperKeyTimelockBody {
    #[serde(rename = "wrappedKeyHex")]
    wrapped_key_hex: String,
    #[serde(rename = "timelockAt")]
    timelock_at: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "reclaimAt")]
    reclaim_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
struct TimelockNoteResponse {
    #[serde(rename = "noteId")]
    note_id: String,
    #[serde(rename = "timelockHeight")]
    timelock_height: u32,
    #[serde(rename = "reclaimHeight")]
    reclaim_height: u32,
}

async fn create_paper_key_timelock(
    State(state): State<SharedState>,
    Json(body): Json<CreatePaperKeyTimelockBody>,
) -> (StatusCode, Json<Value>) {
    match state.create_paper_key_timelock(body.wrapped_key_hex, body.timelock_at, body.reclaim_at).await {
        Ok(result) => (
            StatusCode::OK,
            Json(json!(TimelockNoteResponse {
                note_id: result.note_id,
                timelock_height: result.timelock_height,
                reclaim_height: result.reclaim_height,
            })),
        ),
        Err(err) => {
            tracing::error!(error = %err, "create_paper_key_timelock failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": err.to_string(), "path": "/notes/paper-key-timelock" })),
            )
        },
    }
}

async fn create_submission_note() -> (StatusCode, Json<NotImplemented>) {
    not_implemented(
        "/notes/submission-commitment",
        "Not implemented yet — a separate flow from paper-key-timelock, not yet built; \
         see docs/MIDEN_INTEGRATION.md 'Asset requirement'.",
    )
}

/// Real: looks the note up via the actual client store, no fabricated status.
async fn note_status(State(state): State<SharedState>, Path(note_id): Path<String>) -> Json<Value> {
    let parsed = match NoteId::try_from_hex(&note_id) {
        Ok(id) => id,
        Err(err) => return Json(json!({ "error": format!("invalid noteId: {err}"), "noteId": note_id })),
    };

    match state.note_status(parsed).await {
        Ok(result) => Json(json!({ "noteId": note_id, "found": result.found, "status": result.status })),
        Err(err) => Json(json!({ "error": err.to_string(), "noteId": note_id })),
    }
}

async fn consume_note(Path(note_id): Path<String>) -> (StatusCode, Json<Value>) {
    // Consuming genuinely requires a note that was created via the still-blocked
    // creation endpoints above, so there is nothing real to wire here yet
    // beyond what note_status already proves (real client, real note lookup).
    (StatusCode::NOT_IMPLEMENTED, Json(json!({
        "error": "Not implemented yet — no notes can be created until the asset \
                  requirement is resolved, so there is nothing to consume; see \
                  docs/MIDEN_INTEGRATION.md 'Asset requirement'",
        "noteId": note_id,
    })))
}

/// Real: reports the actual provisioned service account and faucet, not
/// static strings.
async fn health(State(state): State<SharedState>) -> Json<Value> {
    Json(json!({
        "ok": true,
        "service": "nvei-miden-bridge",
        "network": "testnet",
        "serviceAccountId": state.service_account_id.to_string(),
        "faucetAccountId": state.faucet_account_id.to_string(),
    }))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let keystore_path = std::env::var("MIDEN_KEYSTORE_PATH").unwrap_or_else(|_| "./miden-bridge-keys".to_string());
    std::fs::create_dir_all(&keystore_path).expect("failed to create Miden keystore directory");

    tracing::info!("starting Miden client actor (client build + account provisioning + wallet funding)...");
    let state: SharedState = miden::spawn_actor(keystore_path.into())
        .await
        .expect("failed to start the Miden client actor");
    tracing::info!(
        service_account_id = %state.service_account_id,
        faucet_account_id = %state.faucet_account_id,
        "Miden client actor ready"
    );

    let app = Router::new()
        .route("/health", get(health))
        .route("/notes/paper-key-timelock", post(create_paper_key_timelock))
        .route("/notes/submission-commitment", post(create_submission_note))
        .route("/notes/:noteId/status", get(note_status))
        .route("/notes/:noteId/consume", post(consume_note))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:50151").await.unwrap();
    tracing::info!("nvei-miden-bridge listening on :50151 (Miden testnet only)");
    axum::serve(listener, app).await.unwrap();
}
