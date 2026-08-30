import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type { PaginatedResponse, EmailJob, SearchResult } from '../types';

export function useScheduledEmails(page: number = 1, limit: number = 20) {
  return useQuery<PaginatedResponse<EmailJob>>({
    queryKey: ['scheduled-emails', page, limit],
    queryFn: async () => {
      const { data } = await api.get(`/emails/scheduled?page=${page}&limit=${limit}`);
      return data;
    },
    refetchInterval: 10000, // Auto-refresh every 10s
  });
}

export function useSentEmails(page: number = 1, limit: number = 20) {
  return useQuery<PaginatedResponse<EmailJob>>({
    queryKey: ['sent-emails', page, limit],
    queryFn: async () => {
      const { data } = await api.get(`/emails/sent?page=${page}&limit=${limit}`);
      return data;
    },
    refetchInterval: 10000,
  });
}

export function useScheduleEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post('/emails/schedule', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
    },
  });
}

export function useCancelEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emailId: string) => {
      const { data } = await api.delete(`/emails/${emailId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
    },
  });
}

export function useSearchEmails(query: string, page: number = 1) {
  return useQuery<SearchResult>({
    queryKey: ['search-emails', query, page],
    queryFn: async () => {
      const { data } = await api.get(`/emails/search?q=${encodeURIComponent(query)}&page=${page}`);
      return data;
    },
    enabled: query.length > 0,
  });
}
