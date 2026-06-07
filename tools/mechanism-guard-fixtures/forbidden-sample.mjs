// FORBIDDEN sample for the mechanism guard self-test. Inert: never imported or executed.
// Every line below is a REAL mechanism the guard MUST catch (kept here only as scanned text).
import { Connection, Keypair } from '@solana/web3.js';
import axios from 'axios';

export async function illegal() {
  const conn = new Connection('https://api.mainnet-beta.solana.com');
  const signer = Keypair.fromSecretKey(new Uint8Array());
  const tx = {};
  tx.serialize();
  await conn.sendRawTransaction(tx);
  await fetch('https://example.invalid');
  return { conn, signer };
}
