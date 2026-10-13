import {
  COUNTER_STATUS,
  ESCALATION_DECISIONS,
  PASSENGER_STATUS,
  ROLES,
  VOA_STATUS,
  statusMeta,
} from "../../constants";

const iconForTone = {
  pending: "◔",
  approved: "✓",
  hold: "!",
  deported: "↗",
  rejected: "✕",
  neutral: "•",
};

export function Badge({ tone = "neutral", children, icon }) {
  return (
    <span className={`badge badge--${tone}`}>
      {(icon ?? iconForTone[tone]) && (
        <span aria-hidden="true">{icon ?? iconForTone[tone]}</span>
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const meta = statusMeta(PASSENGER_STATUS, status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function EscalationBadge({ decision }) {
  const meta = statusMeta(ESCALATION_DECISIONS, decision);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function VoaBadge({ status }) {
  const meta = statusMeta(VOA_STATUS, status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function CounterBadge({ status }) {
  const meta = statusMeta(COUNTER_STATUS, status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function RoleBadge({ role }) {
  return <span className={`badge badge--role-${role}`}>{ROLES[role] || role}</span>;
}
