import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Search, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GearLoading, GearNotice, GearPageShell } from "@/components/gear/GearPageShell";
import { GearProductCard } from "@/components/gear/GearProductCard";
import { athleteHomeAPI } from "@/api/athleteHome";
import { isShopifyConfigured } from "@/api/shopify";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useBrandsByCoach } from "@/hooks/useBrands";
import { useGearProducts } from "@/hooks/useGear";
import { useRole } from "@/hooks/useRole";
import {
  PRICE_BANDS,
  applyGearFilters,
  getProductTypeOptions,
  getSportOptions,
  type GearFilters,
} from "@/utils/gear";

const ALL = "__all";
const NO_FILTERS: GearFilters = { search: "", sport: null, category: null, price: null, fromMyCoaches: false };

const filterTriggerClass =
  "!h-auto w-full !rounded-[8px] !border-[#EAEADF] !bg-[#F7F7F0] !px-[10px] !py-[10px] !text-[12px] !font-normal !leading-[14px] !tracking-[-0.36px] shadow-none focus:!ring-0 focus:!ring-offset-0 sm:!w-[200px] [&>svg]:!size-4 [&>svg]:!opacity-100 [&>svg]:!text-[#767980]";

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

  const triggerClass = (value: string | null) => `${filterTriggerClass} ${value ? "!text-[#1A202C]" : "!text-[#767980]"}`;
  const select = (value: string | null, onChange: (v: string | null) => void, label: string, all: string, options: { value: string; label: string }[]) => (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
      <SelectTrigger className={triggerClass(value)} aria-label={label}>
        <SelectValue>{value ? options.find((o) => o.value === value)?.label ?? value : all}</SelectValue>
      </SelectTrigger>
      <SelectContent className="z-50">
        <SelectItem value={ALL}>{all}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

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
          <label className="relative block">
            <span className="sr-only">Search gear</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
            <input
              className="h-[38px] w-full rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0] pl-9 pr-3 text-[14px] placeholder:text-[#A3A6AB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
              placeholder="Search gear, brands or categories"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
            />
          </label>
          <div className="flex flex-col gap-[10px] sm:flex-row sm:flex-wrap sm:items-center">
            {sportOptions.length
              ? select(filters.sport, (v) => set({ sport: v }), "Sport", "All sports", sportOptions.map((o) => ({ value: o, label: o })))
              : null}
            {select(filters.category, (v) => set({ category: v }), "Category", "All categories", typeOptions.map((o) => ({ value: o, label: o })))}
            {select(filters.price, (v) => set({ price: v }), "Price", "Any price", PRICE_BANDS.map((b) => ({ value: b.key, label: b.label })))}
            {coachIds.length ? (
              <label className="flex items-center gap-2 text-[14px] text-[#484D56]">
                <Switch checked={filters.fromMyCoaches} onCheckedChange={(on) => set({ fromMyCoaches: on })} aria-label="From my coaches" />
                From my coaches
              </label>
            ) : null}
          </div>
        </div>

        <p className="text-[14px] font-normal tracking-[-0.7px] text-[#767980]">
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
          <div className="grid grid-cols-2 gap-[10px] sm:gap-6 lg:grid-cols-3">
            {filtered.map((product) => (
              <GearProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <GearPageShell title="Gear" subtitle="Hand-picked equipment from the brands our coaches trust">
      {renderContent()}
    </GearPageShell>
  );
};

export default Gear;
