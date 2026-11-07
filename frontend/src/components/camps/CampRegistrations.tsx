/**
 * Registrations for one camp (coach mockup "3 · Registrations"): spots per group, Paid so far /
 * Still to collect, who's in and how they paid, Mark as paid, Cancel, a detail sheet per athlete,
 * Add athlete for families who paid outside AthaNext, and the share link.
 * Opened from the camp row on My profile, the camp day sheet, or /profile?camp=<id>&view=registrations.
 */
import { errorMessage } from "@/utils/errorMessage";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Link as LinkIcon, Lock, Plus, Search } from "@/components/icons";
import { addClientReferrals } from "@/api/referrals";
import { campsAPI, type CampDisplayStatus, type CampRegistrationRow, type CampRegistrations as CampRegistrationsData } from "@/api/camps";
import { scheduleAPI } from "@/api/schedule";
import { BrandPill } from "@/components/brand";
import ConfirmationDialog from "@/components/common/ConfirmationDialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { closeButtonOverride, input, label, meta, modalSurface, primaryButton, secondaryButton, segButton, segGroup, smallButton, textButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ageGroupFor, campShareUrl, formatCampDates, formatCampMoney, formatCampTimes, plural } from "@/utils/camps";
import { invalidateCoachMoney } from "@/utils/coachMoney";
import { CampAvatar } from "./CampFamilyView";

const STATUS: Record<CampDisplayStatus, { text: string; tone: "green" | "neutral" | "amber" | "muted" }> = {
  paid_in_app: { text: "Paid in app", tone: "green" },
  paid_outside: { text: "Paid outside", tone: "neutral" },
  waiting: { text: "Waiting", tone: "amber" },
  paying: { text: "Paying now", tone: "muted" },
};

const PAID_WITH: Record<CampRegistrationRow["pay_method"], string> = {
  card: "Card in AthaNext",
  direct: "Paying you directly",
  outside: "Outside AthaNext",
};

const errorText = (err: unknown, fallback: string) => errorMessage(err, fallback);

const longDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

const fullName = (row: CampRegistrationRow) => `${row.athlete_first_name} ${row.athlete_last_name}`.trim();

