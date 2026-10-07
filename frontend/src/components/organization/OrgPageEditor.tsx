/**
 * Org page tab (ATH-90): name, logo, one line, a short description, which coaches show and in
 * what order, and pricing options. Only the owner can edit; families see it once saved.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ImageIcon, Plus, X } from "lucide-react";
import { organizationsAPI } from "@/api/organizations";
import { Switch } from "@/components/ui/switch";
import { card, iconButton, input, label, meta, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ABOUT_MAX, initials, type MyOrganization, type OrgPricing } from "@/utils/organizations";

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
    <button type="button" className="inline-flex size-5 items-center justify-center text-[#767980] disabled:opacity-30" aria-label={`Move ${what} up`} disabled={i === 0} onClick={() => onMove(-1)}>
      <ChevronUp className="size-4" strokeWidth={1.5} />
    </button>
    <button type="button" className="inline-flex size-5 items-center justify-center text-[#767980] disabled:opacity-30" aria-label={`Move ${what} down`} disabled={i === n - 1} onClick={() => onMove(1)}>
      <ChevronDown className="size-4" strokeWidth={1.5} />
    </button>
  </span>
);

export const OrgLogo = ({ name, url, size = 56 }: { name: string; url: string | null; size?: number }) =>
  url ? (
    <img src={url} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-[10px] bg-[#F9F9F5] object-contain" />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size / 3) }}
      className="flex shrink-0 items-center justify-center rounded-[10px] bg-[#CCDDF0] font-bold tracking-[-0.03em] text-[#00326C]"
    >
      {initials(name)}
    </span>
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
  const setPrice = (i: number, patch: Partial<OrgPricing>) =>
    set({ pricing: draft.pricing.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const save = useMutation({
    mutationFn: () =>
      organizationsAPI.savePage({
        ...draft,
        pricing: draft.pricing.filter((p) => p.name.trim()),
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

  return (
    <div className="flex flex-col gap-5">
      <section className={card}>
        <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em]">Basics</h2>
        <div className="flex flex-wrap items-center gap-4">
          <OrgLogo name={draft.name || org.name} url={draft.logoUrl} />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
          <button type="button" className={secondaryButton} disabled={uploading} onClick={() => fileRef.current?.click()}>
            <ImageIcon strokeWidth={1.5} aria-hidden="true" />
            {uploading ? "Uploading…" : "Change logo"}
          </button>
          {draft.logoUrl ? (
            <button type="button" className={textButton} onClick={() => set({ logoUrl: null })}>Remove logo</button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Name</span>
            <input className={input} maxLength={100} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>One line under the name</span>
            <input className={input} maxLength={120} placeholder="City · what you're known for" value={draft.line} onChange={(e) => set({ line: e.target.value })} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Short description</span>
          <textarea
            className={cn(input, "h-auto py-2")}
            rows={3}
            maxLength={ABOUT_MAX}
            placeholder="Two or three sentences families see under your name"
            value={draft.about}
            onChange={(e) => set({ about: e.target.value })}
          />
          <span className={meta}>{draft.about.length} of {ABOUT_MAX}</span>
        </label>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em]">Coaches on the page</h2>
          <span className={meta}>{shown} shown</span>
        </div>
        <div className="flex flex-col">
          {draft.coaches.map((c, i) => (
            <div key={c.coachId} className="flex items-center gap-3 border-b border-[#EAEADF] py-2.5 last:border-0">
              <OrderButtons i={i} n={draft.coaches.length} what={coachName(c.coachId)} onMove={(d) => set({ coaches: move(draft.coaches, i, d) })} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{coachName(c.coachId)}</span>
              <Switch
                checked={c.shown}
                aria-label={`Show ${coachName(c.coachId)} on the page`}
                onCheckedChange={(on) => set({ coaches: draft.coaches.map((x, j) => (j === i ? { ...x, shown: on } : x)) })}
              />
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em]">Pricing</h2>
          <button
            type="button"
            className={textButton}
            disabled={draft.pricing.length >= 12}
            onClick={() => set({ pricing: [...draft.pricing, { name: "", who: "", price: "", unit: "" }] })}
          >
            <Plus strokeWidth={1.5} aria-hidden="true" />
            Add option
          </button>
        </div>
        {draft.pricing.length ? (
          <div className="flex flex-col">
            {draft.pricing.map((p, i) => (
              <div key={i} className="flex items-start gap-2 border-b border-[#EAEADF] py-2.5 last:border-0">
                <OrderButtons i={i} n={draft.pricing.length} what="option" onMove={(d) => set({ pricing: move(draft.pricing, i, d) })} />
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 md:grid-cols-[1fr_1.4fr_0.6fr_0.7fr]">
                  <input className={input} aria-label="Option name" placeholder="Name" maxLength={80} value={p.name} onChange={(e) => setPrice(i, { name: e.target.value })} />
                  <input className={input} aria-label="Who it's for" placeholder="Who it's for" maxLength={120} value={p.who} onChange={(e) => setPrice(i, { who: e.target.value })} />
                  <input className={input} aria-label="Price" placeholder="$0" maxLength={40} value={p.price} onChange={(e) => setPrice(i, { price: e.target.value })} />
                  <input className={input} aria-label="Price note" placeholder="per session" maxLength={40} value={p.unit} onChange={(e) => setPrice(i, { unit: e.target.value })} />
                </div>
                <button type="button" className={iconButton} aria-label="Remove option" onClick={() => set({ pricing: draft.pricing.filter((_, j) => j !== i) })}>
                  <X strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className={meta}>No pricing yet.</p>
        )}
      </section>

      <div className="sticky bottom-[72px] z-10 flex flex-wrap items-center justify-end gap-2 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0]/95 px-4 py-3 backdrop-blur md:bottom-4">
        <span className={cn(meta, "mr-auto")}>Only you can edit this page</span>
        <button type="button" className={secondaryButton} disabled={!dirty || save.isPending} onClick={() => setDraft(saved)}>Cancel</button>
        <button
          type="button"
          className={primaryButton}
          disabled={!dirty || save.isPending || uploading}
          onClick={() => (draft.name.trim() ? save.mutate() : toast({ title: "Add a name for the organization", variant: "destructive" }))}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
};
