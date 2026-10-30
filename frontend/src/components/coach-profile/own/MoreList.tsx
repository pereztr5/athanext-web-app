/**
 * "More" under the profile (Working Copy `sp2-more`): 66px rows that open in place for the
 * FAQ and group chats (gear and deals are in Shop). Rows with nothing in them don't show.
 */
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, CircleHelp, Hash, type LucideIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { CoachFaqItem } from "../FAQSection";
import { useOwnChannels } from "./hooks";
import { caption, plural } from "./shared";

type Key = "faq" | "chat";

const Item = ({ icon: Icon, title, sub, open, onToggle, children }: { icon: LucideIcon; title: string; sub: string; open: boolean; onToggle: () => void; children: ReactNode }) => (
  <div className="[&+&]:border-t [&+&]:border-light-525">
    <button type="button" className="flex w-full items-center gap-3 rounded-card px-[18px] py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-expanded={open} onClick={onToggle}>
      <Icon className="size-5 shrink-0 text-dark-400" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-label-sm text-dark">{title}</span>
        <span className={caption}>{sub}</span>
      </span>
      <ChevronDown className={cn("size-4 shrink-0 text-dark-200 transition-transform motion-reduce:transition-none", open && "rotate-180")} strokeWidth={1.5} aria-hidden="true" />
    </button>
    {open ? <div className="flex flex-col gap-3 px-[18px] pb-[18px]">{children}</div> : null}
  </div>
);

export const MoreList = ({
  coachId,
  firstName,
  faqs,
}: {
  coachId: string;
  firstName: string;
  faqs: CoachFaqItem[];
}) => {
  const [open, setOpen] = useState<Key | null>(null);
  const { data: channels = [] } = useOwnChannels(coachId);
  const toggle = (key: Key) => setOpen((cur) => (cur === key ? null : key));

  const items: ReactNode[] = [];
  if (faqs.length)
    items.push(
      <Item key="faq" icon={CircleHelp} title="Questions families ask" sub={plural(faqs.length, "answer")} open={open === "faq"} onToggle={() => toggle("faq")}>
        {faqs.map((faq) => (
          <div key={faq.id} className="flex flex-col gap-1.5 [&+&]:border-t [&+&]:border-light-525 [&+&]:pt-3">
            <span className="text-label-sm text-dark">{faq.question}</span>
            <span className="text-paragraph text-dark-300">{faq.answer}</span>
          </div>
        ))}
      </Item>
    );
  if (channels.length)
    items.push(
      <Item key="chat" icon={Hash} title="Group chats" sub={`${plural(channels.length, "chat")} ${channels.length === 1 ? "shows" : "show"} here with a Join button`} open={open === "chat"} onToggle={() => toggle("chat")}>
        {channels.map((ch) => (
          <Link key={ch.conversationId} to={`/chat?conversationId=${ch.conversationId}`} className="flex min-w-0 flex-col gap-1 hover:underline">
            <span className="truncate text-label-sm text-dark">#{ch.title || "group-chat"}</span>
            <span className={cn(caption, "truncate")}>
              {[plural(ch.memberCount, "family", "families"), ch.description ?? ""].filter(Boolean).join(" · ")}
            </span>
          </Link>
        ))}
      </Item>
    );

  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="pl-0.5 text-label-xsm text-dark-300">More</span>
      <div className="flex flex-col rounded-card border border-light-525 bg-light-300">{items}</div>
    </div>
  );
};
