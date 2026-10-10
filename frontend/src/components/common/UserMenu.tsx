import { ROUTES } from "@/routes";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import strings from "@/config/strings";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, CircleHelp, LogOut, Settings, Store, User } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { useMyOrganization } from "@/hooks/useOrganizations";
import { AvatarFallback } from "@radix-ui/react-avatar";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chatAPI } from "@/api";
import { useIsMobile } from "@/hooks/use-mobile";

type UserMenuProps = {
  name?: string | null;
  email?: string | null;
  img?: string | null;
  fallbackImg?: string | null;
  useFallbackDelay?: boolean;
  avatarReady?: boolean;
  /**
   * "sidebar" renders the whole account row (avatar, name, line under it) as the menu button.
   * "header" is the 28px circle used in the marketing header.
   */
  variant?: "default" | "sidebar" | "header";
  /** Name and line shown in the sidebar row. */
  label?: { name: string; sub?: string };
};

export const UserMenu: React.FC<UserMenuProps> = ({
  name = null,
  email = null,
  img = null,
  fallbackImg = null,
  useFallbackDelay = false,
  avatarReady: avatarReadyProp,
  variant = "default",
  label,
}) => {
  const {
    signOut,
    userImg,
    userName,
    userProfile,
    user,
    hasNewMessage,
    setHasNewMessage,
    profileReady,
  } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { isCoach } = useRole();
  const { data: myOrg } = useMyOrganization();
  const location = useLocation();
  const { toast, dismiss } = useToast();
  const queryClient = useQueryClient();
  const senderNameCache = useRef<Record<string, string>>({});
  const subscriptionsRef = useRef<Array<{ unsubscribe: () => void }>>([]);
  const subscribedConversationIds = useRef<Set<string>>(new Set());
  const isMobile = useIsMobile();
  const loadedAvatarCacheRef = useRef<Set<string>>(new Set());

  const resolveSenderName = async (senderId: string) => {
    if (!senderId) return "Someone";
    const cached = senderNameCache.current[senderId];
    if (cached) return cached;

    const { data, error } = await chatAPI.getUserName(senderId);
    if (error) {
      console.error("Failed to fetch sender name", error);
      return "Someone";
    }

    const resolved = data || "Someone";
    senderNameCache.current[senderId] = resolved;
    return resolved;
  };

  const subscribeToConversation = useCallback((conversationId: string, currentUserId: string) => {
    if (!conversationId || subscribedConversationIds.current.has(conversationId)) {
      return;
    }

    const channel = chatAPI.subscribeToConversationMessages(
      conversationId,
      async (newMessage) => {
        if (newMessage.sender_id !== currentUserId) {
          // Don't show toast notification if user is already on the chat page
          const isOnChatPage = window.location.pathname === ROUTES.CHAT;
          if (isOnChatPage) {
            // Check actual unread state since ChatPage will mark messages as read when viewing
            const { data: hasUnread } = await chatAPI.hasUnreadMessages(currentUserId);
            setHasNewMessage(hasUnread || false);
            return;
          }
          
          // User is not on chat page, so show notification
          setHasNewMessage(true);
          const senderName = newMessage.sender?.name || await resolveSenderName(newMessage.sender_id);

          let dismissToast: (() => void) | null = null;

          const { dismiss } = toast({
            duration: 6000,
            title: `New message from ${senderName}`,
            description: (
              <div className="mt-2 space-y-3 text-[14px] leading-[18px] tracking-[-0.03em] text-[#484D56]">
                <p className="line-clamp-3">
                  {newMessage.body || 'You have a new message waiting.'}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      // Check actual unread state instead of blindly clearing
                      if (user?.id) {
                        const { data: hasUnread } = await chatAPI.hasUnreadMessages(user.id);
                        setHasNewMessage(hasUnread || false);
                      }
                      navigate(ROUTES.CHAT);
                      dismissToast?.();
                    }}
                  >
                    Open chat
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      // Check actual unread state instead of blindly clearing
                      if (user?.id) {
                        const { data: hasUnread } = await chatAPI.hasUnreadMessages(user.id);
                        setHasNewMessage(hasUnread || false);
                      }
                      dismissToast?.();
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ),
          });

          dismissToast = dismiss;
        }
      }
    );

    subscribedConversationIds.current.add(conversationId);
    subscriptionsRef.current.push({
      unsubscribe: () => {
        subscribedConversationIds.current.delete(conversationId);
        channel.unsubscribe();
      },
    });
  }, [toast, setHasNewMessage, navigate, user]);

  // Subscribe to new messages in real-time using React Query for caching
  const { data: conversations } = useQuery({
    queryKey: ['user-conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await chatAPI.getUserConversations(user.id);
      if (error || !data) return [];
      return data;
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000, // 5 minutes - don't refetch on tab switch
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Check for unread messages on login/mount
  useEffect(() => {
    if (!user?.id) return;

    const checkUnreadMessages = async () => {
      const { data: hasUnread, error } = await chatAPI.hasUnreadMessages(user.id);
      if (!error && hasUnread) {
        setHasNewMessage(true);
      }
    };

    void checkUnreadMessages();
  }, [user?.id, setHasNewMessage]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const currentSubscriptions = subscriptionsRef.current;
    const currentSubscribedIds = subscribedConversationIds.current;

    // Subscribe to existing conversations
    if (conversations && conversations.length > 0) {
      const conversationIds = conversations
        .map((c) => c.id)
        .filter((id): id is string => Boolean(id));

      conversationIds.forEach((convId) => subscribeToConversation(convId, user.id));
    }

    // ALWAYS subscribe to new conversations being created (even if user has no conversations yet)
    const participantChannel = chatAPI.subscribeToConversationParticipants(user.id, async (payload) => {
      
      // Immediately subscribe to the new conversation to catch any messages sent right away
      const newConversationId = (payload as any)?.conversation_id;
      if (newConversationId && !subscribedConversationIds.current.has(newConversationId)) {
        subscribeToConversation(newConversationId, user.id);
      }
      
      // Invalidate React Query cache to refetch conversations
      await queryClient.invalidateQueries({ queryKey: ['user-conversations', user.id] });
    });

    subscriptionsRef.current.push({
      unsubscribe: () => participantChannel.unsubscribe(),
    });

    return () => {
      currentSubscriptions.forEach((sub) => sub.unsubscribe());
      currentSubscriptions.length = 0;
      currentSubscribedIds.clear();
    };
  }, [user, conversations, subscribeToConversation, queryClient]);

  const profileName =
    profile?.type === "coach"
      ? (profile.data as any)?.name
      : profile?.type === "athlete"
        ? (profile.data as any)?.full_name || (profile.data as any)?.fullName
        : null;
  const displayName = profileName || userProfile?.name || userName || name || "";

  const displayEmail = email ?? userProfile?.email ?? user?.email ?? "";
  // Only use image if it's a valid string (not null, undefined, or empty)
  const platformSrc = img && img.trim() !== '' ? img : (userImg && userImg.trim() !== '' ? userImg : null);
  const fallbackSrc = fallbackImg && fallbackImg.trim() !== '' ? fallbackImg : null;
  const initials = getInitials(displayName, displayEmail);
  const avatarReady = avatarReadyProp ?? profileReady;
  const [allowFallback, setAllowFallback] = useState(!useFallbackDelay);
  const effectiveSrc = platformSrc || (allowFallback ? fallbackSrc : null);
  const expectedAvatar = Boolean(platformSrc || fallbackSrc || userProfile?.image_url || user?.user_metadata?.avatar_url);
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState<string | null>(effectiveSrc);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [noAvatarConfirmed, setNoAvatarConfirmed] = useState(false);
  const [holdAvatarFallback, setHoldAvatarFallback] = useState(false);
  const shouldShowSkeleton =
    !avatarReady ||
    isAvatarLoading ||
    (expectedAvatar && !displayAvatarUrl) ||
    (!expectedAvatar && !noAvatarConfirmed) ||
    holdAvatarFallback;

  useEffect(() => {
    if (!useFallbackDelay) {
      setAllowFallback(true);
      return;
    }
    if (!avatarReady) {
      setAllowFallback(false);
      return;
    }
    if (platformSrc) {
      setAllowFallback(false);
      return;
    }
    if (!fallbackSrc) {
      setAllowFallback(false);
      return;
    }
    const id = window.setTimeout(() => {
      setAllowFallback(true);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [avatarReady, fallbackSrc, platformSrc, useFallbackDelay]);

  useEffect(() => {
    if (!avatarReady || expectedAvatar) {
      setNoAvatarConfirmed(false);
      return;
    }
    const id = window.setTimeout(() => {
      setNoAvatarConfirmed(true);
    }, 400);
    return () => window.clearTimeout(id);
  }, [avatarReady, expectedAvatar]);

  useEffect(() => {
    if (!avatarReady) {
      setHoldAvatarFallback(true);
      return;
    }
    if (displayAvatarUrl) {
      setHoldAvatarFallback(false);
      return;
    }
    // Hold skeleton briefly to avoid initials flash before avatar resolves.
    setHoldAvatarFallback(true);
    const id = window.setTimeout(() => {
      setHoldAvatarFallback(false);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [avatarReady, displayAvatarUrl]);

  // Preload candidate avatar URL and only swap when it finishes loading.
  // Keep current avatar visible to avoid flicker during transitions.
  useEffect(() => {
    if (!avatarReady) {
      setDisplayAvatarUrl(null);
      setIsAvatarLoading(true);
      return;
    }
    const nextSrc = effectiveSrc;
    if (!nextSrc) {
      setIsAvatarLoading(false);
      return;
    }
    if (nextSrc === displayAvatarUrl) {
      setIsAvatarLoading(false);
      return;
    }
    setIsAvatarLoading(true);
    const img = new Image();
    img.onload = () => {
      setDisplayAvatarUrl(nextSrc);
      setIsAvatarLoading(false);
    };
    img.onerror = () => {
      setIsAvatarLoading(false);
    };
    img.src = nextSrc;
  }, [avatarReady, displayAvatarUrl, effectiveSrc]);

  const avatarNode = useMemo(
    () => (
      <Avatar className={cn("relative h-full w-full overflow-hidden rounded-full", isCoach ? "bg-[#E5EDF7]" : "bg-[#F1F1E6]")}>
        {shouldShowSkeleton ? (
          <Skeleton className="h-full w-full rounded-full bg-[#EAEADF]" />
        ) : displayAvatarUrl ? (
          <AvatarImage loading="eager" src={displayAvatarUrl} alt={displayName} className="object-cover" />
        ) : (
          <AvatarFallback
            className={cn(
              "flex h-full w-full items-center justify-center rounded-full text-[12px] font-medium tracking-[-0.03em]",
              isCoach ? "bg-[#E5EDF7] text-[#0054B4]" : "bg-[#F1F1E6] text-[#484D56]"
            )}
          >
            {initials}
          </AvatarFallback>
        )}
      </Avatar>
    ),
    [shouldShowSkeleton, displayAvatarUrl, displayName, initials, isCoach]
  );

  const sidebarVariant = variant === "sidebar";
  // Working Copy `.menu button`: 14px medium ink, 9px 10px padding, 8px radius.
  const itemClass =
    "cursor-pointer gap-2 rounded-[8px] px-[10px] py-[9px] text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C] focus:bg-[#F9F9F5] focus:text-[#1A202C] [&>svg]:size-4";
  const divider = "my-1 h-px bg-[#EAEADF]";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {sidebarVariant ? (
          <button
            type="button"
            aria-label="Account menu"
            className="flex w-full items-center gap-[10px] rounded-[8px] px-[5px] py-1.5 text-left transition-colors hover:bg-[#F9F9F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
          >
            <span className="relative size-8 shrink-0">{avatarNode}</span>
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">{label?.name ?? displayName}</b>
              {label?.sub ? <span className="truncate text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">{label.sub}</span> : null}
            </span>
          </button>
        ) : variant === "header" ? (
          <button type="button" aria-label="Account menu" className="relative inline-flex size-7 shrink-0 overflow-hidden rounded-full">
            {avatarNode}
          </button>
        ) : (
          <button
            type="button"
            aria-label="Account menu"
            className="relative ml-1.5 inline-flex size-[30px] shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
          >
            <span className="relative size-[30px] overflow-hidden rounded-full">{avatarNode}</span>
            <i className="absolute -bottom-px -right-px size-[10px] rounded-full border-2 border-[#F1F1E6] bg-[#22A04B]" aria-hidden="true" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="flex w-[220px] flex-col rounded-[10px] border-[#EAEADF] bg-[#F7F7F0] p-1.5 shadow-[0_0_15px_rgba(0,0,0,0.05),0_12px_30px_-12px_rgba(16,19,26,0.18)]"
        align={sidebarVariant ? "start" : "end"}
        side={sidebarVariant ? "top" : "bottom"}
        sideOffset={8}
        forceMount
      >
        <DropdownMenuLabel className="flex items-center gap-[10px] px-[10px] pb-[10px] pt-2 font-normal">
          <span className="relative size-8 shrink-0">{avatarNode}</span>
          <span className="flex min-w-0 flex-col gap-1">
            {displayName ? <span className="truncate text-[14px] font-medium leading-[18px] text-[#1A202C]">{displayName}</span> : null}
            <span className="truncate text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">{displayEmail}</span>
          </span>
        </DropdownMenuLabel>
        <div className="mb-1 h-px bg-[#EAEADF]" />
        {isCoach ? (
          // Phone only: the public pages live in the desktop sidebar.
          <div className="flex flex-col md:hidden">
            <DropdownMenuItem onClick={() => navigate(ROUTES.PROFILE)} className={itemClass}>
              <Store strokeWidth={1.5} />
              <span>My Profile</span>
            </DropdownMenuItem>
            {myOrg ? (
              <DropdownMenuItem onClick={() => navigate(ROUTES.MY_ORGANIZATION)} className={itemClass}>
                <Building2 strokeWidth={1.5} />
                <span>Organization page</span>
              </DropdownMenuItem>
            ) : null}
            <div className={divider} />
          </div>
        ) : null}
        {!isCoach ? (
          <DropdownMenuItem onClick={() => navigate(ROUTES.ACCOUNT)} className={itemClass}>
            <User strokeWidth={1.5} />
            <span>Account</span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => navigate(ROUTES.SETTINGS)} className={itemClass}>
          <Settings strokeWidth={1.5} />
          <span>Account Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(ROUTES.HELP)} className={itemClass}>
          <CircleHelp strokeWidth={1.5} />
          <span>Help</span>
        </DropdownMenuItem>
        <div className={divider} />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate(ROUTES.HOME);
          }}
          className={itemClass}
        >
          <LogOut strokeWidth={1.5} />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
