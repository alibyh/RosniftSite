import { supabase } from './supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ConversationRow {
  id: string;
  title: string;
  participant_company_ids: string[];
  created_at: string;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export const chatService = {
  /** Return all conversations the given companyId is a participant of. */
  async getConversationsForCompany(companyId: string): Promise<ConversationRow[]> {
    if (!companyId) return [];
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .contains('participant_company_ids', [companyId])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('chatService.getConversationsForCompany:', error);
      return [];
    }
    return (data ?? []) as ConversationRow[];
  },

  /**
   * Find an existing conversation by title (case-insensitive exact match),
   * or create a new one with the given participant company IDs.
   */
  async findOrCreateConversation(
    title: string,
    participantCompanyIds: string[]
  ): Promise<ConversationRow | null> {
    const normalized = title.trim();
    if (!normalized) return null;

    // Try to find existing by title
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .ilike('title', normalized)
      .limit(1);

    if (existing && existing.length > 0) {
      return existing[0] as ConversationRow;
    }

    // Create new
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        title: normalized,
        participant_company_ids: participantCompanyIds,
      })
      .select()
      .single();

    if (error) {
      console.error('chatService.findOrCreateConversation:', error);
      return null;
    }
    return data as ConversationRow;
  },

  /** Fetch all messages for a conversation, oldest first. */
  async getMessages(conversationId: string): Promise<ChatMessageRow[]> {
    if (!conversationId) return [];
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('chatService.getMessages:', error);
      return [];
    }
    return (data ?? []) as ChatMessageRow[];
  },

  /** Insert a new message into a conversation. */
  async sendMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    content: string
  ): Promise<ChatMessageRow | null> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, sender_name: senderName, content })
      .select()
      .single();

    if (error) {
      console.error('chatService.sendMessage:', error);
      return null;
    }
    return data as ChatMessageRow;
  },

  /**
   * Subscribe to new messages for a conversation via Supabase Realtime.
   * Returns the channel so the caller can unsubscribe when done.
   */
  subscribeToMessages(
    conversationId: string,
    onMessage: (msg: ChatMessageRow) => void
  ): RealtimeChannel {
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onMessage(payload.new as ChatMessageRow);
        }
      )
      .subscribe();

    return channel;
  },
};
