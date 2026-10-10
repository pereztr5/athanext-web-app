/**
 * What families see for an organization an owner set up (ATH-90, Working Copy): name, logo,
 * one line, the short description, the coaches the owner shows (1-on-1 prices from each
 * coach's profile, View), academy packages (Buy) and upcoming group sessions. The owner sees
 * the same page as a preview, where Buy only explains itself.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { OrgLogo } from "@/components/organization/OrgPageEditor";
import { OrgPackageCard, type PackageCoach } from "@/components/organization/OrgPackages";
import { card, pageTitle, secondaryButton, smallButton } from "@/components/schedule/styles";
import { orgPackagesAPI, type PublicOrganization } from "@/api/organizations";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useStartCoachChat } from "@/hooks/useStartCoachChat";
import { cn } from "@/lib/utils";
import { ageRangeLabel } from "@/utils/coachAges";
import { coachProfilePath } from "@/utils/coachSlug";
import { initials } from "@/utils/organizations";
import { formatMinutes } from "@/utils/schedule";

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
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const h3 = "text-[20px] font-medium leading-[18px] tracking-[-0.05em]";
const cap = "text-[12px] leading-[14px] text-[#767980]";
const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

export const OrgFamilyPage = ({
  org,
  coaches,
  preview = false,
}: {
  org: PublicOrganization;
  /** Coaches shown on the page, in the owner's order. */
  coaches: OrgPageCoach[];
  /** The owner looking at their own page. */
  preview?: boolean;
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const chat = useStartCoachChat();
  const [buying, setBuying] = useState<string | null>(null);
  const extras = useQuery({ queryKey: ["org-page-extras", org.slug], queryFn: () => orgPackagesAPI.pageExtras(org.slug) });
  const packages = extras.data?.packages ?? [];
  const groups = extras.data?.groups ?? [];
  const packageCoaches: PackageCoach[] = coaches.map((c) => ({
    id: c.id,
    name: c.name,
    price: extras.data?.coachPrices[c.id] ?? Number(c.hourly_rate ?? 0),
    photo: c.profile_image_url || c.image_url,
  }));

  const buy = async (id: string) => {
    if (preview) {
      toast({ title: "This is a preview. Families can buy it from the academy page" });
      return;
    }
    if (!user) {
      window.location.assign("/auth?mode=signin");
      return;
    }
    setBuying(id);
    try {
      window.location.assign(await orgPackagesAPI.buy(id));
    } catch (e) {
      toast({ title: "Couldn't open checkout", description: (e as Error).message, variant: "destructive" });
      setBuying(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <header className="flex items-center gap-4">
        <OrgLogo name={org.name} url={org.logoUrl} />
        <div className="flex min-w-0 grow flex-col gap-1.5">
          <h1 className={cn(pageTitle, "max-md:text-[24px]")}>{org.name}</h1>
          {org.line ? <p className="text-[14px] text-[#767980]">{org.line}</p> : null}
        </div>
        {!preview && extras.data?.ownerId ? (
          <button
            type="button"
            className={cn(secondaryButton, "hidden md:inline-flex")}
            disabled={chat.starting}
            onClick={() => void chat.start(extras.data!.ownerId!, org.name)}
          >
            <MessageCircle strokeWidth={1.5} aria-hidden="true" />
            Message
          </button>
        ) : null}
      </header>
      {org.about ? <p className="-mt-2 max-w-[64ch] text-[14px] leading-[1.45] text-[#484D56]">{org.about}</p> : null}

      <section className={cn(card, "gap-4")}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={h3}>Coaches</h2>
          <span className={cap}>1-on-1 prices from each coach's profile</span>
        </div>
        {coaches.length ? (
          <div className="flex flex-col">
            {coaches.map((coach) => {
              const photo = coach.profile_image_url || coach.image_url;
              const ages = ageRangeLabel({ age_min: coach.age_min ?? null, age_max: coach.age_max ?? null });
              const role = coach.coach_position || coach.positions?.[0] || "Coach";
              const price = extras.data?.coachPrices[coach.id] ?? Number(coach.hourly_rate ?? 0);
              return (
                <div key={coach.id} className="flex items-center gap-3 border-t border-[#EAEADF] py-[14px] first:border-t-0">
                  {photo ? (
                    <img src={photo} alt="" className="size-10 shrink-0 rounded-full bg-[#C1C1B8] object-cover" />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F1F1E6] text-[14px] font-medium text-[#484D56]">
                      {initials(coach.name || "Coach")}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[14px] font-medium">{coach.name}</span>
                    <span className={cap}>{[role, ages || "", sessionLabel(coach.session_types)].filter(Boolean).join(" · ")}</span>
                  </div>
                  {price ? (
                    <span className={cn(cap, "whitespace-nowrap")}>
                      1-on-1 from <b className="font-medium text-[#1A202C]">{dollars(price)}</b>
                    </span>
                  ) : null}
                  {preview ? (
                    <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => toast({ title: "Families open this coach's profile from here" })}>
                      View
                    </button>
                  ) : (
                    <Link to={coachProfilePath(coach.slug || coach.id)} className={cn(secondaryButton, smallButton)}>
                      View
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[14px] text-[#767980]">No coaches listed yet.</p>
        )}
      </section>

      {packages.length ? (
        <section className={cn(card, "gap-4")}>
          <h2 className={h3}>Academy packages</h2>
          <div className="flex flex-col gap-[10px]">
            {packages.map((p) => (
              <OrgPackageCard
                key={p.id}
                pkg={p}
                coaches={packageCoaches}
                groupPrices={groups.filter((g) => p.coachIds.includes(g.coachId)).map((g) => g.price)}
                buying={buying === p.id}
                onBuy={() => void buy(p.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {groups.length ? (
        <section className={cn(card, "gap-4")}>
          <h2 className={h3}>Upcoming group sessions</h2>
          <div className="flex flex-col">
            {groups.map((g) => {
              const left = g.capacity - g.booked;
              const day = new Date(`${g.date}T12:00:00`);
              return (
                <div key={g.id} className="flex items-center gap-3 border-t border-[#EAEADF] py-[14px] first:border-t-0">
                  <span className="grid size-11 flex-none place-content-center rounded-[8px] bg-[#F4F4EB] text-center">
                    <small className="text-[10px] font-medium uppercase leading-3 tracking-[0.05em]">{day.toLocaleDateString("en-US", { weekday: "short" })}</small>
                    <b className="text-[16px] font-bold leading-[18px] tracking-[-0.03em]">{day.getDate()}</b>
                  </span>
                  <div className="flex min-w-0 grow flex-col gap-1">
                    <span className="truncate text-[14px] font-medium">{g.title}</span>
                    <span className={cap}>
                      {formatMinutes(minutesOf(g.startTime))} · {g.coachName}
                    </span>
                  </div>
                  <span className="flex flex-col items-end gap-0.5">
                    <b className="text-[14px] font-medium">{dollars(g.price)}</b>
                    <span className={cn(cap, "whitespace-nowrap")}>{left <= 0 ? "Fully booked" : `${left} ${left === 1 ? "spot" : "spots"} left`}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
};
