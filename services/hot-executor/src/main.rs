//! hot-executor — latency-critical signing service (Phase 2 of the restructuring).
//!
//! Contract: JSON-lines over stdin/stdout (one request per line, one response per line). The TS
//! control plane builds the unsigned Jupiter swap tx, then calls this service to sign it (and,
//! later, submit + Jito-bundle). Risk gates, sizing, kill-switch, operating-state, and the intent
//! ledger of record stay in the TS control plane — this service only performs mechanical signing
//! and REFUSES anything whose fee payer is not the owner. The 32-byte seed is supplied per-request
//! (owner-held, never persisted), and is NEVER written to logs or echoed in any response.
//!
//! Requests:
//!   {"op":"ping"}
//!   {"op":"sign","intent_id":"...","unsigned_tx_base64":"...","seed":"<base58>" | [u8,...]}
//! Responses:
//!   {"ok":true,"op":"pong"}
//!   {"ok":true,"intent_id":"...","signature":"<b58>","signed_tx_base64":"...","signer_address":"<b58>"}
//!   {"ok":false,"error":"<code>", ...}

mod signer;
mod submit;

use serde::{Deserialize, Serialize};
use std::io::{self, BufRead, Write};

#[derive(Deserialize)]
struct Request {
    op: String,
    intent_id: Option<String>,
    unsigned_tx_base64: Option<String>,
    seed: Option<serde_json::Value>,
    // submit / bundle / tip ops
    signed_tx_base64: Option<String>,
    signed_txs: Option<Vec<String>>,
    skip_preflight: Option<bool>,
    max_retries: Option<u32>,
    tip_floor: Option<serde_json::Value>,
    level: Option<String>,
}

#[derive(Serialize, Default)]
struct Response {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    op: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    intent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    signature: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    signed_tx_base64: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    signer_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    request: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tip_lamports: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn err(code: &str) -> Response {
    Response { ok: false, error: Some(code.to_string()), ..Default::default() }
}

fn normalize_seed(bytes: Vec<u8>) -> Result<Vec<u8>, &'static str> {
    match bytes.len() {
        64 => Ok(bytes[..32].to_vec()), // 64-byte secret = seed || pubkey -> take the seed
        32 => Ok(bytes),
        _ => Err("key_length_invalid"),
    }
}

/// Accept the seed as a base58 string OR a JSON byte array (32 or 64 bytes), matching the TS
/// vault formats. Returns the 32-byte ed25519 seed.
fn seed_from_value(v: &serde_json::Value) -> Result<Vec<u8>, &'static str> {
    if let Some(s) = v.as_str() {
        let bytes = bs58::decode(s.trim()).into_vec().map_err(|_| "key_format_invalid")?;
        return normalize_seed(bytes);
    }
    if let Some(arr) = v.as_array() {
        let mut bytes = Vec::with_capacity(arr.len());
        for n in arr {
            let u = n.as_u64().ok_or("key_format_invalid")?;
            if u > 255 {
                return Err("key_format_invalid");
            }
            bytes.push(u as u8);
        }
        return normalize_seed(bytes);
    }
    Err("key_format_invalid")
}

fn handle(req: Request) -> Response {
    match req.op.as_str() {
        "ping" => Response { ok: true, op: Some("pong".to_string()), ..Default::default() },
        "sign" => {
            let tx = match req.unsigned_tx_base64 {
                Some(t) => t,
                None => return err("missing_unsigned_tx_base64"),
            };
            let seed = match req.seed.as_ref().map(seed_from_value) {
                Some(Ok(s)) => s,
                Some(Err(e)) => return err(e),
                None => return err("missing_seed"),
            };
            match signer::sign_serialized_transaction(&tx, &seed) {
                Ok(s) => Response {
                    ok: true,
                    intent_id: req.intent_id,
                    signature: Some(s.signature_b58),
                    signed_tx_base64: Some(s.signed_tx_base64),
                    signer_address: Some(s.signer_address),
                    ..Default::default()
                },
                Err(e) => {
                    let mut r = err(e.code());
                    r.intent_id = req.intent_id;
                    r
                }
            }
        }
        "build_submit" => match req.signed_tx_base64 {
            Some(tx) => Response {
                ok: true,
                intent_id: req.intent_id,
                request: Some(submit::build_send_transaction_request(
                    &tx,
                    req.skip_preflight.unwrap_or(false),
                    req.max_retries.unwrap_or(3),
                )),
                ..Default::default()
            },
            None => err("missing_signed_tx_base64"),
        },
        "build_bundle" => match req.signed_txs {
            Some(txs) => match submit::build_jito_bundle_request(&txs) {
                Ok(body) => Response { ok: true, intent_id: req.intent_id, request: Some(body), ..Default::default() },
                Err(e) => err(e),
            },
            None => err("missing_signed_txs"),
        },
        "select_tip" => match req.tip_floor {
            Some(tf) => {
                let level = match req.level.as_deref() {
                    Some("low") => submit::TipLevel::Low,
                    Some("aggressive") => submit::TipLevel::Aggressive,
                    _ => submit::TipLevel::Normal,
                };
                Response { ok: true, tip_lamports: Some(submit::select_tip_lamports(&tf, level)), ..Default::default() }
            }
            None => err("missing_tip_floor"),
        },
        other => err(&format!("unknown_op_{other}")),
    }
}

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = stdout.lock();
    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            // a non-UTF8 / transient read error on ONE line must not kill the persistent signer
            // (that would desync the Node client's FIFO queue and hang every pending request)
            Err(_) => continue,
        };
        if line.trim().is_empty() {
            continue;
        }
        let resp = match serde_json::from_str::<Request>(&line) {
            Ok(req) => handle(req),
            Err(_) => err("invalid_json"),
        };
        let body = serde_json::to_string(&resp)
            .unwrap_or_else(|_| "{\"ok\":false,\"error\":\"serialize_failed\"}".to_string());
        if writeln!(out, "{body}").is_err() {
            break;
        }
        let _ = out.flush();
    }
}
