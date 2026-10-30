import { useState, type ReactNode } from "react";
import { ChevronDown, CircleHelp, Hash, type LucideIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { GroupChatRows } from "../GroupChatsCard";
import { useFamilyCoachChannels } from "./hooks";
import { caption, lbl, medium, plural } from "./styles";

const Item = ({
  icon: Icon,
  title,
  sub,
  open,
  onToggle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => (
  <div>
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 rounded-card px-[18px] py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <Icon className="size-5 shrink-0 text-dark-400" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={medium}>{title}</span>
        <span className={caption}>{sub}</span>
      </span>
      <ChevronDown
        className={cn("size-4 shrink-0 text-dark-200 transition-transform motion-reduce:transition-none", open && "rotate-180")}
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </button>
    {open ? <div className="flex flex-col gap-3 px-[18px] pb-[18px]">{children}</div> : null}
  </div>
);

/**
 * More (Working Copy `.sp2-more`): one accordion with Questions families ask, Group chats and
 * Group chats, each shown only when there is something in it. Gear and deals are in Shop.
 */
export const MoreList = ({
  coachId,
  first,
  faqs,
}: {
  coachId: string;
  first: string;
  faqs: { id: string; question: string; answer: string }[];
}) => {
  const [open, setOpen] = useState<string | null>(null);
  const { channels } = useFamilyCoachChannels(coachId);
  const toggle = (key: string) => setOpen((current) => (current === key ? null : key));

  const items: ReactNode[] = [];
  if (faqs.length) {
    items.push(
      <Item key="faq" icon={CircleHelp} title="Questions families ask" sub={plural(faqs.length, "answer")} open={open === "faq"} onToggle={() => toggle("faq")}>
        <div className="flex flex-col gap-3 divide-y divide-light-525">
          {faqs.map((faq) => (
            <div key={faq.id} className="flex flex-col gap-1.5 pt-3 first:pt-0">
              <span className={medium}>{faq.question}</span>
              <span className="text-paragraph text-dark-300">{faq.answer}</span>
            </div>
          ))}
        </div>
      </Item>
    );
  }
  if (channels.length) {
    items.push(
      <Item key="chat" icon={Hash} title="Group chats" sub="Join for session posts and open spots" open={open === "chat"} onToggle={() => toggle("chat")}>
        <GroupChatRows coachId={coachId} channels={channels} />
      </Item>
    );
  }
  if (!items.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className={cn(lbl, "pl-0.5")}>More</span>
      <div className="flex flex-col divide-y divide-light-525 rounded-card border border-light-525 bg-light-300">{items}</div>
    </div>
  );
};
