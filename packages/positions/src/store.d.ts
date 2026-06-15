// @soltrade/positions — storage interface + adapters. Types.

export interface PositionStoreRead { value: any; corrupt: boolean; }
export interface PositionStore {
  read(): PositionStoreRead;
  write(value: any): void;
}

export function createMemoryPositionStore(initial?: any): PositionStore;

export function createJsonPositionStore(opts: {
  file: string;
  readJson: (name: string, fallback: any) => any;
  writeJson: (name: string, value: any) => void;
  fallback?: any;
}): PositionStore;
