/**
 * Organization page (ATH-90, Working Copy): name, logo, one line, a short description, which
 * coaches show and in what order, and academy packages. Only the owner can edit; families see
 * the page once saved. Coach prices come from each coach's profile and group sessions from the
 * schedule, so packages are the only prices set here.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ImageIcon, Plus } from "@/components/icons";
import { orgPackagesAPI, organizationsAPI, type OrgPackage } from "@/api/organizations";
import { OrgPackageDialog, type PackageCoach } from "@/components/organization/OrgPackages";
import { card, input, label, meta, primaryButton, secondaryButton, smallButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ABOUT_MAX, initials, packageSaving, type MyOrganization, type OrgPricing } from "@/utils/organizations";

type Draft = {
  name: string;
  line: string;
  about: string;
  logoUrl: string | null;
  coaches: { coachId: string; shown: boolean }[];
  pricing: OrgPricing[];
};

const fromOrg = (org: MyOrganization): Draft => ({
  name: org.name,
  line: org.line,
  about: org.about,
  logoUrl: org.logoUrl,
  coaches: org.coaches.map((c) => ({ coachId: c.coachId, shown: c.shown })),
  pricing: org.pricing.map((p) => ({ ...p })),
});

const move = <T,>(list: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

const OrderButtons = ({ i, n, onMove, what }: { i: number; n: number; onMove: (d: number) => void; what: string }) => (
  <span className="flex shrink-0 flex-col">
    <button type="button" className="inline-flex size-5 items-center justify-center text-dark-300 hover:text-dark disabled:text-dark-200" aria-label={`Move ${what} up`} disabled={i === 0} onClick={() => onMove(-1)}>
      <ChevronUp className="size-4" strokeWidth={1.5} />
    </button>
    <button type="button" className="inline-flex size-5 items-center justify-center text-dark-300 hover:text-dark disabled:text-dark-200" aria-label={`Move ${what} down`} disabled={i === n - 1} onClick={() => onMove(1)}>
      <ChevronDown className="size-4" strokeWidth={1.5} />
    </button>
  </span>
);

/** Org logo (Working Copy `.og-logo`): 64px, 12px radius, ink with light initials. */
export const OrgLogo = ({ name, url, size = 64 }: { name: string; url: string | null; size?: number }) =>
  url ? (
    <img src={url} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-card border border-light-525 bg-light-200 object-contain" />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size / 3.2) }}
      className="flex shrink-0 items-center justify-center rounded-card bg-dark font-medium tracking-[-0.05em] text-light"
    >
      {initials(name)}
    </span>
  );

