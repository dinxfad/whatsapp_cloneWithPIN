import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Chat, Profile } from '../types/database';

interface ChatState {
  chats: Chat[];
  currentChat: Profile | null;
  setCurrentChat: (profile: Profile | null) => void;
  sendMessage: (message: string, receiverId: string) => Promise<void>;
  fetchChats: (userId: string, receiverId: string) => Promise<void>;
  subscribeToChats: (userId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChat: null,
  setCurrentChat: (profile) => set({ currentChat: profile }),
  sendMessage: async (message, receiverId) => {
    const { error } = await supabase
      .from('chats')
      .insert([
        {
          message,
          receiver_id: receiverId,
        },
      ]);

    if (error) throw error;
  },
  fetchChats: async (userId, receiverId) => {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .or(`sender_id.eq.${receiverId},receiver_id.eq.${receiverId}`)
      .order('created_at', { ascending: true });

    if (error) throw error;
    set({ chats: data });
  },
  subscribeToChats: (userId) => {
    const channel = supabase
      .channel('chats')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chats',
          filter: `sender_id=eq.${userId},receiver_id=eq.${userId}`,
        },
        (payload) => {
          const { chats } = get();
          set({ chats: [...chats, payload.new as Chat] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));