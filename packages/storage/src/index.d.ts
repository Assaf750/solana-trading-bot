// @soltrade/storage — types (ADR-0001 Phase 4A).

export type Record = { [k: string]: any; payload?: { [k: string]: any } };

// --- mappers ---
export const FIELD_MAPS: Readonly<Record>;
export const ID_FIELD: Readonly<{ [entity: string]: string | null }>;
export interface EntityMapper {
  entity: string;
  ownership: { pkg: string; sot: string; stores: readonly string[] };
  idField: string | null;
  toRecord(obj: any): Record;
  fromRecord(rec: any): any;
}
export function recordMapperFor(entityName: string): EntityMapper;

export function mapExecutionIntentToRecord(o: any): Record;
export function mapRecordToExecutionIntent(r: any): any;
export function mapPositionToRecord(o: any): Record;
export function mapRecordToPosition(r: any): any;
export function mapAuditEventToRecord(o: any): Record;
export function mapRecordToAuditEvent(r: any): any;
export function mapDiagnosticRunToRecord(o: any): Record;
export function mapRecordToDiagnosticRun(r: any): any;
export function mapProviderEventToRecord(event: any): Record;
export function mapRecordToProviderEvent(rec: any): any;

// --- KV store interface + adapters ---
export interface KvStore {
  get(id: string): Record | null;
  put(id: string, rec: Record): void;
  list(): Record[];
  has(id: string): boolean;
}
export function createMemoryStore(): KvStore & { size(): number };
export function createInjectedJsonStore(opts: {
  readJson: (file: string, fallback: any) => any;
  writeJson: (file: string, value: any) => void;
  file: string;
  collection?: string;
}): KvStore;
export function createInjectedSqlStore(opts: {
  query: (op: any) => any;
  execute: (op: any) => any;
  table: string;
}): KvStore;
export function createInjectedEventWriter(opts: { writeEvent: (rec: Record) => any }): { writeEvent(rec: Record): any };

// --- repositories ---
export interface Ownership { pkg: string; sot: string; stores: readonly string[]; }
export interface KeyedRepository<T = any> {
  entity: string;
  ownership: Ownership;
  get(id: string): T | null;
  put(obj: T): T;
  list(): T[];
}
export function createDecisionLedgerRepository(opts: { store: KvStore }): KeyedRepository;
export function createPositionRepository(opts: { store: KvStore }): KeyedRepository;
export function createDiagnosticRepository(opts: { store: KvStore }): KeyedRepository;
export function createAuditRepository(opts: { store: KvStore; now?: () => string }): {
  entity: string; ownership: Ownership; append(obj: any): any; list(): any[];
};
export function createProviderEventRepository(opts: { writer: { writeEvent: (rec: Record) => any } }): {
  entity: string; write(event: any): any;
};
export function createInjectedSqlRepository(opts: { entity: string; query: (op: any) => any; execute: (op: any) => any; table: string }): KeyedRepository;
