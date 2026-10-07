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
import { Building2, CircleHelp, LogOut, Settings, Store } from "lucide-react";
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
   * Sidebar avatar matches the Figma 40px, 10px-radius mark.
   * Header avatar is the brand-kit 28px circle with flat blue initials and no completion ring.
   */
  variant?: "default" | "sidebar" | "header";
};

export const UserMenu: React.FC<UserMenuProps> = ({
  name = null,
  email = null,
  img = null,
  fallbackImg = null,
  useFallbackDelay = false,
  avatarReady: avatarReadyProp,
  variant = "default",
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
  const { profile, profileProgress } = useProfile();
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

  const {
    profileCompletion,
    isProfileComplete,
    ringDegrees,
    avatarNode,
  } = useMemo(() => {
    const completionSource = profileProgress?.completion ?? 0;
    const clampedCompletion = Math.min(Math.max(completionSource, 0), 100);
    const isComplete = clampedCompletion >= 100;
    const degrees = clampedCompletion * 3.6;
    const sidebarMark = variant === "sidebar";
    const headerMark = variant === "header";
    const node = (
      <Avatar
        className={cn(
          "relative h-full w-full overflow-hidden",
          sidebarMark
            ? "rounded-[10px] bg-[#1599BC]"
            : headerMark
              ? "rounded-full bg-[#E5EDF7]"
              : "rounded-full bg-[#E5EDF7]"
        )}
      >
        {shouldShowSkeleton ? (
          <div className="w-full h-full flex items-center justify-center">
            <Skeleton
              className={cn(
                "h-full w-full",
                sidebarMark ? "rounded-[10px]" : "rounded-full",
                headerMark && "bg-[#EAEADF]"
              )}
            />
          </div>
        ) : displayAvatarUrl ? (
          <AvatarImage
            loading="eager"
            src={displayAvatarUrl}
            alt={displayName}
            className="object-cover"
          />
        ) : (
          <AvatarFallback
            className={cn(
              "flex h-full w-full items-center justify-center",
              sidebarMark
                ? "rounded-[10px] bg-[#1599BC] text-[14px] font-medium text-[#F1F1E6]"
                : headerMark
                  ? "rounded-full bg-[#E5EDF7] text-[12px] font-medium tracking-[-0.03em] text-[#0054B4]"
                  : "rounded-full bg-[#E5EDF7] text-[12px] font-medium tracking-[-0.03em] text-[#0054B4]"
            )}
          >
            {initials}
          </AvatarFallback>
        )}
      </Avatar>
    );

    return {
      profileCompletion: clampedCompletion,
      isProfileComplete: isComplete,
      ringDegrees: degrees,
      avatarNode: node,
    };
  }, [shouldShowSkeleton, displayAvatarUrl, displayName, initials, profileProgress?.completion, variant]);

  const headerVariant = variant === "header";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label="Account menu"
          className={cn(
            "relative p-0 hover:bg-transparent",
            headerVariant ? "h-7 w-7" : "h-10 w-10",
            variant === "sidebar" ? "rounded-[10px]" : "rounded-full"
          )}
        >
          {headerVariant ? (
            <div className="relative h-7 w-7 overflow-hidden rounded-full">
              {avatarNode}
            </div>
          ) : variant !== "sidebar" && profileCompletion > 0 && profileCompletion < 100 ? (
            <div
              className={cn(
                "relative h-10 w-10 rounded-full p-[4px] transition-all duration-200",
                "shadow-[0_0_0_1px_rgba(0,0,0,0.04)]"
              )}
              style={{
                background: `conic-gradient(#22c55e ${ringDegrees}deg, #e5e7eb ${ringDegrees}deg)`,
              }}
              aria-label={`Profile completion ${profileCompletion}%`}
            >
              {avatarNode}
            </div>
          ) : (
            <div className={cn("relative h-10 w-10", variant === "sidebar" ? "overflow-hidden rounded-[10px]" : "rounded-full")}>
              {avatarNode}
            </div>
          )}
          
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="flex w-[227px] flex-col gap-[5px] rounded-[10px] border-[#EAEADF] bg-[#F4F4EB] p-[10px] shadow-[0px_0px_15px_0px_rgba(0,0,0,0.05)]"
        align={headerVariant ? "end" : "start"}
        side={headerVariant ? "bottom" : "top"}
        sideOffset={12}
        forceMount
      >
        <DropdownMenuLabel className="p-[5px] font-normal">
          <p className="truncate text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
            {displayEmail}
          </p>
        </DropdownMenuLabel>
        {isCoach ? (
          <DropdownMenuItem
            onClick={() => navigate(ROUTES.PROFILE)}
            className="cursor-pointer gap-[5px] rounded-[5px] p-[5px] text-[14px] font-normal leading-[18px] tracking-[-0.7px] text-[#767980] focus:bg-[#F9F9F5] focus:text-[#767980]"
          >
            <Store className="size-4" strokeWidth={1.75} />
            <span>My Profile</span>
          </DropdownMenuItem>
        ) : null}
        {isCoach && myOrg ? (
          <DropdownMenuItem
            onClick={() => navigate(ROUTES.MY_ORGANIZATION)}
            className="cursor-pointer gap-[5px] rounded-[5px] p-[5px] text-[14px] font-normal leading-[18px] tracking-[-0.7px] text-[#767980] focus:bg-[#F9F9F5] focus:text-[#767980]"
          >
            <Building2 className="size-4" strokeWidth={1.75} />
            <span>My Organization</span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onClick={() => navigate(ROUTES.SETTINGS)}
          className="cursor-pointer gap-[5px] rounded-[5px] p-[5px] text-[14px] font-normal leading-[18px] tracking-[-0.7px] text-[#767980] focus:bg-[#F9F9F5] focus:text-[#767980]"
        >
          <Settings className="size-4" strokeWidth={1.75} />
          <span>Account Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate(ROUTES.CONTACT_US)}
          className="cursor-pointer gap-[5px] rounded-[5px] p-[5px] text-[14px] font-normal leading-[18px] tracking-[-0.7px] text-[#767980] focus:bg-[#F9F9F5] focus:text-[#767980]"
        >
          <CircleHelp className="size-4" strokeWidth={1.75} />
          <span>Help</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate(ROUTES.HOME);
          }}
          className="cursor-pointer gap-[5px] rounded-[5px] p-[5px] text-[14px] font-normal leading-[18px] tracking-[-0.7px] text-[#767980] focus:bg-[#F9F9F5] focus:text-[#767980]"
        >
          <LogOut className="size-4" strokeWidth={1.75} />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
