import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, CircleHelp, ExternalLink, Hash, Tag, type LucideIcon } from "@/components/icons";
import { isShopifyConfigured } from "@/api/shopify";
import { useGearProducts } from "@/hooks/useGear";
import { useCoachGearPicks } from "@/hooks/useCoachGearPicks";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { visibleDeals } from "@/utils/affiliateLinks";
import { COACH_GEAR_STORE_LABEL, formatPriceRange, pickCoachGear } from "@/utils/gear";
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
 * Gear and deals, each shown only when there is something in it.
 */
export const MoreList = ({
  coachId,
  first,
  faqs,
  affiliateLinks,
  dealsEnabled,
  brandNames,
  coachSport,
}: {
  coachId: string;
  first: string;
  faqs: { id: string; question: string; answer: string }[];
  affiliateLinks: unknown;
  dealsEnabled: boolean | null | undefined;
  brandNames: string[];
  /** Coach sport; store gear for it shows when the coach's brands have none. */
  coachSport?: string | null;
}) => {
  const [open, setOpen] = useState<string | null>(null);
  const { toast } = useToast();
  const { channels } = useFamilyCoachChannels(coachId);
  const { data: products = [] } = useGearProducts();
  const { data: picks = [] } = useCoachGearPicks(isShopifyConfigured ? coachId : undefined);
  const { products: gear, source: gearSource } = isShopifyConfigured
    ? pickCoachGear(products, brandNames, coachSport, { picks, seed: coachId })
    : { products: [], source: null };
  const storeGear = gearSource === "store";
  const deals = visibleDeals(affiliateLinks, dealsEnabled);
  const toggle = (key: string) => setOpen((current) => (current === key ? null : key));

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: `Code ${code} copied` });
    } catch {
      toast({ title: `Code ${code}`, description: "Copy it from here at checkout." });
    }
  };

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
  if (deals.length || gear.length) {
    const sub = [deals.length ? plural(deals.length, "brand deal") : "", gear.length ? (storeGear ? `${plural(gear.length, "product")} from the AthaNext store` : gearSource === "picks" ? `${plural(gear.length, "product")} ${first} picked` : `${plural(gear.length, "product")} in ${first}'s store`) : ""]
      .filter(Boolean)
      .join(" · ");
    items.push(
      <Item key="gear" icon={Tag} title="Gear and deals" sub={sub} open={open === "gear"} onToggle={() => toggle("gear")}>
        {deals.length || !storeGear ? (
          <span className={caption}>{first} may earn a commission when families buy through these links.</span>
        ) : null}
        {deals.map((deal) => (
          <div key={deal.url} className="flex items-center justify-between gap-3">
            <a
              href={deal.url}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className={cn(medium, "inline-flex min-w-0 items-center gap-1.5 hover:text-primary")}
            >
              <span className="truncate">{deal.brand}</span>
              <ExternalLink className="size-3.5 shrink-0 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
            </a>
            {deal.code ? (
              <button
                type="button"
                onClick={() => copy(deal.code as string)}
                aria-label={`Copy code ${deal.code}`}
                className="shrink-0 rounded-pill border border-dashed border-light-600 px-2 py-1 font-mono text-caption text-dark-400 hover:border-dark-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {deal.code}
              </button>
            ) : null}
          </div>
        ))}
        {storeGear || gearSource === "picks" ? (
          <span className="text-label-xsm text-dark-300">{storeGear ? COACH_GEAR_STORE_LABEL : `${first}'s picks`}</span>
        ) : null}
        {gear.map((product) => (
          <Link key={product.id} to={`${ROUTES.GEAR}/${product.handle}`} className="flex items-center justify-between gap-3 py-2 hover:text-primary">
            <span className={cn(medium, "truncate")}>{product.title}</span>
            <span className={cn(caption, "shrink-0")}>{formatPriceRange(product)}</span>
          </Link>
        ))}
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
