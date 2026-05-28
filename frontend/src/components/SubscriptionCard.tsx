import React from "react";

interface SubscriptionCardProps {
  subscription: {
    merchant: string;
    amount: string;
    interval: number;
    last_charged: number;
    active: boolean;
    trial_duration: number;
  };
  onCancel: () => void;
}

function formatInterval(secs: number): string {
  if (secs >= 2_592_000) return `${Math.round(secs / 2_592_000)}mo`;
  if (secs >= 604_800) return `${Math.round(secs / 604_800)}w`;
  if (secs >= 86_400) return `${Math.round(secs / 86_400)}d`;
  return `${secs}s`;
}

function formatTrialStatus(
  trial_duration: number,
  last_charged: number
): { isInTrial: boolean; trialEndDate: string; trialDaysRemaining: number } {
  if (trial_duration === 0) {
    return { isInTrial: false, trialEndDate: "", trialDaysRemaining: 0 };
  }

  const trialEndTimestamp = last_charged + trial_duration;
  const now = Math.floor(Date.now() / 1000);
  const isInTrial = now < trialEndTimestamp;
  const trialEndDate = new Date(trialEndTimestamp * 1000).toLocaleDateString();
  const trialDaysRemaining = Math.max(
    0,
    Math.ceil((trialEndTimestamp - now) / (24 * 60 * 60))
  );

  return { isInTrial, trialEndDate, trialDaysRemaining };
}

export default function SubscriptionCard({
  subscription,
  onCancel,
}: SubscriptionCardProps) {
  const { merchant, amount, interval, last_charged, active, trial_duration } = subscription;
  const nextCharge = new Date(
    (last_charged + interval) * 1000
  ).toLocaleDateString();
  const xlm = (Number(amount) / 10_000_000).toFixed(7);
  
  const { isInTrial, trialEndDate, trialDaysRemaining } = formatTrialStatus(
    trial_duration,
    last_charged
  );

  return (
    <div className="card">
      <div className="subscription-card__header">
        <h2 className="subscription-card__title">Your Subscription</h2>
        <span className={`badge ${active ? "badge-active" : "badge-inactive"}`}>
          {active ? (isInTrial ? "Trial Active" : "Active") : "Cancelled"}
        </span>
      </div>

      <div className="subscription-rows">
        <Row
          label="Merchant"
          value={`${merchant.slice(0, 8)}…${merchant.slice(-6)}`}
        />
        <Row label="Amount" value={`${xlm} XLM`} />
        <Row label="Interval" value={formatInterval(interval)} />
        {isInTrial && (
          <Row
            label="Trial ends"
            value={`${trialEndDate} (${trialDaysRemaining}d remaining)`}
          />
        )}
        <Row label="Next charge" value={active && !isInTrial ? nextCharge : (isInTrial ? "After trial" : "—")} />
      </div>

      {active && (
        <button onClick={onCancel} className="btn-danger cancel-btn">
          Cancel Subscription
        </button>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="subscription-row">
      <span className="subscription-row__label">{label}</span>
      <span className="subscription-row__value">{value}</span>
    </div>
  );
}