export const CampRegistrations = ({
  open,
  campId,
  onOpenChange,
}: {
  open: boolean;
  campId: string;
  onOpenChange: (open: boolean) => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<CampRegistrationRow | null>(null);
  const [cancelling, setCancelling] = useState<CampRegistrationRow | null>(null);
  const [inviteFor, setInviteFor] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["camp-registrations", campId],
    enabled: open,
    retry: false,
    queryFn: () => campsAPI.registrations(campId),
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["camp-registrations", campId] }),
      queryClient.invalidateQueries({ queryKey: ["coach-camp-list"] }),
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] }),
      invalidateCoachMoney(queryClient),
    ]);
  const fail = (title: string) => (err: unknown) => toast({ title, description: errorText(err, "Try again."), variant: "destructive" });

  const markPaid = useMutation({
    mutationFn: (row: CampRegistrationRow) => campsAPI.markPaid(row.id),
    onSuccess: async (_d, row) => {
      await refresh();
      setDetail(null);
      toast({ title: `${row.athlete_first_name} marked as paid` });
    },
    onError: fail("That didn't save"),
  });
  const cancel = useMutation({
    mutationFn: (row: CampRegistrationRow) => campsAPI.cancel(row.id),
    onSuccess: async (_d, row) => {
      await refresh();
      setDetail(null);
      toast({ title: `${row.athlete_first_name} is off the camp`, description: "Their spot is open again." });
    },
    onError: fail("Couldn't cancel"),
  });
  const resendFinish = useMutation({
    mutationFn: (row: CampRegistrationRow) => campsAPI.resendFinishLink(row.id),
    onSuccess: async (res, row) => {
      await refresh();
      toast(
        res.emailed
          ? { title: "Link sent", description: `${row.parent_email} has a new link to finish the account.` }
          : res.reason === "joined"
            ? { title: "They already have an account" }
            : { title: "Not sent", description: "A link went out in the last 10 minutes. Try again later.", variant: "destructive" },
      );
    },
    onError: fail("Couldn't send the link"),
  });
  const resendInvite = useMutation({
    mutationFn: (referralId: string) => campsAPI.resendInvite(referralId),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Invite sent again" });
    },
    onError: fail("Couldn't resend the invite"),
  });

  const data = list.data;
  const camp = data?.camp;
  const share = camp?.published && camp.coach_slug && camp.slug ? campShareUrl(window.location.origin, camp.coach_slug, camp.slug) : null;
  const copyLink = () => {
    if (!share) return;
    void navigator.clipboard
      .writeText(share)
      .then(() =>
        toast({
          title: "Camp link copied",
          description: "No account needed to sign up. Families who sign up become your clients.",
        }),
      )
      .catch(() => toast({ title: "Couldn't copy", description: share }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          modalSurface,
          closeButtonOverride,
          "flex flex-col gap-0 overflow-hidden p-0",
          "max-md:!inset-0 max-md:!left-0 max-md:!top-0 max-md:!h-[100dvh] max-md:!max-h-none max-md:!w-full max-md:!max-w-none max-md:!translate-x-0 max-md:!translate-y-0 max-md:!rounded-none",
          "md:h-[min(900px,calc(100dvh-32px))] md:w-[calc(100vw-32px)] md:max-w-[880px]",
        )}
      >
        <div className="flex flex-col gap-1 border-b border-light-525 px-4 py-4 pr-14 md:px-[25px] md:py-5">
          <DialogTitle className="text-card-title text-dark md:text-section">Registrations</DialogTitle>
          <DialogDescription className="truncate text-body-m text-dark-300">
            {camp ? [camp.name, formatCampDates(camp.starts_on, camp.ends_on)].filter(Boolean).join(" · ") : "Loading…"}
          </DialogDescription>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6 pt-4 md:px-[25px] md:pt-5">
          {list.isLoading ? <p className={meta}>Loading…</p> : null}
          {list.isError ? (
            <p role="alert" className="text-body-m text-error-700">
              {errorText(list.error, "Could not load registrations.")}
            </p>
          ) : null}
          {data && camp ? (
            <>
              <Summary data={data} share={share} onCopy={copyLink} />
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-subtitle text-dark">Athletes</h3>
                  {!adding ? (
                    <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setAdding(true)}>
                      <Plus strokeWidth={1.5} aria-hidden="true" />
                      Add athlete
                    </button>
                  ) : null}
                </div>
                {adding ? <AddAthlete data={data} onClose={() => setAdding(false)} onAdded={refresh} /> : null}
                {data.rows.length === 0 ? (
                  <p className="rounded-control border border-dashed border-light-600 px-4 py-4 text-center text-body-m text-dark-300">
                    Nothing yet. Families show up here once they pay or hold a spot.
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {data.rows.map((row) => (
                      <RegistrationRow
                        key={row.id}
                        row={row}
                        busy={markPaid.isPending || resendFinish.isPending || resendInvite.isPending}
                        inviting={inviteFor === row.id}
                        onOpen={() => setDetail(row)}
                        onMarkPaid={() => markPaid.mutate(row)}
                        onResendFinish={() => resendFinish.mutate(row)}
                        onResendInvite={() => row.invite && resendInvite.mutate(row.invite.id)}
                        onInvite={() => setInviteFor(inviteFor === row.id ? null : row.id)}
                        onInvited={async () => {
                          setInviteFor(null);
                          await refresh();
                        }}
                      />
                    ))}
                  </ul>
                )}
                {data.legacy_purchases > 0 ? (
                  <p className={meta}>
                    {plural(data.legacy_purchases, "family", "families")} bought this camp from your profile before groups. They count toward the spots.
                  </p>
                ) : null}
              </section>
            </>
          ) : null}
        </div>
      </DialogContent>
      {detail ? (
        <RowDetail
          row={detail}
          onClose={() => setDetail(null)}
          busy={markPaid.isPending || cancel.isPending}
          onMarkPaid={() => markPaid.mutate(detail)}
          onCancel={() => setCancelling(detail)}
          onResendFinish={() => resendFinish.mutate(detail)}
        />
      ) : null}
      <ConfirmationDialog
        open={cancelling !== null}
        onOpenChange={(next) => {
          if (!next) setCancelling(null);
        }}
        title={cancelling ? `Take ${cancelling.athlete_first_name} off the camp?` : "Cancel this spot?"}
        description={
          cancelling?.display_status === "paid_in_app"
            ? "They paid by card. Refund them first, then cancel the spot."
            : "Their spot opens up for another family. Nothing is refunded in AthaNext."
        }
        confirmLabel="Cancel spot"
        onConfirm={() => {
          const row = cancelling;
          setCancelling(null);
          if (row) cancel.mutate(row);
        }}
      />
    </Dialog>
  );
};

