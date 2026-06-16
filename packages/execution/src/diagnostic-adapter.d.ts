// Type surface for the DiagnosticExecutionAdapter (ADR-0001 Phase 5A). Hand-written to match
// diagnostic-adapter.mjs. All mechanisms are injected; the adapter never trades.

export type ValidationStatus = 'valid' | 'warning' | 'invalid';
export type CheckStatus = 'pass' | 'warn' | 'fail';
export type TradeSide = 'buy' | 'sell';

/** A single diagnostic check result (superset shape; specific checks add their own fields). */
export interface DiagnosticCheck {
  name: string;
  ok: boolean;
  status: CheckStatus;
  error?: string | null;
  checked_at?: string;
  [k: string]: unknown;
}

export interface ConnectivityCheckResult extends DiagnosticCheck {
  provider: string;
  latency_ms?: number;
  detail?: Record<string, unknown>;
}

export interface SimulationCheckResult extends DiagnosticCheck {
  token_mint: string;
  side: TradeSide;
  simulated_ok: boolean;
  simulated_at?: string;
}

export interface ReadinessResult {
  name: 'readiness';
  readiness: ValidationStatus;
  ok: boolean;
  blockers: string[];
  checks: DiagnosticCheck[];
  checked_at: string;
}

/** Canonical DiagnosticRun (contracts entity). */
export interface DiagnosticRun {
  run_id: string;
  kind: 'preflight' | 'connectivity' | 'simulation' | 'readiness';
  readiness: ValidationStatus;
  checks: DiagnosticCheck[];
  created_at: string;
}

export interface RpcLike {
  rpc(method: string, params?: unknown[]): Promise<{ ok: boolean; result?: unknown; error?: string }>;
  testConnection(): Promise<Record<string, unknown> & { ok: boolean }>;
}
export interface JupiterLike {
  quote(args: { inputMint: string; outputMint: string; amountBaseUnits: number; slippageBps?: number }): Promise<{ ok: boolean; outAmount?: number; priceImpactPct?: number; error?: string }>;
  usdValueOf(args: { mint: string; qtyUi: number; decimals: number; slippageBps?: number }): Promise<{ ok: boolean; usd?: number; error?: string }>;
}
export interface JitoLike {
  getTipFloor(): Promise<Record<string, unknown> | null>;
}
export interface ProviderHealthLike {
  snapshot(): Record<string, { status?: string } & Record<string, unknown>>;
}

export interface DiagnosticAdapterDeps {
  rpc: RpcLike;
  jupiter: JupiterLike;
  jito?: JitoLike | null;
  providerHealth?: ProviderHealthLike | null;
  now?: () => string;
  genId?: (prefix?: string) => string;
}

export interface DiagnosticExecutionAdapter {
  runConnectivityCheck(args?: { provider?: string }): Promise<ConnectivityCheckResult>;
  runQuoteCheck(args?: { inputMint?: string; outputMint?: string; amountBaseUnits?: number; slippageBps?: number }): Promise<DiagnosticCheck>;
  runRouteAvailabilityCheck(args?: { inputMint?: string; outputMint?: string; amountBaseUnits?: number; slippageBps?: number }): Promise<DiagnosticCheck & { available: boolean }>;
  runSimulationCheck(args?: { txBase64?: string; token_mint?: string; side?: TradeSide }): Promise<SimulationCheckResult>;
  runPriorityFeeEstimate(args?: { percentile?: number; fixedLamports?: number; maxLamports?: number | null }): Promise<DiagnosticCheck & { tip_lamports: number; source: string }>;
  runTokenSellabilityCheck(args?: { mint?: string; qtyUi?: number; decimals?: number; slippageBps?: number }): Promise<DiagnosticCheck & { sellable: boolean; usd: number | null }>;
  runProviderHealthCheck(): Promise<DiagnosticCheck & { degraded: boolean; providers: Record<string, unknown> }>;
  runLiveReadinessDiagnostic(opts?: { quote?: object; route?: object }): Promise<ReadinessResult>;
  runDiagnosticExecutionTest(opts?: {
    priorityFee?: object;
    quote?: object;
    route?: object;
    sellability?: object;
    simulation?: object;
  }): Promise<DiagnosticRun>;
}

export function createDiagnosticExecutionAdapter(deps?: DiagnosticAdapterDeps): DiagnosticExecutionAdapter;
