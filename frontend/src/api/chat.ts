import { apiClient, type ApiResponse } from "@/api/client";
import type { Database } from "@/integrations/supabase/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { buildId } from "@/utils/chatHelpers";

type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type ConversationParticipantRow =
  Database["public"]["Tables"]["conversation_participants"]["Row"];
type ConversationParticipantInsert =
  Database["public"]["Tables"]["conversation_participants"]["Insert"];
type UserProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ConversationMembership = { conversation_id: string };
type ConversationInsert = Database["public"]["Tables"]["conversations"]["Insert"];

export type ConversationWithParticipants = ConversationRow & {
  conversation_participants?:
    | Array<
        ConversationParticipantRow & {
          user_profiles?: Pick<UserProfileRow, "name" | "coach_id" | "image_url" | "instagram_handle"> | null;
        }
      >
    | null;
};

export type MessageWithSender = MessageRow & {
  sender?: {
    name?: string | null;
  } | null;
};

export type GetMessagesOptions = {
  limit?: number;
  before?: string | null;
};

export type GetConversationsOptions = {
  limit?: number;
  offset?: number;
};

const normalizeMessages = (messages?: MessageWithSender[] | null) => {
  if (!Array.isArray(messages)) return [];
  return [...messages].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
  );
};

const normalizeConversations = (
  conversations?: ConversationWithParticipants[] | null
) => (Array.isArray(conversations) ? conversations : []);

const createRealtimeChannelName = (prefix: string) => `${prefix}-${buildId()}`;

