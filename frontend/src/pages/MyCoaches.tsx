import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { BrandPill } from "@/components/brand";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useProfile } from "@/contexts/ProfileContext";
import { useAttestReferral, useMyReferrals } from "@/hooks/useReferrals";
import { useCoaches } from "@/hooks/useCoaches";
import { useMySessions } from "@/hooks/useMySessions";
import {
  bookedOnlyCoaches, isInviteExpired, type AttestationAnswer,
} from "@/utils/referralHelpers";

const MyCoaches = () => {
  const { profile } = useProfile();
  const athleteId = profile?.userProfile?.athlete_id ?? undefined;
  const { data: referrals = [], isLoading: referralsLoading } = useMyReferrals(athleteId);
  const { sessions, isLoading: sessionsLoading } = useMySessions("athlete");
  // Coaches the athlete has booked but has no referral with (ATH-54).
  const booked = bookedOnlyCoaches(sessions, referrals);
  const { coaches } = useCoaches(referrals.length > 0 || booked.length > 0);
  const isLoading = referralsLoading || sessionsLoading;
  const attest = useAttestReferral();
  const [answers, setAnswers] = useState<Record<string, AttestationAnswer>>({});

  const coachNames = Object.fromEntries(coaches.map((c) => [c.id, c.name]));

  const pending = referrals.filter(
    (r) => r.status === "pending_confirmation" && r.initiated_by === "coach",
  );
  // Athlete-initiated signups wait on the coach to acknowledge; surface them
  // read-only so athletes aren't left wondering where the request went.
  const waitingOnCoach = referrals.filter(
    (r) => r.status === "pending_confirmation" && r.initiated_by === "athlete",
  );
  const confirmed = referrals.filter((r) => r.status === "confirmed");

  const card = "flex flex-col gap-5 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px] md:px-[25px] md:pb-[25px] md:pt-[30px]";
  const row = "flex items-center justify-between gap-3 rounded-control border border-light-525 bg-light-300 p-4";

  return (
    <div className="mx-auto flex w-full max-w-wrapper flex-col gap-4 px-4 pb-16 pt-8 md:gap-6">
      <PageHeader title="My coaches" />

      {isLoading && <p className="text-body-m text-dark-300">Loading…</p>}

      {pending.length > 0 && (
        <section className={card}>
          <h2 className="text-card-title text-dark">Pending confirmations</h2>
          <ul className="flex flex-col gap-4">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 rounded-control border border-light-525 bg-light-300 p-4">
                <p className="text-label-sm text-dark">
                  {coachNames[r.coach_id] ?? "A coach"} added you as an existing client
                </p>
                {isInviteExpired(r) ? (
                  <p className="text-body-m text-dark-300">
                    This invite has expired. Ask your coach to resend it.
                  </p>
                ) : (
                <>
                <p className="text-body-m text-dark-300">
                  How do you know this coach?
                </p>
                <RadioGroup
                  value={answers[r.id]}
                  onValueChange={(value) =>
                    setAnswers((a) => ({ ...a, [r.id]: value as AttestationAnswer }))
                  }
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="offline" id={`${r.id}-offline`} />
                    <Label htmlFor={`${r.id}-offline`} className="text-body-m text-dark">
                      We worked together before or outside of AthaNext
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="platform" id={`${r.id}-platform`} />
                    <Label htmlFor={`${r.id}-platform`} className="text-body-m text-dark">
                      I found them through AthaNext
                    </Label>
                  </div>
                </RadioGroup>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={attest.isPending}
                    onClick={() => attest.mutate({ referralId: r.id, answer: "declined" })}
                  >
                    Not my coach
                  </Button>
                  <Button
                    size="sm"
                    disabled={!answers[r.id] || attest.isPending}
                    onClick={() => attest.mutate({ referralId: r.id, answer: answers[r.id] })}
                  >
                    Confirm
                  </Button>
                </div>
                </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {waitingOnCoach.length > 0 && (
        <section className={card}>
          <h2 className="text-card-title text-dark">Waiting for coach confirmation</h2>
          <ul className="flex flex-col gap-2">
            {waitingOnCoach.map((r) => (
              <li key={r.id} className={row}>
                <span className="text-label-sm text-dark">{coachNames[r.coach_id] ?? r.coach_id}</span>
                <BrandPill tone="amber">Awaiting coach confirmation</BrandPill>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <h2 className="text-card-title text-dark">Confirmed coaches</h2>
        {confirmed.length === 0 ? (
          <p className="text-body-m text-dark-300">
            {booked.length > 0 ? "No coach referrals yet." : "No confirmed coaches yet."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {confirmed.map((r) => (
              <li key={r.id} className={row}>
                <span className="text-label-sm text-dark">{coachNames[r.coach_id] ?? r.coach_id}</span>
                <Badge>No platform fee on sessions with this coach</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {booked.length > 0 && (
        <section className={card}>
          <h2 className="text-card-title text-dark">Coaches you've booked</h2>
          <ul className="flex flex-col gap-2">
            {booked.map((c) => (
              <li key={c.coachId} className={row}>
                <span className="text-label-sm text-dark">
                  {c.coachName ?? coachNames[c.coachId] ?? "A coach"}
                </span>
                <span className="text-body-m text-dark-300">Booked sessions</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default MyCoaches;
