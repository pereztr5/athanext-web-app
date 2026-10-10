/**
 * "More" under the profile (Working Copy `sp2-more`): 66px rows that open in place for the
 * FAQ, group chats and gear and deals. Rows with nothing in them don't show.
 */
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, CircleHelp, Hash, Tag, type LucideIcon } from "lucide-react";
import { isShopifyConfigured } from "@/api/shopify";
import { useGearProducts } from "@/hooks/useGear";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { visibleDeals } from "@/utils/affiliateLinks";
import { formatPriceRange, pickCoachGear } from "@/utils/gear";
import type { CoachFaqItem } from "../FAQSection";
import { useOwnChannels } from "./hooks";
import { caption, plural } from "./shared";

type Key = "faq" | "chat" | "gear";

const Item = ({ icon: Icon, title, sub, open, onToggle, children }: { icon: LucideIcon; title: string; sub: string; open: boolean; onToggle: () => void; children: ReactNode }) => (
  <div className="[&+&]:border-t [&+&]:border-[#EAEADF]">
    <button type="button" className="flex w-full items-center gap-3 px-[18px] py-4 text-left" aria-expanded={open} onClick={onToggle}>
      <Icon className="size-5 shrink-0 text-[#484D56]" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[14px] font-medium leading-[18px] text-[#1A202C]">{title}</span>
        <span className={caption}>{sub}</span>
      </span>
      <ChevronDown className={cn("size-4 shrink-0 text-[#A3A6AB] transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
    </button>
    {open ? <div className="flex flex-col gap-3 px-[18px] pb-[18px]">{children}</div> : null}
  </div>
);

export const MoreList = ({
  coachId,
  firstName,
  faqs,
  links,
  dealsEnabled,
  brandNames,
}: {
  coachId: string;
  firstName: string;
  faqs: CoachFaqItem[];
  links: unknown;
  dealsEnabled: boolean | null | undefined;
  brandNames: string[];
}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState<Key | null>(null);
  const { data: channels = [] } = useOwnChannels(coachId);
  const { data: products = [] } = useGearProducts();
  const deals = visibleDeals(links, dealsEnabled);
  const gear = isShopifyConfigured ? pickCoachGear(products, brandNames) : [];
  const toggle = (key: Key) => setOpen((cur) => (cur === key ? null : key));

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: `Code ${code} copied` });
    } catch {
      toast({ title: `Code ${code}` });
    }
  };

  const items: ReactNode[] = [];
  if (faqs.length)
    items.push(
      <Item key="faq" icon={CircleHelp} title="Questions families ask" sub={plural(faqs.length, "answer")} open={open === "faq"} onToggle={() => toggle("faq")}>
        {faqs.map((faq) => (
          <div key={faq.id} className="flex flex-col gap-1.5 [&+&]:border-t [&+&]:border-[#EAEADF] [&+&]:pt-3">
            <span className="text-[14px] font-medium leading-[18px] text-[#1A202C]">{faq.question}</span>
            <span className="text-[14px] leading-[20px] text-[#767980]">{faq.answer}</span>
          </div>
        ))}
      </Item>
    );
  if (channels.length)
    items.push(
      <Item key="chat" icon={Hash} title="Group chats" sub={`${plural(channels.length, "chat")} ${channels.length === 1 ? "shows" : "show"} here with a Join button`} open={open === "chat"} onToggle={() => toggle("chat")}>
        {channels.map((ch) => (
          <Link key={ch.conversationId} to={`/chat?conversationId=${ch.conversationId}`} className="flex min-w-0 flex-col gap-1 hover:underline">
            <span className="truncate text-[14px] font-medium leading-[18px] text-[#1A202C]">#{ch.title || "group-chat"}</span>
            <span className={cn(caption, "truncate")}>
              {[plural(ch.memberCount, "family", "families"), ch.description ?? ""].filter(Boolean).join(" · ")}
            </span>
          </Link>
        ))}
      </Item>
    );
  if (deals.length || gear.length)
    items.push(
      <Item
        key="gear"
        icon={Tag}
        title="Gear and deals"
        sub={[deals.length ? plural(deals.length, "brand deal") : "", gear.length ? `${plural(gear.length, "product")} in ${firstName}'s store` : ""].filter(Boolean).join(" · ")}
        open={open === "gear"}
        onToggle={() => toggle("gear")}
      >
        <span className={caption}>You may earn a commission when families buy through these links.</span>
        {deals.map((deal) => (
          <div key={deal.url} className="flex items-center justify-between gap-3">
            <a href={deal.url} target="_blank" rel="sponsored noopener noreferrer" className="flex min-w-0 flex-col gap-1 hover:underline">
              <span className="truncate text-[14px] font-medium leading-[18px] text-[#1A202C]">{deal.brand}</span>
              <span className={cn(caption, "truncate")}>{deal.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
            </a>
            {deal.code ? (
              <button
                type="button"
                className="inline-flex h-[26px] shrink-0 items-center rounded-[4px] border border-dashed border-[#C1C1B8] px-2 font-mono text-[12px] text-[#484D56]"
                aria-label={`Copy code ${deal.code}`}
                onClick={() => void copy(deal.code!)}
              >
                {deal.code}
              </button>
            ) : null}
          </div>
        ))}
        {gear.map((product) => (
          <Link key={product.id} to={`/gear/${product.handle}`} className="flex items-center justify-between gap-3 py-2 hover:underline">
            <span className="truncate text-[14px] font-medium leading-[18px] text-[#1A202C]">{product.title}</span>
            <span className={cn(caption, "shrink-0")}>{formatPriceRange(product)}</span>
          </Link>
        ))}
      </Item>
    );

  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="pl-0.5 text-[12px] font-medium leading-[13px] text-[#767980]">More</span>
      <div className="flex flex-col rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0]">{items}</div>
    </div>
  );
};
