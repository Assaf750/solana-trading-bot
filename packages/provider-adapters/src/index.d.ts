// @soltrade/provider-adapters — types (ADR-0001 Phase 2D).

export interface Result { ok: boolean; error?: string; [k: string]: any; }
export interface HealthRecorder { record(provider: string, ok: boolean, ms: number | null, error?: string | null): void; }

// --- normalizers ---
export function normalizeProviderError(provider: string | null, error: any): { ok: false; provider: string | null; error: string };
export function normalizeQuoteResult(r: any): Result;
export function normalizeRouteResult(r: any): { ok: boolean; available: boolean; error: string | null };
export function normalizeBroadcastResult(r: any): { ok: boolean; signature?: string | null; via?: string; error?: string };
export function normalizeSimulationResult(r: any): { ok: boolean; simulated_ok: boolean; error: string | null; logs: any[] };

// --- Jupiter ---
export interface JupiterProvider {
  quote(args: { inputMint: string; outputMint: string; amountBaseUnits: number; slippageBps?: number }): Promise<Result>;
  usdValueOf(args: { mint: string; qtyUi: number; decimals: number; slippageBps?: number }): Promise<Result>;
  paperBuy(args: { mint: string; sizeUsd: number; slippageBps?: number }): Promise<Result>;
  swapTransaction(args: { quoteRaw: any; userPublicKey: string }): Promise<Result>;
}
export type HttpRequest = (url: string, opts?: any) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;
export function createJupiterProvider(opts: { getApiKey?: () => string | null; health?: HealthRecorder; usdcMint?: string; request: HttpRequest }): JupiterProvider;

// --- RPC ---
export function isHeliusHost(url: string): boolean;
export function buildWalletSubscriptions(args: { addresses: string[]; enhanced?: boolean }): any[];
export function parseStreamNotification(msg: any): { signature: string; tx: any } | null;
export interface RpcProvider {
  rpc(method: string, params?: any, opts?: { body?: any }): Promise<Result>;
  getHealth(): Promise<Result>;
  getSlot(): Promise<Result>;
  getTransaction(signature: string): Promise<Result>;
  testConnection(): Promise<Result>;
  subscribeWallets(args: { addresses: string[]; onLeaderActivity: Function; onUp?: Function; onGap?: Function; gapMs?: number }): { close(): void };
}
export function createRpcProvider(opts: {
  getRpcUrl: () => string | null;
  getGrpcEndpoint?: () => { endpoint: string; token?: string } | null;
  grpcIngestorFactory?: (args: any) => { close(): void };
  health?: HealthRecorder;
  request: HttpRequest;
  wsFactory?: (url: string) => any;
}): RpcProvider;

// --- Jito ---
export function makeTipTransferBuilder(b58decode: (s: string) => Uint8Array | Buffer): (args: { owner: string; tipAccount: string; lamports: number; recentBlockhash: string }) => string;
export function selectTipLamports(args: { floor?: any; percentile?: number; fixedLamports?: number; maxLamports?: number | null }): number;
export interface JitoProvider {
  sendBundle(txsBase64: string[], opts?: { body?: any }): Promise<Result>;
  getTipFloor(): Promise<any | null>;
  buildTipTransferTx?: (args: { owner: string; tipAccount: string; lamports: number; recentBlockhash: string }) => string;
  selectTipLamports: typeof selectTipLamports;
}
export function createJitoProvider(opts: { getBundleUrl?: () => { ok: boolean; url?: string; error?: string }; b58decode?: (s: string) => Uint8Array | Buffer; request: HttpRequest; tipFloorUrl?: string }): JitoProvider;

// --- Helius ---
export function createHeliusProvider(opts: { rpc: { rpc: Function } }): { getAssetMeta(mint: string): Promise<{ symbol: string | null; name: string | null; icon: string | null } | null> };

// --- provider health ---
export function createProviderHealthMonitor(opts?: { window?: number; now?: () => number }): { record: HealthRecorder['record']; snapshot(): Record<string, any> };