export const chatAPI = {
  async getUserConversationIds(
    userId: string
  ): Promise<ApiResponse<ConversationMembership[]>> {
    return apiClient.query<ConversationMembership[]>(
      async (client) =>
        client
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", userId),
      `Fetch conversation memberships for user ${userId}`
    );
  },

  async getConversationsByIds(
    conversationIds: string[],
    options?: GetConversationsOptions
  ): Promise<ApiResponse<ConversationWithParticipants[]>> {
    if (!conversationIds.length) {
      return { data: [], error: null };
    }

    const limit = Math.max(options?.limit ?? 50, 1);
    const offset = Math.max(options?.offset ?? 0, 0);
    const rangeEnd = offset + limit - 1;

    return apiClient.query<ConversationWithParticipants[]>(
      async (client) =>
        client
          .from("conversations")
          .select(
            `
              id,
              title,
              is_group,
              last_message_text,
              last_message_at,
              created_by,
              created_at,
              conversation_participants (
                user_id,
                role,
                last_read_at,
                user_profiles ( name, coach_id, image_url, instagram_handle )
              )
            `
          )
          .in("id", conversationIds)
          .order("last_message_at", { ascending: false })
          .range(offset, rangeEnd),
      "Fetch conversations by ids"
    );
  },

  async getUserConversations(
    userId: string,
    options?: GetConversationsOptions
  ): Promise<ApiResponse<ConversationWithParticipants[]>> {
    const memberships = await this.getUserConversationIds(userId);

    if (memberships.error) {
      return memberships;
    }

    const membershipData = Array.isArray(memberships.data) ? memberships.data : [];
    const ids = membershipData.map((m) => m?.conversation_id).filter(Boolean) as string[];

    const conversations = await this.getConversationsByIds(ids, options);
    if (conversations.error) {
      return conversations;
    }

    return {
      data: normalizeConversations(conversations.data),
      error: null,
    };
  },

  async getAllUserConversations(
    userId: string
  ): Promise<ApiResponse<ConversationWithParticipants[]>> {
    const memberships = await this.getUserConversationIds(userId);

    if (memberships.error) {
      return memberships;
    }

    const membershipData = Array.isArray(memberships.data) ? memberships.data : [];
    const ids = membershipData.map((m) => m?.conversation_id).filter(Boolean) as string[];

    if (!ids.length) {
      return { data: [], error: null };
    }

    const conversations = await this.getConversationsByIds(ids, {
      limit: ids.length,
      offset: 0,
    });
    if (conversations.error) {
      return conversations;
    }

    return {
      data: normalizeConversations(conversations.data),
      error: null,
    };
  },

  async getMessages(
    conversationId: string,
    options?: GetMessagesOptions
  ): Promise<ApiResponse<MessageWithSender[]>> {
    const limit = options?.limit ?? 7;
    const before = options?.before ?? null;

    return apiClient.query<MessageWithSender[]>(
      async (client) => {
        let query = client
          .from("messages")
          .select(
            `
              id,
              conversation_id,
              sender_id,
              body,
              created_at,
              edited_at,
              status,
              sender:user_profiles!messages_sender_id_fkey ( name )
            `
          )
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (before) {
          query = query.lt("created_at", before);
        }

        const { data, error } = await query;
        if (error) {
          return { data: null, error };
        }
        // Fix: Map sender from array to object or null
        const fixedData =
          Array.isArray(data)
            ? data.map((msg) => ({
                ...msg,
                sender: Array.isArray(msg.sender)
                  ? msg.sender[0] ?? null
                  : msg.sender ?? null,
              }))
            : [];
        return { data: normalizeMessages(fixedData), error: null };
      },
      `Fetch messages for conversation ${conversationId}`
    );
  },

  async sendMessage(
    conversationId: string,
    senderId: string,
    body: string
  ): Promise<ApiResponse<MessageWithSender>> {
    return apiClient.mutate<MessageWithSender>(
      async (client) =>
        client
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: senderId,
            body,
          })
          .select(
            `
              id,
              body,
              created_at,
              sender_id,
              status,
              sender:user_profiles!messages_sender_id_fkey ( name )
            `
          )
          .single(),
      `Send message in conversation ${conversationId}`
    );
  },

  async updateConversationMetadata(
    conversationId: string,
    payload: Partial<Pick<ConversationRow, "last_message_at" | "last_message_text">>
  ): Promise<ApiResponse<null>> {
    return apiClient.mutate(
      async (client) =>
        client
          .from("conversations")
          .update(payload)
          .eq("id", conversationId),
      `Update conversation ${conversationId} metadata`
    );
  },

  async getCoachUserProfile(
    coachId: string
  ): Promise<ApiResponse<Pick<UserProfileRow, "id" | "name"> | null>> {
    return apiClient.query<Pick<UserProfileRow, "id" | "name"> | null>(
      async (client) =>
        client
          .from("user_profiles")
          .select("id, name")
          .eq("coach_id", coachId)
          .maybeSingle(),
      `Fetch coach user profile for coach ${coachId}`
    );
  },

  async findDirectConversation(
    createdBy: string,
    title: string
  ): Promise<ApiResponse<ConversationRow | null>> {
    return apiClient.query<ConversationRow | null>(
      async (client) =>
        client
          .from("conversations")
          .select("id, created_by, is_group, title, last_message_at, last_message_text")
          .eq("created_by", createdBy)
          .eq("title", title)
          .eq("is_group", false)
          .maybeSingle(),
      `Find direct conversation by creator ${createdBy} and title`
    );
  },

  async findConversationBetweenUsers(
    userAId: string,
    userBId: string
  ): Promise<ApiResponse<ConversationRow | null>> {
    return apiClient.query<ConversationRow | null>(
      async (client) => {
        const { data: userAMemberships, error: userAError } = await client
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", userAId);

        if (userAError) {
          return { data: null, error: userAError };
        }

        const userAConversationIds = (userAMemberships ?? [])
          .map((row) => row?.conversation_id)
          .filter(Boolean) as string[];

        if (!userAConversationIds.length) {
          return { data: null, error: null };
        }

        const { data: sharedMemberships, error: sharedError } = await client
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", userBId)
          .in("conversation_id", userAConversationIds);

        if (sharedError) {
          return { data: null, error: sharedError };
        }

        const sharedConversationIds = (sharedMemberships ?? [])
          .map((row) => row?.conversation_id)
          .filter(Boolean) as string[];

        if (!sharedConversationIds.length) {
          return { data: null, error: null };
        }

        const { data: conversations, error: conversationError } = await client
          .from("conversations")
          .select(
            "id, created_by, is_group, title, last_message_at, last_message_text, created_at"
          )
          .in("id", sharedConversationIds)
          .eq("is_group", false)
          .order("last_message_at", { ascending: false })
          .limit(1);

        if (conversationError) {
          return { data: null, error: conversationError };
        }

        return { data: conversations?.[0] ?? null, error: null };
      },
      `Find direct conversation between ${userAId} and ${userBId}`
    );
  },

  async createConversation(
    conversation: ConversationInsert
  ): Promise<ApiResponse<ConversationRow>> {
    return apiClient.mutate<ConversationRow>(
      async (client) =>
        client
          .from("conversations")
          .insert(conversation)
          .select(
            "id, created_by, is_group, title, last_message_at, last_message_text, created_at"
          )
          .single(),
      "Create conversation"
    );
  },

  async addParticipants(
    participants: ConversationParticipantInsert[]
  ): Promise<ApiResponse<null>> {
    if (!participants.length) {
      return { data: null, error: null };
    }
    return apiClient.mutate(
      async (client) =>
        client.from("conversation_participants").insert(participants),
      "Add conversation participants"
    );
  },

  async getUserName(userId: string): Promise<ApiResponse<string | null>> {
    return apiClient.query<string | null>(
      async (client) => {
        const response = await client
          .from("user_profiles")
          .select("name")
          .eq("id", userId)
          .maybeSingle();
        if (response.error) {
          return { data: null, error: response.error };
        }
        return { data: response.data?.name ?? null, error: null };
      },
      `Fetch user name for ${userId}`
    );
  },

  async hasUnreadMessages(userId: string): Promise<ApiResponse<boolean>> {
    return apiClient.query<boolean>(
      async (client) => {
        // Get all conversations with their last_message_at and the user's last_read_at
        const response = await client
          .from("conversation_participants")
          .select(`
            conversation_id,
            last_read_at,
            conversations!inner (
              last_message_at
            )
          `)
          .eq("user_id", userId);

        if (response.error) {
          return { data: false, error: response.error };
        }

        if (!response.data || response.data.length === 0) {
          return { data: false, error: null };
        }

        // Check if any conversation has messages newer than last_read_at
        const hasUnread = response.data.some((participant: any) => {
          const lastMessageAt = participant.conversations?.last_message_at;
          const lastReadAt = participant.last_read_at;
          
          // If there's a last message but no read timestamp, it's unread
          if (lastMessageAt && !lastReadAt) {
            return true;
          }
          
          // If last message is newer than last read, it's unread
          if (lastMessageAt && lastReadAt) {
            return new Date(lastMessageAt) > new Date(lastReadAt);
          }
          
          return false;
        });

        return { data: hasUnread, error: null };
      },
      `Check for unread messages for user ${userId}`
    );
  },

  async markConversationAsRead(
    conversationId: string,
    userId: string
  ): Promise<ApiResponse<null>> {
    return apiClient.mutate(
      async (client) =>
        client
          .from("conversation_participants")
          .update({ last_read_at: new Date().toISOString() })
          .eq("conversation_id", conversationId)
          .eq("user_id", userId),
      `Mark conversation ${conversationId} as read for user ${userId}`
    );
  },

  subscribeToConversationParticipants(
    userId: string,
    onInsert: (payload: any) => void
  ): RealtimeChannel {
    const supabase = apiClient.getSupabaseClient();
    return supabase
      .channel(createRealtimeChannelName(`conversation-participants-${userId}`))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onInsert(payload.new);
        }
      )
      .subscribe((status, err) => {
        // console.log('[chatAPI] Participant subscription status:', { userId, status, err });
      });
  },

  subscribeToConversationMessages(
    conversationId: string,
    onInsert: (payload: MessageWithSender) => void
  ): RealtimeChannel {
    const supabase = apiClient.getSupabaseClient();
    const channel = supabase
      .channel(createRealtimeChannelName(`conversation-${conversationId}`))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onInsert(payload.new as MessageWithSender);
        }
      )
      .subscribe((status, err) => {
        // console.log('[chatAPI] Subscription status for conversation:', conversationId, { status, err });
      });
    
    return channel;
  },

  subscribeToConversationUpdates(
    conversationIds: string[],
    onUpdate: (updated: ConversationWithParticipants) => void
  ): RealtimeChannel | null {
    if (!conversationIds.length) return null;
    const supabase = apiClient.getSupabaseClient();
    const filter = `id=in.(${conversationIds.map((id) => `"${id}"`).join(",")})`;

    return supabase
      .channel(createRealtimeChannelName(`conversations-${conversationIds.join("-")}`))
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter,
        },
        (payload) => onUpdate(payload.new as ConversationWithParticipants)
      )
      .subscribe();
  },

  unsubscribe(channel?: RealtimeChannel | null) {
    if (!channel) return;
    const supabase = apiClient.getSupabaseClient();
    void supabase.removeChannel(channel);
  },

  // ---- Coach community channels (ATH-21) ----

  async getCoachChannel(coachId: string): Promise<CoachChannelInfo | null> {
    const supabase = apiClient.getSupabaseClient();
    const { data, error } = await (supabase as any).rpc("get_coach_channel", { p_coach_id: coachId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.conversation_id) return null;
    return {
      conversationId: row.conversation_id,
      title: row.title ?? null,
      memberCount: Number(row.member_count) || 0,
      isMember: Boolean(row.is_member),
    };
  },

  async openMyCoachChannel(): Promise<string> {
    const supabase = apiClient.getSupabaseClient();
    const { data, error } = await (supabase as any).rpc("get_or_create_my_coach_channel");
    if (error) throw error;
    return data as string;
  },

  // Creates the coach's channel on first join (ATH-53); returns its conversation id.
  async joinCoachChannel(coachId: string): Promise<string> {
    const supabase = apiClient.getSupabaseClient();
    const { data, error } = await (supabase as any).rpc("join_coach_community", { p_coach_id: coachId });
    if (error) throw error;
    return data as string;
  },

  async leaveCoachChannel(conversationId: string): Promise<void> {
    const supabase = apiClient.getSupabaseClient();
    const { error } = await (supabase as any).rpc("leave_coach_channel", { p_conversation_id: conversationId });
    if (error) throw error;
  },
};

export interface CoachChannelInfo {
  conversationId: string;
  title: string | null;
  memberCount: number;
  isMember: boolean;
}
