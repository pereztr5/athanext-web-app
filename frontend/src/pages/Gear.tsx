import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Search, ShoppingBag, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GearLoading, GearNotice, GearPageShell } from "@/components/gear/GearPageShell";
import { GearProductCard } from "@/components/gear/GearProductCard";
import { athleteHomeAPI } from "@/api/athleteHome";
import { isShopifyConfigured } from "@/api/shopify";
import { input, meta, segButton, segGroup } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useBrandsByCoach } from "@/hooks/useBrands";
import { useGearProducts } from "@/hooks/useGear";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";
import { brandKey } from "@/utils/brands";
import {
  PRICE_BANDS,
  applyGearFilters,
  getProductTypeOptions,
  getSportOptions,
  type GearFilters,
} from "@/utils/gear";

const ALL = "__all";
const NO_FILTERS: GearFilters = { search: "", sport: null, category: null, price: null, fromMyCoaches: false };

const chipClass = (on: boolean) =>
  `inline-flex h-[30px] items-center rounded-[8px] border px-3 text-[14px] font-medium transition-colors ${
    on ? "border-[#1A202C] bg-[#F7F7F0] text-[#1A202C]" : "border-transparent bg-[#F4F4EB] text-[#1A202C] hover:bg-[#EAEADF]"
  }`;

const Gear = () => {
  const { data: products = [], isLoading, isError, refetch, isFetching } = useGearProducts();
  const [filters, setFilters] = useState<GearFilters>(NO_FILTERS);
  const { user } = useAuth();
  const { isAthleteLike } = useRole();

  // "From my coaches" uses the brands of the coaches this athlete trains with (ATH-97).
  const home = useQuery({ queryKey: ["athlete-home"], queryFn: () => athleteHomeAPI.get(), enabled: Boolean(user) && isAthleteLike });
  const coachIds = useMemo(() => (home.data?.coaches ?? []).map((c) => c.id), [home.data]);
  const { data: brandsByCoach = {} } = useBrandsByCoach(coachIds);
  const coachBrandNames = useMemo(() => Object.values(brandsByCoach).flat().map((b) => b.name), [brandsByCoach]);

  const typeOptions = useMemo(() => getProductTypeOptions(products), [products]);
  const sportOptions = useMemo(() => getSportOptions(products), [products]);
  const filtered = useMemo(() => applyGearFilters(products, filters, coachBrandNames), [products, filters, coachBrandNames]);
  const set = (patch: Partial<GearFilters>) => setFilters((f) => ({ ...f, ...patch }));

  // Filters as chip rows, as in the Working Copy.
  const chips = (value: string | null, onChange: (v: string | null) => void, label: string, all: string, options: { value: string; label: string }[]) => (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {[{ value: null as string | null, label: all }, ...options].map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value ?? ALL}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={chipClass(on)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );

  // The first of the family's coaches whose brands have products here (Working Copy: "From Michael's store").
  const featured = useMemo(() => {
    for (const c of home.data?.coaches ?? []) {
      const names = (brandsByCoach[c.id] ?? []).map((b) => brandKey(b.name));
      const picks = products.filter((p) => p.availableForSale !== false && names.includes(brandKey(p.vendor))).slice(0, 5);
      if (picks.length) return { coach: c, picks };
    }
    return null;
  }, [home.data, brandsByCoach, products]);

  const renderContent = () => {
    if (!isShopifyConfigured) {
      return (
        <GearNotice
          icon={ShoppingBag}
          title="The gear store is coming soon"
          description="We're getting the shelves ready. Check back shortly."
        />
      );
    }
    if (isLoading) return <GearLoading label="Loading gear" />;
    if (isError) {
      return (
        <GearNotice
          icon={AlertCircle}
          title="We couldn't load the gear store"
          description="Something went wrong on our side. Please try again in a moment."
          action={
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              Try again
            </Button>
          }
        />
      );
    }
    if (products.length === 0) {
      return (
        <GearNotice
          icon={ShoppingBag}
          title="No gear yet"
          description="New products are on the way. Check back soon."
        />
      );
    }

    return (
      <>
        <div className="flex flex-col gap-[10px]">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[240px] flex-1">
              <span className="sr-only">Search gear</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
              <input
                className={cn(input, "pl-9")}
                placeholder="Search gear"
                value={filters.search}
                onChange={(e) => set({ search: e.target.value })}
              />
            </label>
            {sportOptions.length ? (
              <div className={segGroup} role="group" aria-label="Sport">
                <button type="button" className={segButton(!filters.sport)} onClick={() => set({ sport: null })}>All</button>
                {sportOptions.map((o) => (
                  <button key={o} type="button" className={segButton(filters.sport === o)} onClick={() => set({ sport: o })}>
                    {o}
                  </button>
                ))}
              </div>
            ) : null}
            <select
              className={cn(input, "w-auto min-w-[140px]")}
              aria-label="Price"
              value={filters.price ?? ""}
              onChange={(e) => set({ price: e.target.value || null })}
            >
              <option value="">Any price</option>
              {PRICE_BANDS.map((b) => (
                <option key={b.key} value={b.key}>{b.label}</option>
              ))}
            </select>
            {coachIds.length ? (
              <button
                type="button"
                aria-pressed={filters.fromMyCoaches}
                onClick={() => set({ fromMyCoaches: !filters.fromMyCoaches })}
                className={chipClass(filters.fromMyCoaches)}
              >
                <UserCheck className="mr-1 inline size-3.5" strokeWidth={1.5} aria-hidden="true" />
                From my coaches
              </button>
            ) : null}
          </div>
          {typeOptions.length ? chips(filters.category, (v) => set({ category: v }), "Category", "All", typeOptions.map((o) => ({ value: o, label: o }))) : null}
        </div>

        {featured && !filters.fromMyCoaches && !filters.search ? (
          <section className="flex flex-col gap-4 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <b className="text-[16px] font-medium tracking-[-0.05em]">From {featured.coach.name.split(" ")[0]}'s store</b>
              <span className={meta}>
                Your coach · {featured.picks.length} {featured.picks.length === 1 ? "product" : "products"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {featured.picks.map((product) => (
                <GearProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ) : null}

        <p className="text-[12px] leading-[16px] text-[#767980]">
          {filtered.length} {filtered.length === 1 ? "product" : "products"}
        </p>

        {filtered.length === 0 ? (
          <GearNotice
            icon={ShoppingBag}
            title="No gear matches your filters"
            description={
              filters.fromMyCoaches && !coachBrandNames.length
                ? "Your coaches haven't added the brands they use yet."
                : "Try a different search or filter, or clear the filters to see everything."
            }
            action={
              <Button
                variant="outline"
                onClick={() => setFilters(NO_FILTERS)}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {filtered.map((product) => (
              <GearProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <GearPageShell title="Gear" subtitle="Hand-picked equipment from the brands our coaches trust.">
      {renderContent()}
    </GearPageShell>
  );
};

export default Gear;
