import { CheckCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type MessageBubbleProps = {
  text: string;
  time: string;
  isUser: boolean;
  initials: string;
  status?: string;
};

const MessageBubble = ({
  text,
  time,
  isUser,
  initials,
  status,
}: MessageBubbleProps) => {
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
