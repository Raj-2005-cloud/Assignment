import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-100">
        {icon || <Inbox className="h-8 w-8 text-dark-400" />}
      </div>
      <h3 className="mb-1 text-base font-semibold text-dark-800">{title}</h3>
      <p className="mb-6 max-w-sm text-center text-sm text-dark-500">
        {description}
      </p>
      {action}
    </div>
  );
}
