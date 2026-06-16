//! hot-executor — latency-critical hot-path EXECUTION service (Phase Rust-3: the execution owner,
//! expanding outward from signing). It signs EVERY leg of the executed bundle (the swap via `sign`
//! and the whole bundle — e.g. swap + Jito tip — via `sign_bundle`), assembles the pure execution
//! payloads (`build_submit`/`build_bundle`/`select_tip`), and — as of Phase Rust-5 — understands a
//! whole buy/sell execution command as one unit via `build_execution_plan` (sign all legs + assemble
//! the submit/bundle body in ONE call, returning a self-describing envelope). It is **network-free by
//! design**: the actual network POST + retries + the intent ledger (idempotency) stay in the JS plane.
//!
//! Contract: JSON-lines over stdin/stdout (one request per line, one response per line). The TS
//! control plane builds the unsigned Jupiter swap tx (and any bundle legs), then calls this service
//! to sign them. Risk gates, sizing, kill-switch, operating-state, and the intent ledger of record
//! stay in the TS control plane — this service only performs mechanical signing + payload assembly
//! and REFUSES any leg whose fee payer is not the owner. The 32-byte seed is supplied per-request
//! (owner-held, never persisted), and is NEVER written to logs or echoed in any response.
//!
//! Requests:
//!   {"op":"ping"}
//!   {"op":"sign","intent_id":"...","unsigned_tx_base64":"...","seed":"<base58>" | [u8,...]}
//!   {"op":"sign_bundle","intent_id":"...","unsigned_txs":["...","..."],"seed":"<base58>" | [u8,...]}
//!   {"op":"build_execution_plan","intent_id":"...","unsigned_txs":[...],"execution_mode":"rpc"|"jito","side":"buy"|"sell","seed":...}
//! Responses:
//!   {"ok":true,"op":"pong"}
//!   {"ok":true,"intent_id":"...","signature":"<b58>","signed_tx_base64":"...","signer_address":"<b58>"}
//!   {"ok":true,"intent_id":"...","signed_txs":["<base64>","<base64>"]}
//!   {"ok":true,"intent_id":"...","envelope":{"mode","leg_count","side","signatures":[...],"signed_txs":[...],"submit_body"|"bundle_body"}}
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
    unsigned_txs: Option<Vec<String>>,
    skip_preflight: Option<bool>,
    max_retries: Option<u32>,
    tip_floor: Option<serde_json::Value>,
    level: Option<String>,
    // execution-envelope op (Phase Rust-5)
    execution_mode: Option<String>, // "rpc" | "jito"
    side: Option<String>,           // "buy" | "sell" (metadata, echoed)
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
    signed_txs: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    signer_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    request: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tip_lamports: Option<u64>,
    // execution-envelope op (Phase Rust-5): signed_txs + signatures + submit_body|bundle_body + metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    envelope: Option<serde_json::Value>,
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
        // sign_bundle (Phase Rust-3): sign EVERY unsigned leg of an execution bundle (e.g. swap + Jito
        // tip) in one hot-path call, fee-payer-locked per leg. Network-free: the JS control plane builds
        // the unsigned legs and POSTs the resulting bundle (idempotency stays in JS). Any bad leg -> error
        // so the caller can fall back to in-process signing.
        "sign_bundle" => {
            let txs = match req.unsigned_txs {
                Some(t) if !t.is_empty() => t,
                _ => return err("missing_unsigned_txs"),
            };
            let seed = match req.seed.as_ref().map(seed_from_value) {
                Some(Ok(s)) => s,
                Some(Err(e)) => return err(e),
                None => return err("missing_seed"),
            };
            let mut signed = Vec::with_capacity(txs.len());
            for t in &txs {
                match signer::sign_serialized_transaction(t, &seed) {
                    Ok(s) => signed.push(s.signed_tx_base64),
                    Err(e) => return err(e.code()),
                }
            }
            Response { ok: true, intent_id: req.intent_id, signed_txs: Some(signed), ..Default::default() }
        }
        // build_execution_plan (Phase Rust-5): understand a buy/sell execution command as one unit. Sign
        // EVERY unsigned leg (fee-payer-locked) AND assemble the submit/bundle request body in ONE call,
        // returning a self-describing envelope { mode, leg_count, side?, signatures[], signed_txs[],
        // submit_body|bundle_body }. PURE: no network, no idempotency, no db — the JS control plane persists
        // the deterministic signature (signatures[0]), performs the POST, and owns the intent ledger. Any
        // bad leg / bad mode -> error so the caller falls back to the existing sign+submit path.
        "build_execution_plan" => {
            let txs = match req.unsigned_txs {
                Some(t) if !t.is_empty() => t,
                _ => return err("missing_unsigned_txs"),
            };
            let seed = match req.seed.as_ref().map(seed_from_value) {
                Some(Ok(s)) => s,
                Some(Err(e)) => return err(e),
                None => return err("missing_seed"),
            };
            let mode = req.execution_mode.as_deref().unwrap_or("rpc");
            let mut signed_txs: Vec<String> = Vec::with_capacity(txs.len());
            let mut signatures: Vec<String> = Vec::with_capacity(txs.len());
            for t in &txs {
                match signer::sign_serialized_transaction(t, &seed) {
                    Ok(s) => {
                        signed_txs.push(s.signed_tx_base64);
                        signatures.push(s.signature_b58);
                    }
                    Err(e) => return err(e.code()),
                }
            }
            let mut env = serde_json::Map::new();
            env.insert("mode".to_string(), serde_json::Value::String(mode.to_string()));
            env.insert("leg_count".to_string(), serde_json::Value::from(signed_txs.len() as u64));
            if let Some(side) = req.side.as_ref() {
                env.insert("side".to_string(), serde_json::Value::String(side.clone()));
            }
            match mode {
                "jito" => match submit::build_jito_bundle_request(&signed_txs) {
                    Ok(body) => {
                        env.insert("bundle_body".to_string(), body);
                    }
                    Err(e) => return err(e),
                },
                "rpc" => {
                    if signed_txs.len() != 1 {
                        return err("rpc_mode_requires_single_leg");
                    }
                    let body = submit::build_send_transaction_request(
                        &signed_txs[0],
                        req.skip_preflight.unwrap_or(false),
                        req.max_retries.unwrap_or(3),
                    );
                    env.insert("submit_body".to_string(), body);
                }
                _ => return err("invalid_execution_mode"),
            }
            env.insert("signatures".to_string(), serde_json::Value::from(signatures));
            env.insert("signed_txs".to_string(), serde_json::Value::from(signed_txs));
            Response { ok: true, intent_id: req.intent_id, envelope: Some(serde_json::Value::Object(env)), ..Default::default() }
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

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD as B64, Engine};
    use ed25519_dalek::SigningKey;

    // a minimal valid unsigned legacy tx (1 sig slot, 2 keys, no instructions) — fee payer is key 0
    fn unsigned_tx(fee_payer: &[u8; 32]) -> String {
        let mut tx = vec![1u8];
        tx.extend_from_slice(&[0u8; 64]);
        tx.extend_from_slice(&[1, 0, 1]);
        tx.push(2u8);
        tx.extend_from_slice(fee_payer);
        tx.extend_from_slice(&[9u8; 32]);
        tx.push(0u8);
        B64.encode(tx)
    }

    #[test]
    fn sign_bundle_signs_every_leg() {
        let seed = [7u8; 32];
        let pk = SigningKey::from_bytes(&seed).verifying_key().to_bytes();
        let tx = unsigned_tx(&pk);
        let req: Request = serde_json::from_value(serde_json::json!({
            "op": "sign_bundle", "seed": seed.to_vec(), "unsigned_txs": [tx.clone(), tx.clone()]
        })).unwrap();
        let resp = handle(req);
        assert!(resp.ok);
        let signed = resp.signed_txs.expect("signed_txs present");
        assert_eq!(signed.len(), 2);
        for s in &signed {
            assert_ne!(s, &tx, "each leg is signed (slot 0 filled, not the zeroed unsigned tx)");
        }
    }

    #[test]
    fn sign_bundle_rejects_empty_and_bad_leg() {
        let seed = [7u8; 32];
        let empty: Request = serde_json::from_value(serde_json::json!({
            "op": "sign_bundle", "seed": seed.to_vec(), "unsigned_txs": []
        })).unwrap();
        assert!(!handle(empty).ok, "empty bundle rejected");
        let bad: Request = serde_json::from_value(serde_json::json!({
            "op": "sign_bundle", "seed": seed.to_vec(), "unsigned_txs": ["!!not base64!!"]
        })).unwrap();
        assert!(!handle(bad).ok, "a bad leg fails the whole bundle (caller falls back)");
    }

    // ---- Phase Rust-4: op-dispatch (handle) tests for the request-body assembly the JS client consumes ----
    #[test]
    fn build_submit_op_returns_send_transaction_body() {
        let req: Request = serde_json::from_value(serde_json::json!({
            "op": "build_submit", "intent_id": "i1", "signed_tx_base64": "SIGNEDTX", "skip_preflight": true, "max_retries": 5
        })).unwrap();
        let resp = handle(req);
        assert!(resp.ok);
        assert_eq!(resp.intent_id.as_deref(), Some("i1"), "correlation id echoed");
        let body = resp.request.expect("request body present");
        assert_eq!(body["method"], "sendTransaction");
        assert_eq!(body["params"][0], "SIGNEDTX");
        assert_eq!(body["params"][1]["encoding"], "base64");
        assert_eq!(body["params"][1]["skipPreflight"], true);
        assert_eq!(body["params"][1]["maxRetries"], 5);
        let bad: Request = serde_json::from_value(serde_json::json!({ "op": "build_submit" })).unwrap();
        assert!(!handle(bad).ok, "missing signed tx -> error (caller falls back)");
    }

    #[test]
    fn build_bundle_op_returns_send_bundle_body_and_bounds() {
        let req: Request = serde_json::from_value(serde_json::json!({
            "op": "build_bundle", "intent_id": "i2", "signed_txs": ["A", "B"]
        })).unwrap();
        let resp = handle(req);
        assert!(resp.ok);
        assert_eq!(resp.intent_id.as_deref(), Some("i2"));
        let body = resp.request.expect("request body present");
        assert_eq!(body["method"], "sendBundle");
        assert_eq!(body["params"][0].as_array().unwrap().len(), 2);
        assert_eq!(body["params"][1]["encoding"], "base64");
        let six: Vec<String> = (0..6).map(|i| format!("t{i}")).collect();
        let big: Request = serde_json::from_value(serde_json::json!({ "op": "build_bundle", "signed_txs": six })).unwrap();
        assert!(!handle(big).ok, ">5 legs rejected at the op level");
        let none: Request = serde_json::from_value(serde_json::json!({ "op": "build_bundle" })).unwrap();
        assert!(!handle(none).ok, "missing signed_txs -> error");
    }

    #[test]
    fn select_tip_op_returns_tip_lamports() {
        let req: Request = serde_json::from_value(serde_json::json!({
            "op": "select_tip", "tip_floor": [{ "landed_tips_50th_percentile": 0.00001 }], "level": "normal"
        })).unwrap();
        let resp = handle(req);
        assert!(resp.ok);
        assert_eq!(resp.tip_lamports, Some(10000));
        let bad: Request = serde_json::from_value(serde_json::json!({ "op": "select_tip" })).unwrap();
        assert!(!handle(bad).ok, "missing tip_floor -> error");
    }

    // ---- Phase Rust-5: the buy/sell execution envelope (sign all legs + assemble the body in one op) ----
    #[test]
    fn execution_plan_rpc_mode_signs_one_leg_and_builds_submit_body() {
        let seed = [7u8; 32];
        let pk = SigningKey::from_bytes(&seed).verifying_key().to_bytes();
        let tx = unsigned_tx(&pk);
        let req: Request = serde_json::from_value(serde_json::json!({
            "op": "build_execution_plan", "intent_id": "p1", "seed": seed.to_vec(),
            "unsigned_txs": [tx.clone()], "execution_mode": "rpc", "side": "buy"
        })).unwrap();
        let resp = handle(req);
        assert!(resp.ok);
        assert_eq!(resp.intent_id.as_deref(), Some("p1"), "correlation id echoed");
        let env = resp.envelope.expect("envelope present");
        assert_eq!(env["mode"], "rpc");
        assert_eq!(env["side"], "buy");
        assert_eq!(env["leg_count"], 1);
        assert_eq!(env["signed_txs"].as_array().unwrap().len(), 1);
        assert_eq!(env["signatures"].as_array().unwrap().len(), 1);
        assert_ne!(env["signed_txs"][0], serde_json::Value::String(tx), "the leg is signed (slot 0 filled)");
        assert_eq!(env["submit_body"]["method"], "sendTransaction");
        assert_eq!(env["submit_body"]["params"][0], env["signed_txs"][0], "the body carries the signed leg");
        assert!(env.get("bundle_body").is_none(), "rpc mode has no bundle body");
    }

    #[test]
    fn execution_plan_jito_mode_signs_all_legs_and_builds_bundle_body() {
        let seed = [7u8; 32];
        let pk = SigningKey::from_bytes(&seed).verifying_key().to_bytes();
        let tx = unsigned_tx(&pk);
        let req: Request = serde_json::from_value(serde_json::json!({
            "op": "build_execution_plan", "seed": seed.to_vec(),
            "unsigned_txs": [tx.clone(), tx.clone()], "execution_mode": "jito", "side": "sell"
        })).unwrap();
        let resp = handle(req);
        assert!(resp.ok);
        let env = resp.envelope.expect("envelope present");
        assert_eq!(env["mode"], "jito");
        assert_eq!(env["leg_count"], 2);
        assert_eq!(env["signed_txs"].as_array().unwrap().len(), 2);
        assert_eq!(env["signatures"].as_array().unwrap().len(), 2);
        assert_eq!(env["bundle_body"]["method"], "sendBundle");
        assert_eq!(env["bundle_body"]["params"][0].as_array().unwrap().len(), 2, "both signed legs bundled");
        assert!(env.get("submit_body").is_none(), "jito mode has no submit body");
    }

    #[test]
    fn execution_plan_rejects_bad_inputs() {
        let seed = [7u8; 32];
        let pk = SigningKey::from_bytes(&seed).verifying_key().to_bytes();
        let tx = unsigned_tx(&pk);
        let empty: Request = serde_json::from_value(serde_json::json!({
            "op": "build_execution_plan", "seed": seed.to_vec(), "unsigned_txs": [], "execution_mode": "rpc"
        })).unwrap();
        assert!(!handle(empty).ok, "empty legs rejected");
        let multi: Request = serde_json::from_value(serde_json::json!({
            "op": "build_execution_plan", "seed": seed.to_vec(), "unsigned_txs": [tx.clone(), tx.clone()], "execution_mode": "rpc"
        })).unwrap();
        assert_eq!(handle(multi).error.as_deref(), Some("rpc_mode_requires_single_leg"));
        let badmode: Request = serde_json::from_value(serde_json::json!({
            "op": "build_execution_plan", "seed": seed.to_vec(), "unsigned_txs": [tx.clone()], "execution_mode": "carrier_pigeon"
        })).unwrap();
        assert_eq!(handle(badmode).error.as_deref(), Some("invalid_execution_mode"));
        let badleg: Request = serde_json::from_value(serde_json::json!({
            "op": "build_execution_plan", "seed": seed.to_vec(), "unsigned_txs": ["!!notbase64!!"], "execution_mode": "rpc"
        })).unwrap();
        assert!(!handle(badleg).ok, "a bad leg fails the whole plan (caller falls back)");
    }
}
