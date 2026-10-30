/**
 * Shop on the coach profile (ATH-106, ATH-112): the gear the coach picked (or their brands', or
 * the store's for their sport) as photo cards with arrows to move between them, then the
 * coach's brand deals with logos and codes. Each product opens its page, where families buy.
 * Hidden when the coach turned Shop off (deals_enabled = false).
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ExternalLink } from "@/components/icons";
import { isShopifyConfigured } from "@/api/shopify";
import { GearProductCard } from "@/components/gear/GearProductCard";
import { useGearProducts } from "@/hooks/useGear";
import { useCoachGearPicks } from "@/hooks/useCoachGearPicks";
import { useCoachBrands } from "@/hooks/useBrands";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { visibleDeals } from "@/utils/affiliateLinks";
import { brandKey, type Brand } from "@/utils/brands";

const NO_BRANDS: Brand[] = [];
import { COACH_GEAR_STORE_LABEL, MAX_COACH_GEAR_PICKS, pickCoachGear } from "@/utils/gear";
import { CoachProfileCard } from "../CoachProfileCard";
import { caption, cardGap, lbl, medium, sectionTitle } from "./styles";

const arrow =
  "inline-flex size-8 items-center justify-center rounded-control border border-light-525 bg-light-300 text-dark transition-colors hover:bg-light-400 disabled:bg-light-400 disabled:text-dark-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export const ShopCard = ({
  coachId,
  first,
  affiliateLinks,
  dealsEnabled,
  coachSport,
  isOwn = false,
}: {
  coachId: string;
  first: string;
  affiliateLinks: unknown;
  dealsEnabled: boolean | null | undefined;
  coachSport?: string | null;
  /** The coach's own preview: "I" instead of their name in the commission line. */
  isOwn?: boolean;
}) => {
  const { toast } = useToast();
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const off = dealsEnabled === false;
  // The coach's brands: their logos show next to matching deals, and their gear shows first.
  const { data: brands = NO_BRANDS } = useCoachBrands(coachId);
  const { data: products = [] } = useGearProducts();
  const { data: picks = [] } = useCoachGearPicks(isShopifyConfigured && !off ? coachId : undefined);
  const { products: gear, source } = isShopifyConfigured
    ? pickCoachGear(
        products,
        brands.map((brand) => brand.name),
        coachSport,
        { picks, seed: coachId, limit: MAX_COACH_GEAR_PICKS },
      )
    : { products: [], source: null };
  const deals = visibleDeals(affiliateLinks, dealsEnabled);
  const logoFor = (name: string) => brands.find((brand) => brandKey(brand.name) === brandKey(name))?.logo_url ?? null;

  // Arrows only when there is more to see in that direction.
  const measure = () => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [gear.length]);

  const move = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-shop-item]");
    el.scrollBy({ left: direction * ((card?.offsetWidth ?? 160) + 10) * 2, behavior: "smooth" });
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: `Code ${code} copied` });
    } catch {
      toast({ title: `Code ${code}`, description: "Copy it from here at checkout." });
    }
  };

  if (off || (!gear.length && !deals.length)) return null;
  const who = isOwn ? "I" : first;

  return (
    <CoachProfileCard className={cardGap} aria-label="Shop">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className={sectionTitle}>Shop</h2>
          <span className={caption}>
            {source === "store" ? COACH_GEAR_STORE_LABEL : `Gear ${who === "I" ? "I use" : `${first} uses`} with players`}
          </span>
        </div>
        {gear.length && !(edges.start && edges.end) ? (
          <div className="flex flex-none gap-1.5">
            <button type="button" className={arrow} onClick={() => move(-1)} disabled={edges.start} aria-label="Previous products">
              <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button type="button" className={arrow} onClick={() => move(1)} disabled={edges.end} aria-label="More products">
              <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      {gear.length ? (
        <div
          ref={scroller}
          onScroll={measure}
          tabIndex={0}
          role="region"
          aria-label={`${first}'s gear. Use the arrow keys to move between products.`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              move(e.key === "ArrowRight" ? 1 : -1);
            }
          }}
          className="-mx-1 flex snap-x snap-mandatory gap-[10px] overflow-x-auto px-1 pb-1 outline-none [scrollbar-width:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-scrollbar]:hidden"
        >
          {gear.map((product) => (
            <div key={product.id} data-shop-item className="w-[160px] shrink-0 snap-start sm:w-[180px]">
              <GearProductCard product={product} />
            </div>
          ))}
        </div>
      ) : null}

      {deals.length ? (
        <div className="flex flex-col gap-2.5">
          <span className={lbl}>Brand deals</span>
          {deals.map((deal) => {
            const logo = logoFor(deal.brand);
            return (
              <div key={deal.url} className="flex items-center justify-between gap-3">
                <a
                  href={deal.url}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className={cn(medium, "flex min-w-0 items-center gap-2.5 hover:text-primary")}
                >
                  <span className="flex size-9 flex-none items-center justify-center overflow-hidden rounded-control border border-light-525 bg-light">
                    {logo ? (
                      <img src={logo} alt="" className="size-full object-contain p-1" />
                    ) : (
                      <span className="text-label-xsm text-dark-300">{deal.brand.slice(0, 2).toUpperCase()}</span>
                    )}
                  </span>
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
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {deals.length || source !== "store" ? (
          <span className={caption}>
            {who} may earn a commission when {isOwn ? "families buy" : "you buy"} through these links.
          </span>
        ) : (
          <span />
        )}
        <Link to={ROUTES.GEAR} className="text-label-sm text-primary hover:underline">
          Shop all gear
        </Link>
      </div>
    </CoachProfileCard>
  );
};
