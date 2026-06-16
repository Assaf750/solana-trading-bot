// @soltrade/decision-ledger — storage interface + adapters. Types.

export interface IntentStoreRead { value: any; corrupt: boolean; }
export interface IntentStore {
  read(): IntentStoreRead;
  write(value: any): void;
}

export function createMemoryIntentStore(initial?: any): IntentStore;

export function createJsonIntentStore(opts: {
  file: string;
  readJson: (name: string, fallback: any) => any;
  writeJson: (name: string, value: any) => void;
  fallback?: any;
}): IntentStore;