const h3 = "text-card-title";
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Prototype switch: 36x20 track, 16px knob. */
const MiniSwitch = ({ on, onChange, label: aria }: { on: boolean; onChange: (on: boolean) => void; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={aria}
    onClick={() => onChange(!on)}
    className={cn("flex h-5 w-9 flex-none items-center rounded-full p-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", on ? "justify-end bg-primary" : "justify-start bg-light-550")}
  >
    <span className="size-4 rounded-full bg-light-50" />
  </button>
);

export const OrgPageEditor = ({ org }: { org: MyOrganization }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const saved = useMemo(() => fromOrg(org), [org]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(saved), [saved]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const coachName = (id: string) => org.coaches.find((c) => c.coachId === id)?.name ?? "Coach";
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const packagesQuery = useQuery({ queryKey: ["org-packages"], queryFn: () => orgPackagesAPI.mine() });
  const extras = useQuery({ queryKey: ["org-page-extras", org.slug], queryFn: () => orgPackagesAPI.pageExtras(org.slug) });
  const [editing, setEditing] = useState<OrgPackage | "new" | null>(null);
  const packageCoaches: PackageCoach[] = useMemo(
    () => org.coaches.map((c) => ({ id: c.coachId, name: c.name, price: extras.data?.coachPrices[c.coachId] ?? c.hourlyRate ?? 0, photo: c.photo })),
    [org.coaches, extras.data]
  );
  const groupPrices = useMemo(() => {
    const out: Record<string, number[]> = {};
    for (const g of extras.data?.groups ?? []) (out[g.coachId] ??= []).push(g.price);
    return out;
  }, [extras.data]);

  const save = useMutation({
    mutationFn: () =>
      organizationsAPI.savePage({
        ...draft,
        // Free-text pricing isn't edited here any more; whatever was saved stays as it was.
        pricing: draft.pricing.filter((p: OrgPricing) => p.name.trim()),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-organization"] });
      qc.invalidateQueries({ queryKey: ["organizations-public"] });
      toast({ title: "Org page saved. Families see it now" });
    },
    onError: (e: Error) => toast({ title: "Couldn't save the org page", description: e.message, variant: "destructive" }),
  });

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      toast({ title: "Pick an image under 5 MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      set({ logoUrl: await organizationsAPI.uploadLogo(file) });
    } catch (e) {
      toast({ title: "Couldn't upload the logo", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const shown = draft.coaches.filter((c) => c.shown).length;

  const packages = packagesQuery.data ?? [];

  return (
    <div className="flex w-full flex-col gap-4 md:gap-6">
      <section className={cn(card, "gap-4")}>
        <h2 className={h3}>Basics</h2>
        <div className="flex flex-wrap items-center gap-4">
          <OrgLogo name={draft.name || org.name} url={draft.logoUrl} />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
          <button type="button" className={cn(secondaryButton, smallButton)} disabled={uploading} onClick={() => fileRef.current?.click()}>
            <ImageIcon strokeWidth={1.5} aria-hidden="true" />
            {uploading ? "Uploading…" : "Change logo"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Name</span>
            <input className={input} maxLength={100} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>One line under the name</span>
            <input className={input} maxLength={120} value={draft.line} onChange={(e) => set({ line: e.target.value })} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Short description</span>
          <textarea
            className={cn(input, "h-auto resize-none py-2.5")}
            rows={3}
            maxLength={ABOUT_MAX}
            placeholder="Two or three sentences families see under your name"
            value={draft.about}
            onChange={(e) => set({ about: e.target.value })}
          />
          <span className={meta}>
            {draft.about.length} of {ABOUT_MAX}
          </span>
        </label>
      </section>

      <section className={cn(card, "gap-4")}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={h3}>Coaches on the page</h2>
          <span className={meta}>{shown} shown</span>
        </div>
        <div className="flex flex-col">
          {draft.coaches.map((c, i) => {
            const coach = org.coaches.find((x) => x.coachId === c.coachId);
            return (
              <div key={c.coachId} className="flex items-center gap-3 border-t border-light-525 py-[14px] first:border-t-0">
                <OrderButtons i={i} n={draft.coaches.length} what={coachName(c.coachId)} onMove={(d) => set({ coaches: move(draft.coaches, i, d) })} />
                <span className="flex size-7 flex-none items-center justify-center overflow-hidden rounded-full bg-light text-label-xsm text-dark-400">
                  {coach?.photo ? <img src={coach.photo} alt="" className="size-full object-cover" /> : initials(coachName(c.coachId))}
                </span>
                <span className="min-w-0 flex-1 truncate text-label-sm">{coachName(c.coachId)}</span>
                <MiniSwitch
                  on={c.shown}
                  label={`Show ${coachName(c.coachId)} on the page`}
                  onChange={(on) => set({ coaches: draft.coaches.map((x, j) => (j === i ? { ...x, shown: on } : x)) })}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className={cn(card, "gap-4")}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={h3}>Academy packages</h2>
          <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setEditing("new")}>
            <Plus strokeWidth={1.5} aria-hidden="true" />
            New package
          </button>
        </div>
        <p className={cn(meta, "-mt-1.5")}>
          Coach prices on this page come from each coach's own profile, and group sessions come from the schedule. Packages are the only prices you set here.
        </p>
        <div className="flex flex-col">
          {packages.length ? (
            packages.map((p) => {
              const k = packageSaving(p, packageCoaches, []);
              return (
                <div key={p.id} className="flex items-center gap-3 border-t border-light-525 py-[14px] first:border-t-0">
                  <div className="flex min-w-0 grow flex-col gap-1">
                    <span className="text-label-sm">{p.name}</span>
                    <span className="text-caption text-dark-300">
                      {p.sessionCount} {p.kind === "group" ? "group sessions" : "sessions"} · {dollars(k.per)} each ·{" "}
                      {p.renewsMonthly ? "renews monthly" : `valid ${p.validityDays} days`} ·{" "}
                      {p.kind === "group" ? "any academy coach" : packageCoaches.filter((c) => p.coachIds.includes(c.id)).map((c) => c.name.split(" ")[0]).join(", ")}
                    </span>
                  </div>
                  <b className="text-label-sm">{dollars(p.price)}</b>
                  <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setEditing(p)}>
                    Edit
                  </button>
                </div>
              );
            })
          ) : (
            <p className="text-body-m text-dark-300">{packagesQuery.isLoading ? "Loading…" : "No academy packages yet."}</p>
          )}
        </div>
      </section>

      <div className="sticky bottom-16 z-10 flex items-center justify-end gap-2 bg-light py-3 md:bottom-0">
        <span className={cn(meta, "mr-auto")}>Only you can edit this page</span>
        <button type="button" className={secondaryButton} disabled={!dirty || save.isPending} onClick={() => setDraft(saved)}>
          Cancel
        </button>
        <button
          type="button"
          className={primaryButton}
          disabled={!dirty || save.isPending || uploading}
          onClick={() => (draft.name.trim() ? save.mutate() : toast({ title: "Add a name for the organization", variant: "destructive" }))}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <OrgPackageDialog
        open={editing !== null}
        pkg={editing === "new" ? null : editing}
        coaches={packageCoaches}
        groupPrices={groupPrices}
        onClose={() => setEditing(null)}
      />
    </div>
  );
};
