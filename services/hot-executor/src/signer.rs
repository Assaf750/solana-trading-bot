//! Fee-payer-locked ed25519 signing of a serialized Solana transaction.
//! A faithful Rust port of apps/server/src/engine/tx-signer.mjs `signSerializedTransaction`:
//! replaces the fee-payer signature (slot 0) and REFUSES unless the message's fee payer equals
//! the signer's address (no signing for arbitrary accounts). Fail-closed on any parse anomaly.

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use ed25519_dalek::{Signer, SigningKey};

#[derive(Debug, PartialEq, Eq)]
pub enum SignError {
    Truncated,
    SigCountInvalid,
    NoAccountKeys,
    FeePayerMismatch,
    BadSeed,
    CompactU16Overflow,
    BadBase64,
}

impl SignError {
    pub fn code(&self) -> &'static str {
        match self {
            SignError::Truncated => "tx_truncated",
            SignError::SigCountInvalid => "tx_sig_count_invalid",
            SignError::NoAccountKeys => "tx_no_account_keys",
            SignError::FeePayerMismatch => "fee_payer_mismatch_refusing_to_sign",
            SignError::BadSeed => "key_length_invalid",
            SignError::CompactU16Overflow => "compact_u16_overflow",
            SignError::BadBase64 => "tx_base64_invalid",
        }
    }
}

/// Solana shortvec (compact-u16) decode. Returns (value, next_offset).
fn read_compact_u16(buf: &[u8], offset: usize) -> Result<(usize, usize), SignError> {
    let mut value: usize = 0;
    let mut shift: u32 = 0;
    let mut o = offset;
    loop {
        if o >= buf.len() {
            return Err(SignError::Truncated);
        }
        let b = buf[o];
        o += 1;
        value |= ((b & 0x7f) as usize) << shift;
        if b & 0x80 == 0 {
            break;
        }
        shift += 7;
        if shift > 14 {
            return Err(SignError::CompactU16Overflow);
        }
    }
    Ok((value, o))
}

#[derive(Debug)]
pub struct Signed {
    pub signed_tx_base64: String,
    pub signature_b58: String,
    pub signer_address: String,
}

/// Sign a serialized (legacy or v0) Solana transaction, replacing the fee-payer signature
/// (slot 0). `seed` is the 32-byte ed25519 seed (the raw key, supplied per-request, never logged).
pub fn sign_serialized_transaction(tx_base64: &str, seed: &[u8]) -> Result<Signed, SignError> {
    if seed.len() != 32 {
        return Err(SignError::BadSeed);
    }
    let mut tx = B64.decode(tx_base64).map_err(|_| SignError::BadBase64)?;

    let (num_sigs, sig_start) = read_compact_u16(&tx, 0)?;
    if num_sigs < 1 || num_sigs > 16 {
        return Err(SignError::SigCountInvalid);
    }
    let msg_start = sig_start + num_sigs * 64;
    if msg_start >= tx.len() {
        return Err(SignError::Truncated);
    }
    let message = tx[msg_start..].to_vec();

    // locate fee payer (first static account key) in the message
    let mut mo = 0usize;
    if message[0] & 0x80 != 0 {
        mo = 1; // versioned message prefix
    }
    mo += 3; // header: numRequired, numReadonlySigned, numReadonlyUnsigned
    let (num_keys, keys_start) = read_compact_u16(&message, mo)?;
    if num_keys < 1 {
        return Err(SignError::NoAccountKeys);
    }
    if keys_start + 32 > message.len() {
        return Err(SignError::Truncated);
    }
    let fee_payer = &message[keys_start..keys_start + 32];

    let seed_arr: [u8; 32] = seed.try_into().map_err(|_| SignError::BadSeed)?;
    let signing_key = SigningKey::from_bytes(&seed_arr);
    let pubkey = signing_key.verifying_key().to_bytes();
    if fee_payer != pubkey {
        return Err(SignError::FeePayerMismatch);
    }

    let signature = signing_key.sign(&message);
    let sig_bytes = signature.to_bytes(); // 64 bytes
    tx[sig_start..sig_start + 64].copy_from_slice(&sig_bytes);

    Ok(Signed {
        signed_tx_base64: B64.encode(&tx),
        signature_b58: bs58::encode(sig_bytes).into_string(),
        signer_address: bs58::encode(pubkey).into_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signature, Verifier, VerifyingKey};

    fn build_unsigned_tx(fee_payer: &[u8; 32], versioned: bool) -> Vec<u8> {
        let mut tx = Vec::new();
        tx.push(1u8); // compact-u16 num sigs = 1
        tx.extend_from_slice(&[0u8; 64]); // zeroed signature slot
        if versioned {
            tx.push(0x80);
        }
        tx.extend_from_slice(&[1, 0, 1]); // header
        tx.push(2u8); // compact-u16 numKeys = 2
        tx.extend_from_slice(fee_payer); // key 0 = fee payer
        tx.extend_from_slice(&[9u8; 32]); // key 1
        tx.push(0u8); // empty instructions
        tx
    }

    #[test]
    fn signs_v0_and_signature_verifies() {
        let seed = [7u8; 32];
        let pk = SigningKey::from_bytes(&seed).verifying_key().to_bytes();
        let tx_b64 = B64.encode(build_unsigned_tx(&pk, true));
        let out = sign_serialized_transaction(&tx_b64, &seed).unwrap();
        assert_eq!(out.signer_address, bs58::encode(pk).into_string());
        let signed = B64.decode(out.signed_tx_base64).unwrap();
        let sig = Signature::from_slice(&signed[1..65]).unwrap();
        let msg = &signed[65..];
        let vk = VerifyingKey::from_bytes(&pk).unwrap();
        assert!(vk.verify(msg, &sig).is_ok(), "embedded signature must verify");
    }

    #[test]
    fn refuses_fee_payer_mismatch() {
        let seed = [7u8; 32];
        let other = [9u8; 32];
        let tx_b64 = B64.encode(build_unsigned_tx(&other, true));
        assert_eq!(
            sign_serialized_transaction(&tx_b64, &seed).unwrap_err(),
            SignError::FeePayerMismatch
        );
    }

    #[test]
    fn legacy_message_signs() {
        let seed = [3u8; 32];
        let pk = SigningKey::from_bytes(&seed).verifying_key().to_bytes();
        let tx_b64 = B64.encode(build_unsigned_tx(&pk, false));
        let out = sign_serialized_transaction(&tx_b64, &seed).unwrap();
        assert_eq!(out.signer_address, bs58::encode(pk).into_string());
    }

    #[test]
    fn rejects_bad_seed_length() {
        let tx_b64 = B64.encode(build_unsigned_tx(&[1u8; 32], true));
        assert_eq!(
            sign_serialized_transaction(&tx_b64, &[0u8; 10]).unwrap_err(),
            SignError::BadSeed
        );
    }
}
