// @soltrade/operator-dashboard-foundations — Stage-18 (Phase C) operator
// dashboard foundations. Pure, read-only, advisory-only HTML render functions
// over the existing backend read-models + a static shell assembler.
// Import-free runtime; no DOM, no network, no clock, no RNG, no env, no fs.

export type DashRenderState =
  | 'DASH_RENDER_OK'
  | 'DASH_RENDER_UNAVAILABLE'
  | 'DASH_RENDER_INVALID'
  | 'DASH_RENDER_REFUSED';

/** Frozen render result. All 24 readiness/execution flags are always false. */
export interface DashRenderResult {
  readonly html: string;
  readonly render_state: DashRenderState;
  readonly panel_kind: string;
  readonly status: DashRenderState;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
  readonly read_only: true;
  readonly [flag: string]: unknown;
}

export type DashContract = Readonly<Record<string, unknown>>;

export declare function describeDecisionTracePanelContract(): DashContract;
export declare function renderDecisionTracePanel(input: unknown): DashRenderResult;

export declare function describePipelineHealthPanelContract(): DashContract;
export declare function renderPipelineHealthPanel(input: unknown): DashRenderResult;

export declare function describePaperPnlPanelContract(): DashContract;
export declare function renderPaperPnlPanel(input: unknown): DashRenderResult;

export declare function describeProfitabilityAdvisoryPanelContract(): DashContract;
export declare function renderProfitabilityAdvisoryPanel(input: unknown): DashRenderResult;

export declare function describeStreamHealthPanelContract(): DashContract;
export declare function renderStreamHealthPanel(input: unknown): DashRenderResult;

export declare function describeSecurityNoticesPanelContract(): DashContract;
export declare function renderSecurityNoticesPanel(input: unknown): DashRenderResult;

export declare function describeOperatorDashboardContract(): DashContract;
export declare function assembleOperatorDashboard(input: unknown): DashRenderResult;
