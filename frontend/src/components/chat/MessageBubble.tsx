import { CheckCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type MessageBubbleProps = {
  text: string;
  time: string;
  isUser: boolean;
  initials: string;
  status?: string;
  avatarUrl?: string | null;
  /** Shown above the bubble in group channels (ATH-21). */
  senderName?: string;
  variant?: "default" | "thread";
};

const ThreadAvatar = ({ initials, avatarUrl }: { initials: string; avatarUrl?: string | null }) => (
  <div className="size-[25px] shrink-0 overflow-hidden rounded-[8px] bg-[#C1C1B8]">
    {avatarUrl ? (
      <img src={avatarUrl} alt="" className="size-full object-cover" />
    ) : (
      <span className="flex size-full items-center justify-center text-[10px] font-medium text-[#484D56]">
        {initials.slice(0, 2)}
      </span>
    )}
  </div>
);

const MessageBubble = ({
  text,
  time,
  isUser,
  initials,
  status,
  avatarUrl,
  senderName,
  variant = "default",
}: MessageBubbleProps) => {
  if (variant === "thread") {
    return (
      <div className={cn("flex w-full items-center", isUser ? "justify-end" : "justify-start")}>
        <div className="flex w-fit max-w-[85%] items-center gap-[10px]">
          {!isUser ? <ThreadAvatar initials={initials} avatarUrl={avatarUrl} /> : null}
          {isUser && status ? (
            <span className="shrink-0 text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">{status}</span>
          ) : null}
          <div className="flex min-w-0 flex-col gap-[3px]">
            {senderName ? (
              <span className="text-[12px] font-medium leading-[14px] tracking-[-0.36px] text-[#767980]">{senderName}</span>
            ) : null}
            <div
              className={cn(
                "min-w-0 break-words rounded-[8px] px-[10px] py-2 text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]",
                isUser ? "bg-[#CCDDF0]" : "bg-[#F1F1E6]"
              )}
            >
              {text}
            </div>
          </div>
          {!isUser ? (
            <span className="shrink-0 text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
              {status ? `${status} ${time}` : time}
            </span>
          ) : null}
          {isUser ? <ThreadAvatar initials={initials} avatarUrl={avatarUrl} /> : null}
        </div>
      </div>
    );
  }

  // Default variant (CoachChatPanel): no avatars; read status only on outgoing messages.
  return (
    <div className={cn("flex w-full flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap break-words rounded-[8px] px-3 py-2.5 text-[14px] leading-[18px] tracking-[-0.03em] [text-wrap:pretty]",
          isUser
            ? "bg-[#0054B4] text-[#F1F1E6]"
            : "border border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C]"
        )}
      >
        {text}
      </div>
      <span
        className={cn(
          "flex items-center gap-1 text-[12px] leading-[14px] tracking-[-0.03em] text-[#A3A6AB]",
          isUser ? "pr-0.5" : "pl-0.5"
        )}
      >
        {time}
        {isUser && status ? (
          <>
            <CheckCheck className="size-3" strokeWidth={2} aria-hidden="true" />
            {status}
          </>
        ) : null}
      </span>
    </div>
  );
};

export default MessageBubble;
