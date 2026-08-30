import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type { Sender } from '../types';

export function useSenders() {
  return useQuery<{ senders: Sender[] }>({
    queryKey: ['senders'],
    queryFn: async () => {
      const { data } = await api.get('/senders');
      return data;
    },
  });
}

export function useCreateSender() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (senderData: { email: string; displayName: string }) => {
      const { data } = await api.post('/senders', senderData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    },
  });
}

export function useDeleteSender() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (senderId: string) => {
      const { data } = await api.delete(`/senders/${senderId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    },
  });
}
