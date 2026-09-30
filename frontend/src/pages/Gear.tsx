import { useMemo, useState } from "react";
import { AlertCircle, ShoppingBag } from "lucide-react";
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
import { isShopifyConfigured } from "@/api/shopify";
import { useGearProducts } from "@/hooks/useGear";
import {
  ALL_BRANDS,
  ALL_TYPES,
  filterGearProducts,
  getBrandOptions,
  getProductTypeOptions,
} from "@/utils/gear";

const filterTriggerClass =
  "!h-auto w-full !rounded-[8px] !border-[#EAEADF] !bg-[#F7F7F0] !px-[10px] !py-[10px] !text-[12px] !font-normal !leading-[14px] !tracking-[-0.36px] shadow-none focus:!ring-0 focus:!ring-offset-0 sm:!w-[200px] [&>svg]:!size-4 [&>svg]:!opacity-100 [&>svg]:!text-[#767980]";

const Gear = () => {
  const { data: products = [], isLoading, isError, refetch, isFetching } = useGearProducts();
  const [brand, setBrand] = useState(ALL_BRANDS);
  const [productType, setProductType] = useState(ALL_TYPES);

  const brandOptions = useMemo(() => getBrandOptions(products), [products]);
  const typeOptions = useMemo(() => getProductTypeOptions(products), [products]);
  const filtered = useMemo(() => filterGearProducts(products, brand, productType), [products, brand, productType]);

  const triggerClass = (value: string, allValue: string) =>
    `${filterTriggerClass} ${value === allValue ? "!text-[#767980]" : "!text-[#1A202C]"}`;

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
        <div className="flex flex-col gap-[10px] sm:flex-row">
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger className={triggerClass(brand, ALL_BRANDS)} aria-label="Brand">
              <SelectValue>{brand === ALL_BRANDS ? "All brands" : brand}</SelectValue>
            </SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value={ALL_BRANDS}>All brands</SelectItem>
              {brandOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger className={triggerClass(productType, ALL_TYPES)} aria-label="Product type">
              <SelectValue>{productType === ALL_TYPES ? "All types" : productType}</SelectValue>
            </SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value={ALL_TYPES}>All types</SelectItem>
              {typeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-[14px] font-normal tracking-[-0.7px] text-[#767980]">
          {filtered.length} {filtered.length === 1 ? "product" : "products"}
        </p>

        {filtered.length === 0 ? (
          <GearNotice
            icon={ShoppingBag}
            title="No gear matches your filters"
            description="Try a different brand or type, or clear the filters to see everything."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setBrand(ALL_BRANDS);
                  setProductType(ALL_TYPES);
                }}
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
