import { Timeline, Badge } from './index.jsx';
import { useI18n } from '../i18n/index.jsx';

// Renders a pipeline decision trace (trace_entries) as a timeline.
// Composing a trace NEVER opens execution; we surface only stage_state /
// decisive_reason / advanced / blocked + overall_outcome.
export default function TraceTimeline({ trace }) {
  const { t } = useI18n();
  if (!trace || !trace.trace_entries) return null;
  const entries = trace.trace_entries.map((e) => ({
    tone: e.blocked ? 'danger' : e.advanced ? 'ok' : 'neutral',
    title: (
      <>
        <span className="mono">{e.stage}</span>
        <Badge tone={e.blocked ? 'danger' : 'ok'}>{e.stage_state}</Badge>
      </>
    ),
    meta: `decisive_reason: ${e.decisive_reason} · advanced: ${e.advanced} · blocked: ${e.blocked}`
  }));
  return (
    <div>
      <div className="row" style={{ marginBlockEnd: 'var(--s-3)' }}>
        <span className="muted">{t('command.overallOutcome')}:</span>
        <Badge tone={trace.overall_outcome === 'reviewed_advisory_all_stages' ? 'ok' : trace.overall_outcome === 'blocked_at_stage' ? 'danger' : 'warn'}>
          {trace.overall_outcome}
        </Badge>
        <Badge tone="sim">simulated</Badge>
      </div>
      <Timeline entries={entries} />
    </div>
  );
}
