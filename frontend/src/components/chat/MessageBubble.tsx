import { Link } from "react-router-dom";
import { CheckCheck } from "@/components/icons";

import { cn } from "@/lib/utils";
import { splitMessageLinks } from "@/utils/messageLinks";

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
  <div className="size-[25px] shrink-0 overflow-hidden rounded-full border border-light-550 bg-light">
    {avatarUrl ? (
      <img src={avatarUrl} alt="" className="size-full object-cover" />
    ) : (
      <span className="flex size-full items-center justify-center text-label-xsm text-dark-300">
        {initials.slice(0, 2)}
      </span>
    )}
  </div>
);

const linkClass = "underline underline-offset-2 text-primary hover:text-primary-700 break-all";

/** Message text with web addresses as links; AthaNext links stay in the app. */
const MessageText = ({ text }: { text: string }) => (
  <>
    {splitMessageLinks(text, window.location.origin).map((part, i) =>
      part.kind === "text" ? (
        part.text
      ) : part.appPath ? (
        <Link key={i} to={part.appPath} className={linkClass}>
          {part.text}
        </Link>
      ) : (
        <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {part.text}
        </a>
      ),
    )}
  </>
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
            <span className="shrink-0 text-caption text-dark-300">{status}</span>
          ) : null}
          <div className="flex min-w-0 flex-col gap-[3px]">
            {senderName ? (
              <span className="text-label-xsm text-dark-300">{senderName}</span>
            ) : null}
            <div
              className={cn(
                "min-w-0 whitespace-pre-wrap break-words rounded-card px-[14px] py-2.5 text-paragraph text-dark",
                isUser ? "bg-primary-100" : "bg-light"
              )}
            >
              <MessageText text={text} />
            </div>
          </div>
          {!isUser ? (
            <span className="shrink-0 text-caption text-dark-300">
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
          "max-w-[80%] whitespace-pre-wrap break-words rounded-card px-3 py-2.5 text-paragraph [text-wrap:pretty]",
          isUser
            ? "border border-primary-300 bg-primary-100 text-dark"
            : "border border-light-525 bg-light-300 text-dark"
        )}
      >
        <MessageText text={text} />
      </div>
      <span
        className={cn(
          "flex items-center gap-1 text-caption text-dark-300",
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