const Summary = ({ data, share, onCopy }: { data: CampRegistrationsData; share: string | null; onCopy: () => void }) => {
  const booked = data.groups.reduce((n, g) => n + g.taken, 0) + data.legacy_purchases;
  const spots = data.groups.reduce((n, g) => n + g.spots, 0);
  const paidFamilies = data.rows.filter((r) => r.status === "paid").length;
  const waiting = data.rows.filter((r) => r.display_status === "waiting").length;
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-col gap-1.5 rounded-control bg-light-400 px-3 py-3 sm:px-4">
          <span className={label}>Spots booked</span>
          <b className="text-subtitle tabular-nums sm:text-card-title">
            {booked} of {spots}
          </b>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 rounded-control bg-light-400 px-3 py-3 sm:px-4">
          <span className={label}>Paid so far</span>
          <b className="text-subtitle tabular-nums sm:text-card-title">{formatCampMoney(data.paid_cents)}</b>
          <span className={meta}>
            {paidFamilies} of {plural(data.rows.length, "athlete")}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 rounded-control bg-light-400 px-3 py-3 sm:px-4">
          <span className={label}>Still to collect</span>
          <b className="text-subtitle tabular-nums sm:text-card-title">{data.to_collect_cents ? formatCampMoney(data.to_collect_cents) : "$0"}</b>
          <span className={meta}>{waiting ? `${waiting} waiting` : "Nothing waiting"}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {data.groups.map((g) => (
          <div key={g.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-label-sm text-dark">
                {g.name} <span className="font-normal text-dark-300">· {formatCampTimes(g.start_time, g.end_time)}</span>
              </span>
              <span className={cn(meta, "flex-none tabular-nums")}>
                {g.taken} of {g.spots}
                {g.taken >= g.spots ? " · Fully booked" : ""}
              </span>
            </div>
            <div className="h-[5px] overflow-hidden rounded-full bg-light-550" aria-hidden="true">
              <i className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((g.taken / Math.max(1, g.spots)) * 100))}%` }} />
            </div>
          </div>
        ))}
      </div>
      {share ? (
        <div className="flex flex-wrap items-center gap-3 rounded-control border border-light-525 bg-light-300 px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-body-m text-dark-300">{share.replace(/^https?:\/\//, "")}</span>
          <button type="button" className={cn(secondaryButton, smallButton)} onClick={onCopy}>
            <LinkIcon strokeWidth={1.5} aria-hidden="true" />
            Copy camp link
          </button>
        </div>
      ) : (
        <p className={meta}>Publish the camp to get its link.</p>
      )}
    </section>
  );
};

const AccountLine = ({
  row,
  busy,
  onResendFinish,
  onResendInvite,
  onInvite,
}: {
  row: CampRegistrationRow;
  busy: boolean;
  onResendFinish: () => void;
  onResendInvite: () => void;
  onInvite: () => void;
}) => {
  const link = "text-label-xsm text-primary hover:text-primary-600 disabled:text-dark-200";
  if (row.invite && row.invite.status !== "joined" && row.account !== "joined") {
    return (
      <span className={meta}>
        {row.invite.status === "opened" ? "Opened the invite, not joined yet" : "Invite sent, not joined yet"} ·{" "}
        <button type="button" className={link} disabled={busy} onClick={onResendInvite}>
          Resend
        </button>
      </span>
    );
  }
  if (row.account === "not_finished") {
    return (
      <span className={meta}>
        Account not finished ·{" "}
        <button type="button" className={link} disabled={busy} onClick={onResendFinish}>
          Resend link
        </button>
      </span>
    );
  }
  if (row.account === "no_email") {
    return (
      <span className={meta}>
        Not on AthaNext yet ·{" "}
        <button type="button" className={link} onClick={onInvite}>
          Invite family
        </button>
      </span>
    );
  }
  return null;
};

const RegistrationRow = ({
  row,
  busy,
  inviting,
  onOpen,
  onMarkPaid,
  onResendFinish,
  onResendInvite,
  onInvite,
  onInvited,
}: {
  row: CampRegistrationRow;
  busy: boolean;
  inviting: boolean;
  onOpen: () => void;
  onMarkPaid: () => void;
  onResendFinish: () => void;
  onResendInvite: () => void;
  onInvite: () => void;
  onInvited: () => void;
}) => {
  const status = STATUS[row.display_status];
  return (
    <li className="flex flex-col gap-2 border-t border-light-525 py-3 first:border-t-0">
      <div className="flex items-start gap-2.5">
        <button type="button" className="flex min-w-0 flex-1 items-start gap-2.5 text-left" onClick={onOpen} aria-label={`${fullName(row)}, details`}>
          <CampAvatar name={fullName(row)} photo={null} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b className="truncate text-label-sm text-dark">{fullName(row)}</b>
            <span className={cn(meta, "truncate")}>
              {[row.group_name, ageGroupFor(row.birth_year), row.parent_name].filter(Boolean).join(" · ")}
            </span>
          </span>
        </button>
        <div className="flex flex-none flex-col items-end gap-1.5">
          <BrandPill tone={status.tone}>{status.text}</BrandPill>
          {row.display_status === "waiting" ? (
            <button type="button" className={cn(textButton, "text-label-xsm")} disabled={busy} onClick={onMarkPaid}>
              Mark as paid
            </button>
          ) : null}
        </div>
        <button type="button" className="hidden size-control flex-none items-center justify-center text-dark-300 hover:text-dark sm:inline-flex" onClick={onOpen} aria-hidden="true" tabIndex={-1}>
          <ChevronRight className="size-4" strokeWidth={1.5} />
        </button>
      </div>
      <div className="pl-[38px]">
        <AccountLine row={row} busy={busy} onResendFinish={onResendFinish} onResendInvite={onResendInvite} onInvite={onInvite} />
      </div>
      {inviting ? <InviteBox row={row} onDone={onInvited} /> : null}
    </li>
  );
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** "Invite family" on a row without an email: save the email on the registration, then invite. */
const InviteBox = ({ row, onDone }: { row: CampRegistrationRow; onDone: () => void }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const send = useMutation({
    mutationFn: async () => {
      const clean = email.trim().toLowerCase();
      // Persist on the camp row first so claim/finish can match after the family joins.
      await campsAPI.setParentEmail(row.id, clean, row.parent_name || clean.split("@")[0]);
      const { error } = await addClientReferrals([
        { name: row.parent_name || clean.split("@")[0], email: clean, athlete_first_name: row.athlete_first_name },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Invite sent", description: `${email.trim()} gets a link to join AthaNext.` });
      onDone();
    },
    onError: (err) => toast({ title: "Couldn't send the invite", description: errorText(err, "Try again."), variant: "destructive" }),
  });
  return (
    <div className="ml-[38px] flex flex-col gap-2 rounded-control bg-light-400 p-3">
      <label className="flex flex-col gap-1.5">
        <span className={label}>Parent email</span>
        <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@email.com" />
      </label>
      <span className={meta}>They get a link to join AthaNext. {row.athlete_first_name}&apos;s spot is already held.</span>
      <button type="button" className={cn(primaryButton, smallButton, "self-start")} disabled={!EMAIL.test(email.trim()) || send.isPending} onClick={() => send.mutate()}>
        {send.isPending ? "Sending…" : "Send invite"}
      </button>
    </div>
  );
};

const RowDetail = ({
  row,
  onClose,
  busy,
  onMarkPaid,
  onCancel,
  onResendFinish,
}: {
  row: CampRegistrationRow;
  onClose: () => void;
  busy: boolean;
  onMarkPaid: () => void;
  onCancel: () => void;
  onResendFinish: () => void;
}) => {
  const status = STATUS[row.display_status];
  const facts: [string, string][] = [
    ["Group", row.group_name ?? "No group"],
    ["Birth year", row.birth_year ? `${row.birth_year} · ${ageGroupFor(row.birth_year)}` : "Not given"],
    ["Parent", row.parent_name ?? "Not given"],
    ["Mobile", row.parent_phone ?? "Not given"],
    ["Email", row.parent_email ?? "Not given"],
    ["Waiver", row.waiver_accepted_at ? `Signed ${longDate(row.waiver_accepted_at)}` : "Not signed in AthaNext"],
    ["Photos", row.photo_consent ? "OK to use photos" : "No photos"],
    ["Paid with", PAID_WITH[row.pay_method]],
  ];
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(modalSurface, closeButtonOverride, "max-h-[90dvh] w-[calc(100vw-32px)] max-w-[480px] gap-0 overflow-y-auto p-0")}>
        <div className="flex flex-col gap-2 border-b border-light-525 px-5 py-5 pr-14">
          <button type="button" className={cn(textButton, "self-start text-dark-300 hover:text-dark")} onClick={onClose}>
            <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
            Registrations
          </button>
          <DialogTitle className="text-card-title text-dark">{fullName(row)}</DialogTitle>
          <DialogDescription asChild>
            <span className="flex items-center gap-2">
              <BrandPill tone={status.tone}>{status.text}</BrandPill>
              {row.paid_at ? <span className={meta}>{longDate(row.paid_at)}</span> : null}
            </span>
          </DialogDescription>
        </div>
        <div className="flex flex-col gap-4 px-5 py-5">
          <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className={label}>{k}</dt>
                <dd className="break-words text-body-m text-dark">{v}</dd>
              </div>
            ))}
          </dl>
          {row.note ? (
            <div className="flex flex-col gap-1.5 rounded-control bg-light-400 px-3 py-2.5">
              <span className="flex items-center justify-between gap-2">
                <span className={label}>Note from the parent</span>
                <span className={cn(meta, "inline-flex items-center gap-1")}>
                  <Lock className="size-3" strokeWidth={2} aria-hidden="true" />
                  Only you see this
                </span>
              </span>
              <p className="whitespace-pre-line text-body-m text-dark">{row.note}</p>
            </div>
          ) : null}
          {row.account === "not_finished" ? (
            <button type="button" className={cn(textButton, "self-start")} disabled={busy} onClick={onResendFinish}>
              Resend the finish-account link
            </button>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 border-t border-light-525 pt-4">
            {row.display_status === "waiting" ? (
              <button type="button" className={primaryButton} disabled={busy} onClick={onMarkPaid}>
                <Check strokeWidth={1.5} aria-hidden="true" />
                Mark as paid
              </button>
            ) : null}
            <button type="button" className={cn(textButton, "text-error-700 hover:text-error-600")} disabled={busy} onClick={onCancel}>
              Cancel spot
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** Add athlete: from My athletes or a new name, a group, already paid or not yet. */
const AddAthlete = ({ data, onClose, onAdded }: { data: CampRegistrationsData; onClose: () => void; onAdded: () => Promise<unknown> }) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"mine" | "new">("mine");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [year, setYear] = useState("");
  const [email, setEmail] = useState("");
  const [groupId, setGroupId] = useState<string | null>(data.groups.length === 1 ? data.groups[0].id : null);
  const [paid, setPaid] = useState(true);
  const [notify, setNotify] = useState(true);

  const athletes = useQuery({
    queryKey: ["coach-athlete-options"],
    enabled: mode === "mine",
    staleTime: 60_000,
    queryFn: () => scheduleAPI.athleteOptions(),
  });
  const signed = useMemo(() => new Set(data.rows.map((r) => r.athlete_id).filter(Boolean)), [data.rows]);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (athletes.data ?? [])
      .filter((a) => !signed.has(a.athleteId) && (!q || a.fullName.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [athletes.data, search, signed]);

  const cleanEmail = email.trim();
  const emailOk = !cleanEmail || EMAIL.test(cleanEmail);
  const who = mode === "mine" ? Boolean(picked) : Boolean(first.trim());
  const yearOk = !year || /^\d{4}$/.test(year);
  const ready = who && Boolean(groupId) && emailOk && yearOk;
  const sendDetails = mode === "mine" ? notify : Boolean(cleanEmail) && notify;

  const add = useMutation({
    mutationFn: () =>
      campsAPI.addAthlete({
        campId: data.camp.id,
        groupId: groupId as string,
        ...(mode === "mine" && picked
          ? { athleteId: picked.id }
          : { firstName: first.trim(), lastName: last.trim(), birthYear: year ? Number(year) : null, parentEmail: cleanEmail || null }),
        paid,
        sendDetails,
        sendInvite: true,
      }),
    onSuccess: async (res) => {
      await onAdded();
      const tail = res.emailed || res.invited ? " Their family gets a confirmation email." : res.parent_email ? "" : " Invite the family any time from the list.";
      toast({ title: `${res.athlete_first_name} added`, description: `${paid ? "Paid outside." : "Waiting for payment."}${tail}` });
      onClose();
    },
    onError: (err) => toast({ title: "Could not add this athlete", description: errorText(err, "Try again."), variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-4 rounded-card border border-light-525 bg-light-300 p-4 md:p-5">
      <div className="flex flex-col gap-1">
        <h4 className="text-subtitle text-dark">Add an athlete</h4>
        <p className={meta}>For families who signed up with you outside AthaNext. They take a spot like anyone else.</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>Athlete</span>
        <div className={cn(segGroup, "self-start")} role="group" aria-label="Athlete">
          <button type="button" className={segButton(mode === "mine")} aria-pressed={mode === "mine"} onClick={() => setMode("mine")}>
            From My athletes
          </button>
          <button type="button" className={segButton(mode === "new")} aria-pressed={mode === "new"} onClick={() => setMode("new")}>
            Not on AthaNext yet
          </button>
        </div>
        {mode === "mine" ? (
          picked ? (
            <div className="flex items-center gap-2.5 rounded-control border border-primary bg-primary-50 px-2.5 py-2">
              <CampAvatar name={picked.name} photo={null} />
              <b className="min-w-0 flex-1 truncate text-label-sm">{picked.name}</b>
              <button type="button" className={textButton} onClick={() => setPicked(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <div className={cn(input, "flex items-center gap-2")}>
                <Search className="size-4 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
                <input className="h-full min-w-0 flex-1 bg-transparent outline-none" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search My athletes" aria-label="Search My athletes" />
              </div>
              {athletes.isLoading ? <span className={meta}>Loading your athletes…</span> : null}
              {athletes.isError ? <span className="text-caption text-error-700">Couldn&apos;t load your athletes.</span> : null}
              {matches.map((a) => (
                <button
                  key={a.athleteId}
                  type="button"
                  className="flex min-h-[40px] items-center gap-2.5 rounded-control border border-light-525 bg-light-300 px-2.5 py-1.5 text-left hover:bg-light-200"
                  onClick={() => setPicked({ id: a.athleteId, name: a.fullName })}
                >
                  <CampAvatar name={a.fullName} photo={null} />
                  <span className="truncate text-label-sm">{a.fullName}</span>
                </button>
              ))}
              {athletes.data && !matches.length ? <span className={meta}>No athlete by that name. Add them as not on AthaNext yet.</span> : null}
            </>
          )
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className={label}>First name</span>
                <input className={input} value={first} maxLength={60} onChange={(e) => setFirst(e.target.value)} />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className={label}>Last name</span>
                <input className={input} value={last} maxLength={60} onChange={(e) => setLast(e.target.value)} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={label}>
                Birth year<span className="font-normal"> (optional)</span>
              </span>
              <input className={input} inputMode="numeric" maxLength={4} placeholder="2013" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>
                Parent email<span className="font-normal"> (optional)</span>
              </span>
              <input className={cn(input, !emailOk && "border-error-600")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@email.com" />
              <span className={meta}>
                With an email, the parent gets the camp details and an invite to join AthaNext. Leave it empty and you can invite them later from the list. The spot is held either way.
              </span>
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>Group</span>
        <div className="flex flex-wrap gap-2">
          {data.groups.map((g) => {
            const full = g.taken >= g.spots;
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={groupId === g.id}
                disabled={full}
                className={cn(
                  "inline-flex min-h-[40px] flex-col items-start justify-center rounded-control border px-3 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:border-light-525 disabled:bg-light-400 disabled:text-dark-200",
                  groupId === g.id ? "border-primary bg-primary-50" : "border-light-525 bg-light-300 hover:bg-light-200",
                )}
                onClick={() => setGroupId(g.id)}
              >
                <span className="text-label-sm">{g.name}</span>
                <span className={meta}>{full ? "Fully booked" : `${g.spots - g.taken} left · ${formatCampTimes(g.start_time, g.end_time)}`}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>Payment</span>
        <div className={cn(segGroup, "self-start")} role="group" aria-label="Payment">
          <button type="button" className={segButton(paid)} aria-pressed={paid} onClick={() => setPaid(true)}>
            Already paid
          </button>
          <button type="button" className={segButton(!paid)} aria-pressed={!paid} onClick={() => setPaid(false)}>
            Not paid yet
          </button>
        </div>
        <span className={meta}>{paid ? "Shows as Paid outside." : "Shows as Waiting until you mark it paid."}</span>
      </div>

      {mode === "mine" || cleanEmail ? (
        <label className="flex cursor-pointer items-start gap-2.5 text-body-m text-dark">
          <input type="checkbox" className="mt-[2px] size-4 flex-none accent-primary" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Email the family a confirmation with the camp details
        </label>
      ) : null}

      <div className="flex items-center justify-end gap-2.5">
        <button type="button" className={secondaryButton} onClick={onClose} disabled={add.isPending}>
          Cancel
        </button>
        <button type="button" className={primaryButton} disabled={!ready || add.isPending} onClick={() => add.mutate()}>
          {add.isPending ? "Adding…" : "Add to camp"}
        </button>
      </div>
    </div>
  );
};
