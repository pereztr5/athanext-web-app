/**
 * Coach Edit sheet for a published week post (WC4 `pk-edit`): when, where, spots, price,
 * add, cancel, close picks. Update posts lines into the same chat card, not a second card.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Minus, Plus } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  groupOffersAPI,
  type GroupOffer,
  type GroupOfferAdd,
  type GroupOfferSession,
  type GroupOfferSessionPatch,
} from "@/api/schedule";
import { sheetBody, sheetContent, sheetFooter, sheetHeader, sheetTitle } from "@/components/book/checkoutParts";
import { loadSavedUsual } from "@/components/schedule/plan/usualSessions";
import { dangerTextButton, iconButton, input, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ALL_START_MINUTES, addDaysISO, formatDayISO, formatMinutes, plural, weekStartISO } from "@/utils/schedule";
import { DateTile, money, sessionWhere, titleClass } from "./parts";

type Det = { date: string; start: string; where: string; capacity: number; price: number };
type View = "list" | "ses" | "add";

const hm = (t: string) => t.slice(0, 5);
const parseHm = (t: string) => {
  const [h, m] = hm(t).split(":").map(Number);
  return h * 60 + m;
};
const toHm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
const toStart = (mins: number) => `${toHm(mins)}:00`;

const eff = (s: GroupOfferSession, det: Record<string, Det>): GroupOfferSession & { where: string } => {
  const d = det[s.id];
  if (!d) return { ...s, where: sessionWhere(s) };
  const online = d.where === "Video call";
  return {
    ...s,
    date: d.date,
    startTime: d.start.length === 5 ? `${d.start}:00` : d.start,
    location: online ? "online" : "in-person",
    place: online ? null : d.where,
    capacity: d.capacity,
    price: d.price,
    where: d.where,
  };
};

export const OfferEditSheet = ({
  open,
  onOpenChange,
  offer,
  coachId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: GroupOffer;
  coachId: string;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const live = useMemo(() => offer.sessions.filter((s) => !s.cancelled && !s.started), [offer.sessions]);
  const [view, setView] = useState<View>("list");
  const [det, setDet] = useState<Record<string, Det>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<GroupOfferAdd[]>([]);
  const [closed, setClosed] = useState(offer.closed);
  const [cur, setCur] = useState<string | null>(null);
  const [form, setForm] = useState<Det | null>(null);
  const usual = useMemo(() => (open ? loadSavedUsual(coachId).filter((u) => !u.isOneOnOne) : []), [open, coachId]);

  useEffect(() => {
    if (!open) return;
    setView("list");
    setDet({});
    setRemoved([]);
    setAdded([]);
    setClosed(offer.closed);
    setCur(null);
    setForm(null);
  }, [open, offer.id, offer.closed]);

  const places = useMemo(() => {
    const list = [...offer.locations.filter((l) => l && l !== "Video call"), "Video call"];
    live.forEach((s) => {
      const w = sessionWhere(s);
      if (w && !list.includes(w)) list.unshift(w);
    });
    return list.filter((x, i, a) => a.indexOf(x) === i);
  }, [offer.locations, live]);

  const weekDays = useMemo(() => {
    const first = live[0]?.date ?? offer.sessions[0]?.date;
    if (!first) return [] as string[];
    const mon = weekStartISO(first);
    return Array.from({ length: 7 }, (_, i) => addDaysISO(mon, i));
  }, [live, offer.sessions]);

  const openSes = (key: string) => {
    setCur(key);
    if (key.startsWith("new")) {
      const a = added[+key.slice(3)];
      setForm({ date: a.date, start: hm(a.start), where: a.where, capacity: a.capacity, price: a.price });
    } else {
      const s = live.find((x) => x.id === key)!;
      const e = eff(s, det);
      setForm({ date: e.date, start: hm(e.startTime), where: e.where, capacity: e.capacity, price: e.price });
    }
    setView("ses");
  };

  const saveSes = () => {
    if (!cur || !form) return;
    if (cur.startsWith("new")) {
      const i = +cur.slice(3);
      setAdded((list) =>
        list.map((a, idx) =>
          idx === i ? { ...a, date: form.date, start: toStart(parseHm(form.start)), where: form.where, capacity: form.capacity, price: form.price } : a
        )
      );
    } else {
      const s = live.find((x) => x.id === cur)!;
      const same =
        form.date === s.date &&
        hm(form.start) === hm(s.startTime) &&
        form.where === sessionWhere(s) &&
        form.capacity === s.capacity &&
        form.price === s.price;
      setDet((d) => {
        const next = { ...d };
        if (same) delete next[cur];
        else next[cur] = { ...form, start: toStart(parseHm(form.start)) };
        return next;
      });
    }
    setView("list");
  };

  const editedN = Object.keys(det).filter((k) => !removed.includes(k)).length;
  const parts = [
    editedN ? `${editedN} edited` : "",
    removed.length ? `${removed.length} cancelled` : "",
    added.length ? `${added.length} added` : "",
    closed && !offer.closed ? "picks closed" : "",
  ].filter(Boolean);

  const update = useMutation({
    mutationFn: () => {
      const updates: GroupOfferSessionPatch[] = Object.entries(det)
        .filter(([id]) => !removed.includes(id))
        .map(([id, d]) => ({ id, date: d.date, start: hm(d.start), where: d.where, capacity: d.capacity, price: d.price }));
      return groupOffersAPI.update(offer.id, {
        closePicks: closed && !offer.closed,
        updates,
        cancelIds: removed,
        adds: added,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["group-offer", offer.id] });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      onOpenChange(false);
      toast({ title: "Post updated", description: result.lines.length ? plural(result.lines.length, "change") : undefined });
    },
    onError: (err: unknown) =>
      toast({
        title: "Couldn't update the post",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      }),
  });

  const rangeLabel = () => {
    if (!/^Week of/i.test(offer.title || "") || !weekDays[0] || !weekDays[6]) return offer.title;
    return `${formatDayISO(weekDays[0], { month: "short", day: "numeric" })} to ${formatDayISO(weekDays[6], { month: "short", day: "numeric" })}`;
  };

  const sesNote = () => {
    if (!cur || !form || cur.startsWith("new")) return "";
    const s = live.find((x) => x.id === cur);
    if (!s) return "";
    const bk = s.bookedCount;
    if (removed.includes(cur)) {
      return bk
        ? `Cancelled when you update. ${plural(bk, "family is", "families are")} refunded as a session credit.`
        : "Removed when you update.";
    }
    const timeCh = form.date !== s.date || hm(form.start) !== hm(s.startTime);
    const locCh = form.where !== sessionWhere(s);
    const priceCh = form.price !== s.price;
    let note = "";
    if (bk && (timeCh || locCh)) {
      const w = [form.date !== s.date ? "day" : "", hm(form.start) !== hm(s.startTime) ? "time" : "", locCh ? "place" : ""].filter(Boolean);
      const what = w.length > 1 ? `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}` : w[0];
      note = `${plural(bk, "booked family is", "booked families are")} asked to confirm the new ${what}, or cancel for a session credit.`;
    }
    if (bk && priceCh) note += `${note ? " " : ""}New picks pay ${money(form.price)}. The ${bk} already booked keep what they paid.`;
    if (!bk && (timeCh || locCh || priceCh)) note = "Nobody has booked yet, so this just updates.";
    return note;
  };

  const rows = [
    ...live.map((s) => ({ key: s.id, s, isNew: false })),
    ...added.map((a, i) => ({
      key: `new${i}`,
      isNew: true,
      s: {
        id: `new${i}`,
        date: a.date,
        startTime: a.start,
        endTime: a.start,
        durationMinutes: a.durationMinutes,
        sessionName: a.title,
        price: a.price,
        priceFrom: null,
        capacity: a.capacity,
        location: a.where === "Video call" ? ("online" as const) : ("in-person" as const),
        place: a.where === "Video call" ? null : a.where,
        bookedCount: 0,
        pendingConfirmCount: 0,
        myStatus: null,
        myBookingId: null,
        myPaidAmount: null,
        myChangeAsk: null,
        changeFrom: null,
        cancelled: false,
        cancelRefund: null,
        isNew: true,
        started: false,
      } satisfies GroupOfferSession,
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={sheetContent}>
        {view === "list" ? (
          <>
            <DialogHeader className={sheetHeader}>
              <DialogTitle className={sheetTitle}>Edit this week&apos;s post</DialogTitle>
              <DialogDescription className={meta}>{rangeLabel()} · group chats and your link</DialogDescription>
            </DialogHeader>
            <div className={sheetBody}>
              <div className="flex flex-col">
                {rows.map(({ key, s, isNew }) => {
                  const x = removed.includes(key);
                  const e = isNew ? { ...s, where: sessionWhere(s) } : eff(s, det);
                  const ch = !isNew && det[key];
                  const bk = s.bookedCount;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={cn("flex w-full items-center gap-3 rounded-control px-1.5 py-2.5 text-left hover:bg-light-200", x && "opacity-75")}
                      onClick={() => openSes(key)}
                    >
                      <DateTile day={e.date} />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <b className={cn(titleClass, x && "line-through")}>{e.sessionName}</b>
                          {bk ? <BrandPill tone="teal">{bk} booked</BrandPill> : null}
                          {isNew ? <BrandPill tone="blue">New</BrandPill> : null}
                          {ch && !x ? <BrandPill tone="amber">Edited</BrandPill> : null}
                          {x ? <BrandPill tone="red">{bk ? "Will be cancelled" : "Will be removed"}</BrandPill> : null}
                        </span>
                        <span className={cn(meta, x && bk && "text-error-700")}>
                          {x
                            ? bk
                              ? `${plural(bk, "family", "families")} get a session credit when you update`
                              : "Removed when you update"
                            : `${formatMinutes(parseHm(e.startTime))} · ${e.where} · ${money(e.price)} · ${plural(e.capacity, "spot")}`}
                        </span>
                      </span>
                      <ChevronRight className="size-4 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-light-600 text-label-sm text-primary hover:bg-light-400"
                onClick={() => setView("add")}
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Add a session
              </button>
              <label className="flex cursor-pointer items-center gap-2.5 text-body-m">
                <input type="checkbox" className="size-4 accent-primary" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
                <span>Close picks now. Booked sessions stay booked.</span>
              </label>
              <div className="rounded-control border border-light-525 bg-light-400 px-3.5 py-3 text-body-m text-dark-300">{parts.length ? parts.join(" · ") : "No changes yet"}</div>
            </div>
            <div className={cn(sheetFooter, "justify-between")}>
              <button type="button" className={cn(secondaryButton, "h-10")} onClick={() => onOpenChange(false)}>
                Discard changes
              </button>
              <button type="button" className={cn(primaryButton, "h-10")} disabled={!parts.length || update.isPending} onClick={() => update.mutate()}>
                {update.isPending ? "Updating…" : "Update the post"}
              </button>
            </div>
          </>
        ) : null}

        {view === "add" ? (
          <>
            <DialogHeader className={sheetHeader}>
              <button type="button" className="mb-1 text-left text-label-sm text-primary" onClick={() => setView("list")}>
                Back
              </button>
              <DialogTitle className={sheetTitle}>Add a session</DialogTitle>
              <DialogDescription className="sr-only">Pick a usual session to add to this week.</DialogDescription>
            </DialogHeader>
            <div className={sheetBody}>
              {usual.length ? (
                usual.map((u, i) => (
                  <button
                    key={`${u.title}-${i}`}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-card border border-light-525 bg-light-300 px-3.5 py-3 text-left hover:bg-light-200"
                    onClick={() => {
                      const day = weekDays[0] ?? live[0]?.date;
                      if (!day) return;
                      const start = toStart(u.startMinutes);
                      const row: GroupOfferAdd = {
                        title: u.title,
                        date: day,
                        start,
                        durationMinutes: u.durationMinutes,
                        where: u.place,
                        capacity: Math.max(2, u.capacity),
                        price: u.price,
                        pillar: u.pillar,
                      };
                      const idx = added.length;
                      setAdded((list) => [...list, row]);
                      setCur(`new${idx}`);
                      setForm({ date: day, start: hm(start), where: u.place, capacity: row.capacity, price: u.price });
                      setView("ses");
                    }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                      <span className={titleClass}>{u.title}</span>
                      <span className={meta}>
                        {formatMinutes(u.startMinutes)} · {u.place}
                      </span>
                    </span>
                    <span className="flex flex-none flex-col items-end gap-0.5">
                      <span className="text-label-sm">{money(u.price)}</span>
                      <span className={meta}>{plural(u.capacity, "spot")}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className={meta}>No usual sessions yet. Add them from Plan next week.</p>
              )}
            </div>
          </>
        ) : null}

        {view === "ses" && form && cur ? (
          <>
            <DialogHeader className={sheetHeader}>
              <button type="button" className="mb-1 text-left text-label-sm text-primary" onClick={() => setView("list")}>
                Back
              </button>
              <DialogTitle className={sheetTitle}>
                {cur.startsWith("new") ? added[+cur.slice(3)]?.title ?? "New session" : live.find((s) => s.id === cur)?.sessionName ?? "Session"}
              </DialogTitle>
              <DialogDescription className={meta}>
                {cur.startsWith("new") ? "New session" : (live.find((s) => s.id === cur)?.bookedCount ?? 0) ? `${live.find((s) => s.id === cur)!.bookedCount} booked` : "Nobody booked yet"}
              </DialogDescription>
            </DialogHeader>
            <div className={sheetBody}>
              {removed.includes(cur) ? (
                <p className="text-body-m text-error-700">{sesNote()}</p>
              ) : (
                <>
                  <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3 gap-y-3.5">
                    <span className={meta}>When</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select className={cn(input, "w-auto min-w-0")} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Day">
                        {weekDays.map((d) => (
                          <option key={d} value={d}>
                            {formatDayISO(d, { weekday: "short", month: "short", day: "numeric" })}
                          </option>
                        ))}
                      </select>
                      <select className={cn(input, "w-auto min-w-0")} value={hm(form.start)} onChange={(e) => setForm({ ...form, start: e.target.value })} aria-label="Start">
                        {ALL_START_MINUTES.map((m) => (
                          <option key={m} value={toHm(m)}>
                            {formatMinutes(m)}
                          </option>
                        ))}
                      </select>
                      <span className={meta}>
                        {cur.startsWith("new") ? added[+cur.slice(3)]?.durationMinutes ?? 60 : live.find((s) => s.id === cur)?.durationMinutes ?? 60} min
                      </span>
                    </div>
                    <span className={meta}>Where</span>
                    <select className={cn(input, "w-auto min-w-0")} value={form.where} onChange={(e) => setForm({ ...form, where: e.target.value })} aria-label="Where">
                      {places.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <span className={meta}>Spots</span>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        className={iconButton}
                        disabled={form.capacity <= Math.max(2, cur.startsWith("new") ? 0 : live.find((s) => s.id === cur)?.bookedCount ?? 0)}
                        onClick={() => setForm({ ...form, capacity: form.capacity - 1 })}
                        aria-label="Fewer spots"
                      >
                        <Minus className="size-4" strokeWidth={1.5} />
                      </button>
                      <b className="min-w-[24px] text-center text-subtitle tabular-nums">{form.capacity}</b>
                      <button
                        type="button"
                        className={iconButton}
                        onClick={() => setForm({ ...form, capacity: form.capacity + 1 })}
                        aria-label="More spots"
                      >
                        <Plus className="size-4" strokeWidth={1.5} />
                      </button>
                    </div>
                    <span className={meta}>Price</span>
                    <span className="relative max-w-[130px]">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body-m text-dark-300">$</span>
                      <input
                        className={cn(input, "pl-7")}
                        inputMode="numeric"
                        value={String(form.price)}
                        onChange={(e) => setForm({ ...form, price: Math.max(0, Number(e.target.value.replace(/[^\d.]/g, "")) || 0) })}
                        aria-label="Price"
                      />
                    </span>
                  </div>
                  {sesNote() ? <p className="text-body-m text-dark-300">{sesNote()}</p> : null}
                </>
              )}
            </div>
            <div className={cn(sheetFooter, "justify-between")}>
              <button
                type="button"
                className={dangerTextButton}
                onClick={() => {
                  if (cur.startsWith("new")) {
                    setAdded((list) => list.filter((_, i) => i !== +cur.slice(3)));
                    setView("list");
                    return;
                  }
                  setRemoved((list) => (list.includes(cur) ? list.filter((id) => id !== cur) : [...list, cur]));
                  setView("list");
                }}
              >
                {removed.includes(cur)
                  ? "Keep this session"
                  : (cur.startsWith("new") ? 0 : live.find((s) => s.id === cur)?.bookedCount ?? 0)
                    ? "Cancel session"
                    : "Remove"}
              </button>
              {removed.includes(cur) ? null : (
                <button type="button" className={cn(primaryButton, "h-10")} onClick={saveSes}>
                  <Check className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  Save
                </button>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
