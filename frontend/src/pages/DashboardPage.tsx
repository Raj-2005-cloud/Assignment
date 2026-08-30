import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Calendar, Send, Mail, TrendingUp } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import ScheduledEmailsTable from '../components/email/ScheduledEmailsTable';
import SentEmailsTable from '../components/email/SentEmailsTable';
import ComposeModal from '../components/email/ComposeModal';
import Button from '../components/ui/Button';
import { useScheduledEmails, useSentEmails, useSearchEmails } from '../hooks/useEmails';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();

  // Check for Slack callback
  useEffect(() => {
    const slackStatus = searchParams.get('slack');
    if (slackStatus === 'connected') {
      toast.success('Slack connected successfully!');
    } else if (slackStatus === 'error') {
      toast.error('Failed to connect Slack');
    }
  }, [searchParams]);

  // Stats data
  const { data: scheduledData } = useScheduledEmails(1, 1);
  const { data: sentData } = useSentEmails(1, 1);
  const { data: searchResults } = useSearchEmails(searchQuery);

  const scheduledCount = scheduledData?.pagination?.total || 0;
  const sentCount = sentData?.pagination?.total || 0;

  const renderContent = () => {
    // If there's a search query, show search results
    if (searchQuery) {
      return (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-dark-800">Search Results</h2>
              <p className="text-sm text-dark-500">
                {searchResults?.total || 0} result{(searchResults?.total || 0) !== 1 ? 's' : ''} for "{searchQuery}"
              </p>
            </div>
            <Button variant="ghost" onClick={() => setSearchQuery('')}>
              Clear Search
            </Button>
          </div>

          {searchResults && searchResults.results.length > 0 ? (
            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-100 bg-dark-50/50">
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-500">Recipient</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-500">Subject</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-100">
                    {searchResults.results.map((email: any) => (
                      <tr key={email.id} className="transition-colors hover:bg-dark-50/50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-dark-800">{email.recipientEmail}</td>
                        <td className="px-6 py-4 text-sm text-dark-700">{email.subject}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <span className={`badge ${email.status === 'SENT' ? 'badge-success' : email.status === 'FAILED' ? 'badge-error' : 'badge-info'}`}>
                            {email.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center">
              <p className="text-sm text-dark-500">No results found</p>
            </div>
          )}
        </div>
      );
    }

    switch (activeTab) {
      case 'scheduled':
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-dark-800">Scheduled Emails</h2>
                <p className="text-sm text-dark-500">{scheduledCount} pending email{scheduledCount !== 1 ? 's' : ''}</p>
              </div>
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setIsComposeOpen(true)}
              >
                Compose Email
              </Button>
            </div>
            <ScheduledEmailsTable />
          </div>
        );

      case 'sent':
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-dark-800">Sent Emails</h2>
                <p className="text-sm text-dark-500">{sentCount} delivered email{sentCount !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <SentEmailsTable />
          </div>
        );

      default:
        return (
          <div className="space-y-6 animate-fade-in">
            {/* Welcome & CTA */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-dark-900">Dashboard</h2>
                <p className="text-sm text-dark-500">Manage your email campaigns</p>
              </div>
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setIsComposeOpen(true)}
                className="shadow-lg shadow-brand-500/25"
              >
                Compose Email
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <button
                onClick={() => setActiveTab('scheduled')}
                className="card-hover group flex items-center gap-4 p-5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
                  <Calendar className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-dark-900">{scheduledCount}</p>
                  <p className="text-sm text-dark-500">Scheduled</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('sent')}
                className="card-hover group flex items-center gap-4 p-5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100">
                  <Send className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-dark-900">{sentCount}</p>
                  <p className="text-sm text-dark-500">Sent</p>
                </div>
              </button>

              <div className="card flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dark-900">
                    {scheduledCount + sentCount}
                  </p>
                  <p className="text-sm text-dark-500">Total Campaigns</p>
                </div>
              </div>
            </div>

            {/* Quick view of both tables */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-dark-700">Recent Scheduled</h3>
                  <button
                    onClick={() => setActiveTab('scheduled')}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    View all →
                  </button>
                </div>
                <ScheduledEmailsTable />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-dark-700">Recent Sent</h3>
                  <button
                    onClick={() => setActiveTab('sent')}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    View all →
                  </button>
                </div>
                <SentEmailsTable />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-dark-50">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <div className="ml-64 flex flex-1 flex-col">
        <Header onSearch={setSearchQuery} />

        <main className="flex-1 p-6">{renderContent()}</main>
      </div>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
      />
    </div>
  );
}
