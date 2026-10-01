import { Link } from "react-router-dom";
import { isShopifyConfigured } from "@/api/shopify";
import { GearProductCard } from "@/components/gear/GearProductCard";
import { useGearProducts } from "@/hooks/useGear";
import { ROUTES } from "@/routes";
import { pickCoachGear } from "@/utils/gear";
import { CoachProfileCard, CoachProfileCardHeader } from "./CoachProfileCard";

/** Gear store preview on the coach profile (ATH-65): the coach's brands first. */
export function CoachGearCard({ brandNames }: { brandNames: string[] }) {
  const { data: products = [] } = useGearProducts();
  const picks = pickCoachGear(products, brandNames);

  if (!isShopifyConfigured || picks.length === 0) return null;

  return (
    <CoachProfileCard>
      <CoachProfileCardHeader
        title="Gear"
        actions={
          <Link
            to={ROUTES.GEAR}
            className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#0054B4] hover:underline"
          >
            Shop all
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-[10px] md:grid-cols-4">
        {picks.map((product) => (
          <GearProductCard key={product.id} product={product} />
        ))}
      </div>
    </CoachProfileCard>
  );
}
