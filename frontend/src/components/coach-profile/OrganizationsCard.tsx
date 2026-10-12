import type { ReactNode } from "react";
import type { Brand } from "@/utils/brands";
import { CoachProfileCard } from "./CoachProfileCard";
import { BrandLogos } from "./BrandLogos";
import { caption, cardGap } from "./family/styles";

/** Near-top logo strip on coach profiles (old Brands card → Organizations). */
export function OrganizationsCard({
  brands,
  manage,
}: {
  brands: Pick<Brand, "id" | "name" | "logo_url">[];
  /** Own profile edit: Manage control. */
  manage?: ReactNode;
}) {
  if (!brands.length && !manage) return null;

  return (
    <CoachProfileCard className={cardGap} aria-label="Organizations">
      <div className="flex min-h-[30px] items-center justify-between gap-3">
        <span className={caption}>Organizations</span>
        {manage}
      </div>
      <BrandLogos brands={brands} />
    </CoachProfileCard>
  );
}
