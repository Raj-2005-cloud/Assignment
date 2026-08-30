import type { EmailStatus } from '../../types';

interface BadgeProps {
  status: EmailStatus;
}

const statusConfig: Record<EmailStatus, { label: string; className: string }> = {
  SCHEDULED: {
    label: 'Scheduled',
    className: 'badge-info',
  },
  QUEUED: {
    label: 'Queued',
    className: 'badge-info',
  },
  SENDING: {
    label: 'Sending',
    className: 'badge-warning',
  },
  SENT: {
    label: 'Sent',
    className: 'badge-success',
  },
  FAILED: {
    label: 'Failed',
    className: 'badge-error',
  },
  RATE_LIMITED: {
    label: 'Rate Limited',
    className: 'badge-warning',
  },
};

export default function Badge({ status }: BadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: 'badge-neutral',
  };

  return (
    <span className={config.className}>
      <span
        className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
          status === 'SENT'
            ? 'bg-emerald-500'
            : status === 'FAILED'
              ? 'bg-red-500'
              : status === 'SENDING' || status === 'RATE_LIMITED'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-blue-500'
        }`}
      />
      {config.label}
    </span>
  );
}
