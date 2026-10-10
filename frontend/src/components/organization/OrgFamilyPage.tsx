/**
 * What families see for an organization an owner set up (ATH-90): name, logo, one line, the
 * short description, the coaches the owner shows (View) and pricing options (Book).
 */
import { Link } from "react-router-dom";
import { OrgLogo } from "@/components/organization/OrgPageEditor";
import { card, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import type { PublicOrganization } from "@/api/organizations";
import { cn } from "@/lib/utils";
import { ageRangeLabel } from "@/utils/coachAges";
import { coachProfilePath } from "@/utils/coachSlug";
import { initials, money } from "@/utils/organizations";
import { plural } from "@/utils/schedule";

export type OrgPageCoach = {
  id: string;
  name: string;
  slug?: string | null;
  coach_position?: string | null;
  positions?: string[] | null;
  session_types?: string[] | null;
  hourly_rate?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  profile_image_url?: string | null;
  image_url?: string | null;
};

const sessionLabel = (types: string[] | null | undefined) =>
  types?.some((t) => /video|online|virtual/i.test(t)) && !types.some((t) => /person/i.test(t)) ? "Video call" : "In person";

export const OrgFamilyPage = ({
  org,
  coaches,
  bookTo,
}: {
  org: PublicOrganization;
  /** Coaches shown on the page, in the owner's order. */
  coaches: OrgPageCoach[];
  bookTo: string;
}) => (
  <div className="flex flex-col gap-6">
    <header className="flex items-center gap-5">
      <OrgLogo name={org.name} url={org.logoUrl} size={72} />
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-[26px] md:text-[32px] font-bold leading-[26px] md:leading-[34px] tracking-[-0.05em] text-[#1A202C] [text-wrap:balance]">{org.name}</h1>
        {org.line ? <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">{org.line}</p> : null}
      </div>
    </header>
    {org.about ? <p className="max-w-[62ch] text-[16px] leading-[24px] tracking-[-0.03em] text-[#484D56]">{org.about}</p> : null}

    <section className={card}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em]">Coaches</h2>
        <span className={meta}>{plural(coaches.length, "coach", "coaches")}</span>
      </div>
      {coaches.length ? (
        <div className="flex flex-col">
          {coaches.map((coach) => {
            const photo = coach.profile_image_url || coach.image_url;
            const ages = ageRangeLabel({ age_min: coach.age_min ?? null, age_max: coach.age_max ?? null });
            const role = coach.coach_position || coach.positions?.[0] || "Coach";
            return (
              <div key={coach.id} className="flex items-center gap-3 border-b border-[#EAEADF] py-3 last:border-0">
                {photo ? (
                  <img src={photo} alt="" className="size-10 shrink-0 rounded-full bg-[#C1C1B8] object-cover" />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#CCDDF0] text-[14px] font-semibold text-[#00326C]">
                    {initials(coach.name || "Coach")}
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[16px] font-medium leading-[18px] tracking-[-0.05em]">{coach.name}</span>
                  <span className={cn(meta, "truncate")}>
                    {[role, ages ? `Ages ${ages}` : "", sessionLabel(coach.session_types)].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {coach.hourly_rate ? (
                  <span className={cn(meta, "hidden sm:inline")}>
                    from <b className="font-medium text-[#1A202C]">{money(Number(coach.hourly_rate))}</b>
                  </span>
                ) : null}
                <Link to={coachProfilePath(coach.slug || coach.id)} className={secondaryButton}>View</Link>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[14px] text-[#767980]">No coaches listed yet.</p>
      )}
    </section>

    <section className={card}>
      <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em]">Pricing</h2>
      {org.pricing.length ? (
        <div className="flex flex-col">
          {org.pricing.map((p, i) => (
            <div key={`${p.name}-${i}`} className="flex items-center gap-3 border-b border-[#EAEADF] py-3 last:border-0">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em]">{p.name}</span>
                {p.who ? <span className={meta}>{p.who}</span> : null}
              </div>
              <span className="flex flex-col items-end">
                <b className="text-[16px] font-semibold">{p.price}</b>
                {p.unit ? <span className={cn(meta, "hidden sm:inline")}>{p.unit}</span> : null}
              </span>
              <Link to={bookTo} className={primaryButton}>Book</Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-[#767980]">No pricing added yet.</p>
      )}
    </section>
  </div>
);
