import { CheckCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type MessageBubbleProps = {
  text: string;
  time: string;
  isUser: boolean;
  initials: string;
  status?: string;
  avatarUrl?: string | null;
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
          <div
            className={cn(
              "min-w-0 break-words rounded-[8px] px-[10px] py-2 text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]",
              isUser ? "bg-[#CCDDF0]" : "bg-[#F1F1E6]"
            )}
          >
            {text}
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

  return (
    <div className={cn("flex w-full gap-3 px-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 h-10 w-10 rounded-full bg-[#1c77ff] text-white font-semibold flex items-center justify-center shadow-soft">
          <span className="text-sm leading-none">{initials}</span>
        </div>
      )}
      <div className={cn("max-w-xl w-full space-y-2", isUser ? "text-right" : "text-left")}>
        <div
          className={cn(
            "rounded-[18px] px-4 py-3 text-sm leading-relaxed shadow-soft break-words break-all overflow-hidden max-w-[85%] sm:max-w-[75%] inline-block text-left",
            isUser
              ? "bg-[#1a73e8] text-white"
              : "bg-white/90 text-slate-800 border border-slate-200"
          )}
        >
          {text}
        </div>
        <div
          className={cn(
            "flex items-center gap-2 text-xs text-slate-500",
            isUser ? "justify-end pr-1" : "justify-start pl-1"
          )}
        >
          <span>{time}</span>
          {status && isUser && (
            <>
              <CheckCheck className="h-3.5 w-3.5 text-slate-500" />
              <span>{status}</span>
            </>
          )}
          {!isUser && status && (
            <>
              <CheckCheck className="h-3.5 w-3.5 text-slate-500" />
              <span>{status}</span>
            </>
          )}
        </div>
      </div>
      {isUser && (
        <div className="mt-1 h-10 w-10 rounded-full bg-[#1c77ff] text-white font-semibold flex items-center justify-center shadow-soft">
          <span className="text-sm leading-none">{initials}</span>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
