//! Submit-request construction for the hot path: JSON-RPC `sendTransaction` and Jito `sendBundle`
//! bodies, plus tip selection from Jito `getTipFloor` percentiles. PURE (no network): the TS
//! control plane performs the actual POST with its existing RPC client, retries, and intent
//! ledger (idempotency of record stays in TS). Keeping the correctness-sensitive body/tip math
//! here is the latency-relevant, well-specified part worth compiling.

use serde_json::{json, Value};

const TIP_FLOOR_LAMPORTS: u64 = 1000; // Jito protocol minimum tip per bundle

/// JSON-RPC `sendTransaction` body for a base64 signed tx (mirrors the TS live-executor params).
pub fn build_send_transaction_request(signed_tx_base64: &str, skip_preflight: bool, max_retries: u32) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "sendTransaction",
        "params": [
            signed_tx_base64,
            { "encoding": "base64", "skipPreflight": skip_preflight, "maxRetries": max_retries }
        ]
    })
}

/// Jito `sendBundle` body — up to 5 base64 txs executed sequentially & atomically within one slot.
pub fn build_jito_bundle_request(signed_txs_base64: &[String]) -> Result<Value, &'static str> {
    if signed_txs_base64.is_empty() {
        return Err("bundle_empty");
    }
    if signed_txs_base64.len() > 5 {
        return Err("bundle_too_large_max_5");
    }
    Ok(json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "sendBundle",
        "params": [ signed_txs_base64, { "encoding": "base64" } ]
    }))
}

#[derive(Clone, Copy)]
pub enum TipLevel {
    Low,
    Normal,
    Aggressive,
}

/// Pick a tip in lamports from a Jito `getTipFloor` record (array or object). The percentiles are
/// LANDED-tip values in SOL; a copy bot wants to beat background traffic (50th–75th pct) without
/// entering the hot MEV auction. Falls back to the 1000-lamport protocol floor when the requested
/// percentile is missing or implausible.
pub fn select_tip_lamports(tip_floor: &Value, level: TipLevel) -> u64 {
    let obj = if tip_floor.is_array() {
        tip_floor.get(0).cloned().unwrap_or(Value::Null)
    } else {
        tip_floor.clone()
    };
    let key = match level {
        TipLevel::Low => "landed_tips_25th_percentile",
        TipLevel::Normal => "landed_tips_50th_percentile",
        TipLevel::Aggressive => "landed_tips_75th_percentile",
    };
    let sol = obj.get(key).and_then(|v| v.as_f64()).unwrap_or(0.0);
    let lamports = (sol * 1e9).round();
    if lamports.is_finite() && lamports >= TIP_FLOOR_LAMPORTS as f64 && lamports < 1e12 {
        lamports as u64
    } else {
        TIP_FLOOR_LAMPORTS
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn send_tx_body_shape() {
        let b = build_send_transaction_request("BASE64TX", false, 3);
        assert_eq!(b["method"], "sendTransaction");
        assert_eq!(b["params"][0], "BASE64TX");
        assert_eq!(b["params"][1]["encoding"], "base64");
        assert_eq!(b["params"][1]["skipPreflight"], false);
        assert_eq!(b["params"][1]["maxRetries"], 3);
    }

    #[test]
    fn bundle_body_bounds() {
        assert!(build_jito_bundle_request(&[]).is_err());
        let five: Vec<String> = (0..5).map(|i| format!("tx{i}")).collect();
        let b = build_jito_bundle_request(&five).unwrap();
        assert_eq!(b["method"], "sendBundle");
        assert_eq!(b["params"][0].as_array().unwrap().len(), 5);
        let six: Vec<String> = (0..6).map(|i| format!("tx{i}")).collect();
        assert_eq!(build_jito_bundle_request(&six).unwrap_err(), "bundle_too_large_max_5");
    }

    #[test]
    fn tip_selection_from_percentiles() {
        let tf = json!([{
            "landed_tips_25th_percentile": 0.000005,
            "landed_tips_50th_percentile": 0.00001,
            "landed_tips_75th_percentile": 0.0000362
        }]);
        assert_eq!(select_tip_lamports(&tf, TipLevel::Low), 5000);
        assert_eq!(select_tip_lamports(&tf, TipLevel::Normal), 10000);
        assert_eq!(select_tip_lamports(&tf, TipLevel::Aggressive), 36200);
    }

    #[test]
    fn tip_falls_back_to_floor_when_missing_or_tiny() {
        assert_eq!(select_tip_lamports(&json!({}), TipLevel::Normal), TIP_FLOOR_LAMPORTS);
        let tiny = json!({ "landed_tips_50th_percentile": 0.0000001 }); // 100 lamports < floor
        assert_eq!(select_tip_lamports(&tiny, TipLevel::Normal), TIP_FLOOR_LAMPORTS);
    }
}
