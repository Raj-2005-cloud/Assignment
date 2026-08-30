import { format } from 'date-fns';
import { Calendar, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { useScheduledEmails, useCancelEmail } from '../../hooks/useEmails';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ScheduledEmailsTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useScheduledEmails(page);
  const cancelEmail = useCancelEmail();

  const handleCancel = async (emailId: string) => {
    if (!confirm('Are you sure you want to cancel this email?')) return;
    try {
      await cancelEmail.mutateAsync(emailId);
      toast.success('Email cancelled');
    } catch {
      toast.error('Failed to cancel email');
    }
  };

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="border-b border-dark-100 px-6 py-4">
          <div className="skeleton h-5 w-48" />
        </div>
        <div className="divide-y divide-dark-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="skeleton h-4 w-48" />
              <div className="skeleton h-4 w-64 flex-1" />
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-red-500">Failed to load scheduled emails</p>
      </div>
    );
  }

  const emails = data?.emails || [];
  const pagination = data?.pagination;

  if (emails.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<Calendar className="h-8 w-8 text-dark-400" />}
          title="No scheduled emails"
          description="Schedule your first email campaign to see it here. Use the Compose button to get started."
        />
      </div>
    );
  }

  return (
    <div className="card animate-fade-in">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-100 bg-dark-50/50">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-500">
                Recipient
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-500">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-500">
                Scheduled Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-500">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-dark-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-100">
            {emails.map((email) => (
              <tr
                key={email.id}
                className="transition-colors hover:bg-dark-50/50"
              >
                <td className="whitespace-nowrap px-6 py-4">
                  <p className="text-sm font-medium text-dark-800">
                    {email.recipientEmail}
                  </p>
                  {email.sender && (
                    <p className="text-xs text-dark-400">
                      From: {email.sender.displayName}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4">
                  <p className="max-w-xs truncate text-sm text-dark-700">
                    {email.subject}
                  </p>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <p className="text-sm text-dark-600">
                    {format(new Date(email.scheduledAt), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-dark-400">
                    {format(new Date(email.scheduledAt), 'h:mm a')}
                  </p>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <Badge status={email.status} />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <button
                    onClick={() => handleCancel(email.id)}
                    disabled={cancelEmail.isPending}
                    className="rounded-lg p-2 text-dark-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Cancel email"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-dark-100 px-6 py-3">
          <p className="text-sm text-dark-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} results
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg p-2 text-dark-400 transition-colors hover:bg-dark-100 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
              disabled={page === pagination.totalPages}
              className="rounded-lg p-2 text-dark-400 transition-colors hover:bg-dark-100 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
