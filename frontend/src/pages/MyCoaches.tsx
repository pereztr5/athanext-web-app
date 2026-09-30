import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16">
      <h1 className="mb-6 text-2xl font-semibold">My Coaches</h1>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Pending confirmations</h2>
          <ul className="space-y-4">
            {pending.map((r) => (
              <li key={r.id} className="rounded-lg border p-4">
                <p className="font-medium">
                  {coachNames[r.coach_id] ?? "A coach"} added you as an existing client
                </p>
                {isInviteExpired(r) ? (
                  <p className="text-sm text-muted-foreground">
                    This invite has expired. Ask your coach to resend it.
                  </p>
                ) : (
                <>
                <p className="mb-3 text-sm text-muted-foreground">
                  How do you know this coach?
                </p>
                <RadioGroup
                  className="mb-3"
                  value={answers[r.id]}
                  onValueChange={(value) =>
                    setAnswers((a) => ({ ...a, [r.id]: value as AttestationAnswer }))
                  }
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="offline" id={`${r.id}-offline`} />
                    <Label htmlFor={`${r.id}-offline`} className="font-normal">
                      We worked together before / outside of AthaNext
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="platform" id={`${r.id}-platform`} />
                    <Label htmlFor={`${r.id}-platform`} className="font-normal">
                      I found them through AthaNext
                    </Label>
                  </div>
                </RadioGroup>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!answers[r.id] || attest.isPending}
                    onClick={() => attest.mutate({ referralId: r.id, answer: answers[r.id] })}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={attest.isPending}
                    onClick={() => attest.mutate({ referralId: r.id, answer: "declined" })}
                  >
                    Not my coach
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
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Waiting for coach confirmation
          </h2>
          <ul className="space-y-2">
            {waitingOnCoach.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <span className="font-medium">{coachNames[r.coach_id] ?? r.coach_id}</span>
                <span className="text-muted-foreground">Awaiting coach confirmation</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Confirmed coaches</h2>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {booked.length > 0 ? "No coach referrals yet." : "No confirmed coaches yet."}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {confirmed.map((r) => (
              <li key={r.id} className="flex items-center justify-between p-4">
                <span className="font-medium">{coachNames[r.coach_id] ?? r.coach_id}</span>
                <Badge>No platform fee on sessions with this coach</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {booked.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-medium">Coaches you've booked</h2>
          <ul className="divide-y rounded-lg border">
            {booked.map((c) => (
              <li key={c.coachId} className="flex items-center justify-between p-4">
                <span className="font-medium">
                  {c.coachName ?? coachNames[c.coachId] ?? "A coach"}
                </span>
                <span className="text-sm text-muted-foreground">Booked sessions</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default MyCoaches;
