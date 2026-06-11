// vault.mjs — encrypted local secret store (the ONLY place secrets live).
//
// Design (fail-closed):
// - One vault file data/vault.enc. Key derived from the owner's passphrase via scrypt (N=2^15).
// - Each secret encrypted separately with AES-256-GCM (random IV per write).
// - The vault NEVER returns a raw secret through any API/UI path. Reads return { ref, masked, present }.
// - Raw values are handed ONLY to in-process consumers (signer/provider clients) via getSecretForUse(),
//   which requires the vault to be unlocked and records an audit event upstream.
// - Locking wipes the derived key from memory. Wrong passphrase => unlock fails (GCM auth).
import {
  scryptSync, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual, createHash,
} from 'node:crypto';
import { readJson, writeJson, maskSecret, nowIso } from './util.mjs';

const VAULT_FILE = 'vault.enc.json';
const SCRYPT_N = 2 ** 15, SCRYPT_R = 8, SCRYPT_P = 1, KEY_LEN = 32;

export function createVaultService() {
  let derivedKey = null; // Buffer when unlocked, null when locked
  let unlockedAt = null;

  function loadFile() {
    const { value, corrupt } = readJson(VAULT_FILE, null);
    if (corrupt) throw new Error('vault_file_corrupt');
    return value;
  }

  function exists() {
    return loadFile() !== null;
  }

  function isUnlocked() {
    return derivedKey !== null;
  }

  function deriveKey(passphrase, saltHex) {
    return scryptSync(String(passphrase), Buffer.from(saltHex, 'hex'), KEY_LEN, {
      N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024,
    });
  }

  /** Create the vault with a new passphrase. Refuses if one already exists. */
  function create(passphrase) {
    if (typeof passphrase !== 'string' || passphrase.length < 8) {
      return { ok: false, error: 'passphrase_too_short_min_8' };
    }
    if (exists()) return { ok: false, error: 'vault_already_exists' };
    const salt = randomBytes(16).toString('hex');
    const key = deriveKey(passphrase, salt);
    // verifier: encrypt a known sentinel so future unlocks can be verified via GCM auth
    const sentinel = encryptWith(key, 'vault_sentinel_v1');
    writeJson(VAULT_FILE, { version: 1, salt, sentinel, entries: {}, created_at: nowIso() });
    derivedKey = key;
    unlockedAt = Date.now();
    return { ok: true };
  }

  function unlock(passphrase) {
    const file = loadFile();
    if (!file) return { ok: false, error: 'vault_missing' };
    let key;
    try {
      key = deriveKey(passphrase, file.salt);
      const plain = decryptWith(key, file.sentinel); // throws on wrong key (GCM auth)
      const expect = Buffer.from('vault_sentinel_v1');
      const got = Buffer.from(plain);
      if (got.length !== expect.length || !timingSafeEqual(got, expect)) {
        return { ok: false, error: 'vault_unlock_failed' };
      }
    } catch {
      return { ok: false, error: 'vault_unlock_failed' };
    }
    derivedKey = key;
    unlockedAt = Date.now();
    return { ok: true };
  }

  function lock() {
    if (derivedKey) derivedKey.fill(0);
    derivedKey = null;
    unlockedAt = null;
    return { ok: true };
  }

  function encryptWith(key, plaintext) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
    return { iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), ct: ct.toString('hex') };
  }

  function decryptWith(key, entry) {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(entry.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(entry.ct, 'hex')), decipher.final()]).toString('utf8');
  }

  /** Store a secret under a name. Returns ONLY { ref, masked } — never the value. */
  function setSecret(name, value) {
    if (!isUnlocked()) return { ok: false, error: 'vault_locked' };
    if (typeof name !== 'string' || !/^[a-z0-9_.-]{2,64}$/i.test(name)) {
      return { ok: false, error: 'invalid_secret_name' };
    }
    if (typeof value !== 'string' || value.length < 4 || value.length > 16384) {
      return { ok: false, error: 'invalid_secret_value' };
    }
    const file = loadFile();
    file.entries[name] = {
      ...encryptWith(derivedKey, value),
      masked: maskSecret(value),
      fingerprint: createHash('sha256').update(value).digest('hex').slice(0, 12),
      updated_at: nowIso(),
    };
    writeJson(VAULT_FILE, file);
    return { ok: true, ref: `vault:${name}`, masked: file.entries[name].masked };
  }

  function deleteSecret(name) {
    if (!isUnlocked()) return { ok: false, error: 'vault_locked' };
    const file = loadFile();
    if (!file?.entries?.[name]) return { ok: false, error: 'secret_not_found' };
    delete file.entries[name];
    writeJson(VAULT_FILE, file);
    return { ok: true };
  }

  /** Public listing: names + masked previews only. */
  function listRefs() {
    const file = loadFile();
    if (!file) return [];
    return Object.entries(file.entries).map(([name, e]) => ({
      ref: `vault:${name}`, name, masked: e.masked, updated_at: e.updated_at,
    }));
  }

  function hasSecret(name) {
    const file = loadFile();
    return Boolean(file?.entries?.[name]);
  }

  /**
   * IN-PROCESS ONLY consumer access. Never expose through HTTP.
   * Callers: provider clients (RPC/Jupiter), signer service.
   */
  function getSecretForUse(name) {
    if (!isUnlocked()) return { ok: false, error: 'vault_locked' };
    const file = loadFile();
    const entry = file?.entries?.[name];
    if (!entry) return { ok: false, error: 'secret_not_found' };
    try {
      return { ok: true, value: decryptWith(derivedKey, entry) };
    } catch {
      return { ok: false, error: 'secret_decrypt_failed' };
    }
  }

  function status() {
    return {
      vault_exists: exists(),
      vault_unlocked: isUnlocked(),
      unlocked_at: unlockedAt ? new Date(unlockedAt).toISOString() : null,
      secret_count: listRefs().length,
    };
  }

  return {
    exists, isUnlocked, create, unlock, lock,
    setSecret, deleteSecret, listRefs, hasSecret, getSecretForUse, status,
  };
}
