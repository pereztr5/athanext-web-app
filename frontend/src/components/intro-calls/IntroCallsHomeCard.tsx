/**
 * Coach Home intro calls card (Working Copy `AN.introHome`): today's calls with Join, then
 * "How did the call go?" for calls that are over, with a first-session offer to send or Not a fit.
 * Renders nothing when there are no calls, while loading, or if the intro call functions fail.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, Send, Video } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { ToastAction } from "@/components/ui/toast";
import { introCallsAPI, type IntroCall } from "@/api/introCalls";
import { card, label, primaryButton, secondaryButton, smallButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ageOn } from "@/utils/athleteHome";
import { formatClock, plural } from "@/utils/schedule";
import { isoDateInZone } from "@/utils/viewerTime";
import { INTRO_KEYS, capText, errorText, firstName, introWhen, mText } from "./helpers";
import { IntroSettingsDialog } from "./IntroSettingsDialog";

const eyebrow = "text-label-xsm text-dark-300";
const h2 = "text-card-title text-dark";

// Not a fit waits this long before it sends the thank-you, so Undo can take it back.
const UNDO_MS = 6000;

const endOf = (c: IntroCall) => new Date(c.startsAt).getTime() + c.minutes * 60 * 1000;

export const IntroCallsHomeCard = () => {
  const timeZone = useViewerTimeZone();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({ queryKey: INTRO_KEYS.home, queryFn: () => introCallsAPI.coachCalls(), retry: false });
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [closing, setClosing] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const refresh = () => void queryClient.invalidateQueries({ queryKey: INTRO_KEYS.home });

  const close = (call: IntroCall) => {
    timers.current.delete(call.id);
    introCallsAPI.notAFit(call.id).then(refresh, (err) => {
      setClosing((s) => {
        const next = new Set(s);
        next.delete(call.id);
        return next;
      });
      toast({ title: "Couldn't close the intro call", description: errorText(err, "Try again."), variant: "destructive" });
    });
  };

  // Leaving Home sends any Not a fit that is still waiting.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer, id) => {
        clearTimeout(timer);
        void introCallsAPI.notAFit(id).catch(() => undefined);
      });
      pending.clear();
    };
  }, []);

  const offer = useMutation({
    mutationFn: ({ call, key }: { call: IntroCall; key: string }) => introCallsAPI.sendOffer(call.id, key),
    onSuccess: (_data, { call, key }) => {
      const option = query.data?.options.find((o) => o.key === key);
      toast({ title: `Offer sent to ${call.familyName}`, description: option?.label });
      refresh();
    },
    onError: (err) => toast({ title: "Couldn't send the offer", description: errorText(err, "Try again."), variant: "destructive" }),
  });

  const data = query.data;
  if (!data) return null;

  const now = Date.now();
  const todayISO = isoDateInZone(new Date(now), timeZone);
  const calls = data.calls.filter((c) => !closing.has(c.id));
  const today = calls.filter((c) => endOf(c) > now && isoDateInZone(new Date(c.startsAt), timeZone) === todayISO);
  const todo = calls.filter((c) => endOf(c) <= now);
  if (!today.length && !todo.length) return null;

  const heading = [
    today.length ? `${plural(today.length, "call")} today` : "",
    todo.length ? `${todo.length} ${todo.length === 1 ? "needs" : "need"} a follow-up` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const forText = (c: IntroCall) => {
    const age = c.athleteBirthDate ? ageOn(c.athleteBirthDate, todayISO) : null;
    const named = c.athleteName ? `${firstName(c.athleteName)}${age != null ? `, ${age}` : ""}` : "";
    const who = named ? `for ${named}` : "";
    // The booking sheet pre-fills the first answer with "Casey, 16", so drop that repeat.
    const answers = c.answers
      .map((a) => {
        const text = a.a.trim();
        return named && text.startsWith(named) ? text.slice(named.length).replace(/^[\s,·-]+/, "") : text;
      })
      .filter(Boolean);
    return [who, ...answers].filter(Boolean).join(" · ");
  };

  const notAFit = (call: IntroCall) => {
    setClosing((s) => new Set(s).add(call.id));
    timers.current.set(
      call.id,
      setTimeout(() => close(call), UNDO_MS)
    );
    toast({
      title: `Closed. ${call.familyName} gets a short thank-you note`,
      duration: UNDO_MS,
      action: (
        <ToastAction
          altText="Undo"
          onClick={() => {
            const timer = timers.current.get(call.id);
            if (!timer) return;
            clearTimeout(timer);
            timers.current.delete(call.id);
            setClosing((s) => {
              const next = new Set(s);
              next.delete(call.id);
              return next;
            });
          }}
        >
          Undo
        </ToastAction>
      ),
    });
  };

  const join = (c: IntroCall) => {
    if (c.format === "phone") {
      return c.phone ? (
        <a href={`tel:${c.phone}`} className={cn(primaryButton, smallButton, "col-start-2 justify-self-start md:col-auto")}>
          <Phone strokeWidth={1.5} aria-hidden="true" />
          Call
        </a>
      ) : null;
    }
    return data.videoUrl ? (
      <a
        href={data.videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(primaryButton, smallButton, "col-start-2 justify-self-start md:col-auto")}
      >
        <Video strokeWidth={1.5} aria-hidden="true" />
        Join
      </a>
    ) : (
      <button type="button" className={cn(secondaryButton, smallButton, "col-start-2 justify-self-start md:col-auto")} onClick={() => setSettingsOpen(true)}>
        Add meeting link
      </button>
    );
  };

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className={eyebrow}>Intro calls</span>
          <h2 className={h2}>{heading.charAt(0).toUpperCase() + heading.slice(1)}</h2>
        </div>
        <span className={capText}>
          {data.bookedThisWeek} of {data.weeklyLimit} this week
        </span>
      </div>

      {today.length ? (
        <div>
          {today.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-x-3 gap-y-[10px] border-t border-light-525 py-3 md:flex md:items-center"
            >
              <span className="flex w-16 flex-none flex-col">
                <b className="text-label-sm">{formatClock(new Date(c.startsAt), timeZone)}</b>
                <small className="text-caption text-dark-300">{c.minutes} min</small>
              </span>
              <span className="flex min-w-0 grow flex-col gap-1">
                <span className={mText}>Intro call with {c.familyName}</span>
                <span className={capText}>
                  {[c.format === "phone" ? `Phone call${c.phone ? ` · ${c.phone}` : ""}` : "Video call", forText(c)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <BrandPill tone="teal" className="hidden flex-none md:inline-flex">
                Intro call
              </BrandPill>
              {join(c)}
            </div>
          ))}
        </div>
      ) : null}

      {todo.map((c) => {
        const pick = picks[c.id] ?? data.options[0]?.key ?? "";
        return (
          <div key={c.id} className="flex flex-col gap-3 rounded-card border border-light-525 bg-light-400 p-4">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <span className="flex min-w-0 flex-col gap-1">
                <span className={mText}>How did the call with {c.familyName} go?</span>
                <span className={capText}>
                  {introWhen(c.startsAt, timeZone)}
                  {forText(c) ? ` · ${forText(c)}` : ""}
                </span>
              </span>
              <BrandPill tone="amber">Waiting on you</BrandPill>
            </div>
            {data.options.length ? (
              <>
                <span className={label}>Send a first-session offer</span>
                <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={`First-session offer for ${c.familyName}`}>
                  {data.options.map((o) => (
                    <label
                      key={o.key}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-control border px-3 py-[10px] text-body-m text-dark",
                        pick === o.key ? "border-primary bg-primary-50" : "border-light-525 bg-light-300 hover:bg-light-200"
                      )}
                    >
                      <input
                        type="radio"
                        name={`intro-offer-${c.id}`}
                        className="m-0 accent-primary"
                        checked={pick === o.key}
                        onChange={() => setPicks((p) => ({ ...p, [c.id]: o.key }))}
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
                <span className={capText}>{c.familyName} gets it as a message from you in the app. It's good for 7 days.</span>
              </>
            ) : (
              <span className={capText}>Add a 1-on-1 price or a package to your profile to send a first-session offer.</span>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(primaryButton, smallButton)}
                disabled={!pick || offer.isPending}
                onClick={() => offer.mutate({ call: c, key: pick })}
              >
                <Send strokeWidth={1.5} aria-hidden="true" />
                Send offer
              </button>
              <button type="button" className={cn(secondaryButton, smallButton)} disabled={offer.isPending} onClick={() => notAFit(c)}>
                Not a fit
              </button>
            </div>
          </div>
        );
      })}
      <IntroSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </section>
  );
};
