import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, MessageCircle } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserMenu } from "@/components/common/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/routes";
import { chatAPI } from "@/api/chat";
import { notificationsAPI, type AppNotification } from "@/api/notifications";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { formatDateInZone } from "@/utils/viewerTime";

const notificationWhen = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
};

export const AppTopBar = () => {
  const navigate = useNavigate();
  const { hasNewMessage, user, profileReady, setHasNewMessage } = useAuth();
  const queryClient = useQueryClient();
  const timeZone = useViewerTimeZone();
  const [open, setOpen] = useState(false);

  // Built on the server so every item links to its own screen (ATH-98).
  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id, hasNewMessage],
    queryFn: () => notificationsAPI.list(),
    enabled: Boolean(user?.id),
    refetchInterval: 60_000,
  });
  const notifications = notificationsQuery.data ?? [];
  const hasUnread = notifications.some((n) => n.unread);

  const describe = (n: AppNotification) =>
    n.kind === "upcoming" && n.startsAt
      ? `starts ${formatDateInZone(new Date(n.startsAt), timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })}.`
      : n.kind === "message"
        ? n.body || "sent you a message"
        : n.body;

  // Unread conversations for the Messages button (ATH-75); refreshed when a new message arrives.
  const unreadQuery = useQuery({
    queryKey: ["unread-conversations", user?.id, hasNewMessage],
    queryFn: () => chatAPI.countUnreadConversations(user!.id).then((r) => r.data ?? 0),
    enabled: Boolean(user?.id),
    refetchInterval: 60_000,
  });
  const unread = unreadQuery.data ?? 0;

  return (
    <header
      className="sticky z-40 bg-[#F1F1E6] px-4 pt-5 md:px-10"
      style={{ top: "var(--network-banner-height, 0px)" }}
    >
      <div className="mx-auto flex w-full max-w-[1000px] items-center justify-end pb-[30px]">
        <SidebarTrigger className="mr-auto md:hidden" />
        <div className="sm:hidden">
          <UserMenu useFallbackDelay avatarReady={profileReady} />
        </div>
        <Link
          to={ROUTES.CHAT}
          aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
          className="relative mr-4 inline-flex size-8 items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C] hover:bg-[#F4F4EB]"
        >
          <MessageCircle className="size-[18px]" strokeWidth={1.5} />
          {unread ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#0054B4] px-1 text-[10px] font-semibold text-[#F1F1E6]">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Link>
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) {
              setHasNewMessage(false);
              // Opening the bell marks everything but unread messages as seen.
              void notificationsAPI.markSeen().catch(() => undefined);
            } else {
              queryClient.invalidateQueries({ queryKey: ["notifications"] });
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={hasUnread ? "Notifications, new items" : "Notifications"}
              className="relative inline-flex size-5 items-center justify-center text-[#1A202C]"
            >
              <Bell className="size-5" strokeWidth={1.5} />
              {hasUnread || hasNewMessage ? (
                <span className="absolute -right-0.5 -top-0.5 size-[6.6px] rounded-full bg-[#0054B4]" />
              ) : null}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={14}
            className="w-[277px] rounded-[10px] border-[#EAEADF] bg-[#F4F4EB] p-0 shadow-[0px_0px_15px_0px_rgba(0,0,0,0.05)]"
          >
            <div className="flex max-h-80 flex-col gap-[10px] overflow-y-auto px-[10px] py-[15px]">
              {notifications.length ? (
                notifications.map((n, index) => (
                  <div key={n.id} className="flex flex-col gap-[10px]">
                    {index > 0 ? <div className="h-px w-full bg-[#EAEADF]" /> : null}
                    <button
                      type="button"
                      className="flex w-full items-center gap-[10px] rounded-[5px] p-[5px] text-left hover:bg-[#F9F9F5]"
                      onClick={() => {
                        setOpen(false);
                        navigate(n.link);
                      }}
                    >
                      <span
                        className={
                          n.unread
                            ? "size-[5px] shrink-0 rounded-full bg-[#0054B4]"
                            : "size-[5px] shrink-0 rounded-full bg-transparent"
                        }
                        aria-hidden={!n.unread}
                      />
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <div className="size-[30px] shrink-0 overflow-hidden rounded-[4px] bg-[#C1C1B8]">
                          {n.image ? (
                            <img src={n.image} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center text-[10px] font-medium text-[#484D56]">
                              {getInitials(n.title)}
                            </span>
                          )}
                        </div>
                        <p className="min-w-0 flex-1 text-[12px] font-normal leading-[14px] tracking-[-0.36px]">
                          <span className="text-[#1A202C]">{n.title} </span>
                          <span className="text-[#767980]">{describe(n)}</span>
                        </p>
                        <span className="shrink-0 text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
                          {n.kind === "upcoming" ? "" : notificationWhen(n.at)}
                        </span>
                      </div>
                    </button>
                  </div>
                ))
              ) : (
                <p className="px-[5px] py-2 text-[12px] leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
                  {notificationsQuery.isLoading ? "Loading…" : "No notifications yet"}
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};
