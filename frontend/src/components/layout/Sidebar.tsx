import { Mail, Calendar, Send, LayoutDashboard, Slack, ExternalLink } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import type { SlackStatus } from '../../types';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const queryClient = useQueryClient();

  const { data: slackStatus } = useQuery<SlackStatus>({
    queryKey: ['slack-status'],
    queryFn: async () => {
      const { data } = await api.get('/slack/status');
      return data;
    },
  });

  const connectSlack = async () => {
    const { data } = await api.get('/slack/connect');
    window.open(data.url, '_blank', 'width=600,height=700');
  };

  const disconnectSlack = useMutation({
    mutationFn: async () => {
      await api.post('/slack/disconnect');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-status'] });
    },
  });

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'scheduled',
      label: 'Scheduled',
      icon: Calendar,
    },
    {
      id: 'sent',
      label: 'Sent',
      icon: Send,
    },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-dark-900 text-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-dark-700/50 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/25">
          <Mail className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight">ReachInbox</h1>
          <p className="text-[10px] font-medium uppercase tracking-wider text-dark-400">
            Email Scheduler
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-brand-600/20 text-brand-400 shadow-sm'
                  : 'text-dark-300 hover:bg-dark-800 hover:text-white'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-brand-400' : ''}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* BullMQ Dashboard Link */}
      <div className="px-3 pb-2">
        <a
          href="/admin/queues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-dark-300 transition-all duration-200 hover:bg-dark-800 hover:text-white"
        >
          <ExternalLink className="h-4 w-4" />
          Queue Dashboard
          <span className="ml-auto text-[10px] uppercase text-dark-500">BullMQ</span>
        </a>
      </div>

      {/* Slack Connection */}
      <div className="border-t border-dark-700/50 p-4">
        {slackStatus?.connected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4A154B]">
                <Slack className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-emerald-400">Connected</p>
                <p className="truncate text-[11px] text-dark-400">
                  {slackStatus.teamName || 'Slack Workspace'}
                </p>
              </div>
            </div>
            <button
              onClick={() => disconnectSlack.mutate()}
              className="w-full rounded-lg border border-dark-600 px-3 py-1.5 text-xs font-medium text-dark-300 transition-colors hover:border-red-500/50 hover:text-red-400"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connectSlack}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4A154B] px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-[#5B2C5C] hover:shadow-lg"
          >
            <Slack className="h-4 w-4" />
            Connect Slack
          </button>
        )}
      </div>
    </aside>
  );
}
