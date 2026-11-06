import { errorMessage } from "@/utils/errorMessage";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { useClaimReferral, useReferralInvite } from "@/hooks/useReferrals";
import { claimErrorMessage, INVITE_TOKEN_STORAGE_KEY, type AttestationAnswer } from "@/utils/referralHelpers";
import { coachProfilePath } from "@/utils/coachSlug";
import { ROUTES } from "@/routes";

const titleClass = "text-section text-dark";
const bodyClass = "text-body-l text-dark-300";

const Shell = ({ children }: { children: ReactNode }) => (
  // Fill the marketing chrome so a short invite card doesn't float above a huge empty footer gap.
  <div className="flex min-h-[calc(100dvh-12rem)] items-center justify-center px-4 py-12 md:px-10">
    <div className="mx-auto flex w-full max-w-wrapper-focused flex-col gap-5 rounded-card border border-light-525 bg-light-300 p-[25px] md:p-[30px]">
      {children}
    </div>
  </div>
);

const InviteClaim = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { invite, isLoading } = useReferralInvite(token);
  const claim = useClaimReferral();
  const [answer, setAnswer] = useState<AttestationAnswer | null>(null);
  const [result, setResult] = useState<"confirmed" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    try {
      sessionStorage.setItem(INVITE_TOKEN_STORAGE_KEY, token);
    } catch {
      // storage blocked: the link itself still works
    }
  }, [token]);

  const forgetToken = () => {
    try {
      sessionStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // A dead link should not keep redirecting the athlete back here.
  useEffect(() => {
    if (!isLoading && (!invite || invite.state !== "valid") && !result) forgetToken();
  }, [invite, isLoading, result]);

  const coachLabel = invite ? `Coach ${invite.coach_name}` : "your coach";
  const coachPath = invite ? coachProfilePath(invite.coach_slug ?? invite.coach_id) : ROUTES.COACHES;

  const submit = async (value: AttestationAnswer) => {
    if (!token) return;
    setError(null);
    try {
      const outcome = await claim.mutateAsync({ token, answer: value });
      forgetToken();
      setResult(outcome === "declined" ? "declined" : "confirmed");
    } catch (e) {
      setError(claimErrorMessage(errorMessage(e)));
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-light-525 border-t-primary" />
      </div>
    );
  }

  if (result === "confirmed") {
    return (
      <Shell>
        <h1 className={titleClass}>You're all set with {coachLabel}</h1>
        <p className={bodyClass}>
          Sessions you book with {coachLabel} have no platform fee. Card processing still applies.
        </p>
        <div className="flex flex-wrap gap-[10px]">
          <Button asChild size="lg"><Link to={coachPath}>Book {coachLabel}</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to={ROUTES.MY_COACHES}>My coaches</Link></Button>
        </div>
      </Shell>
    );
  }

  if (result === "declined") {
    return (
      <Shell>
        <h1 className={titleClass}>Thanks for letting us know</h1>
        <p className={bodyClass}>
          We've noted that you found {coachLabel} through AthaNext. You can still book them at the regular price.
        </p>
        <Button asChild size="lg" className="w-fit"><Link to={coachPath}>View {coachLabel}</Link></Button>
      </Shell>
    );
  }

  if (!invite || invite.state === "used") {
    return (
      <Shell>
        <h1 className={titleClass}>This invite link can't be used</h1>
        <p className={bodyClass}>
          It has already been accepted or is no longer valid. If your coach added you, check My coaches, or ask them
          to send a new invite.
        </p>
        <Button asChild size="lg" className="w-fit">
          <Link to={user ? ROUTES.MY_COACHES : ROUTES.COACHES}>{user ? "My coaches" : "Browse coaches"}</Link>
        </Button>
      </Shell>
    );
  }

  if (invite.state === "expired") {
    return (
      <Shell>
        <h1 className={titleClass}>This invite has expired</h1>
        <p className={bodyClass}>Ask {coachLabel} to resend it. Their new link will work for another 14 days.</p>
      </Shell>
    );
  }

  const greeting = (
    <>
      <h1 className={titleClass}>
        {invite.client_name ? `${invite.client_name}, ` : ""}
        {coachLabel} invited you to AthaNext
      </h1>
      <p className={bodyClass}>
        As an existing client, you book {coachLabel} with no platform fee. This invite is for{" "}
        <span className="font-medium text-dark">{invite.masked_email}</span>.
      </p>
    </>
  );

  if (!user) {
    return (
      <Shell>
        {greeting}
        <p className={bodyClass}>Create your account or log in with that email to accept.</p>
        <div className="flex flex-wrap gap-[10px]">
          <Button asChild size="lg">
            <Link to={`${ROUTES.AUTH}?mode=signup&persona=athlete&invite=${token}`}>Create account</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() =>
              navigate(`${ROUTES.AUTH}?mode=signin`, { state: { from: { pathname: `/invite/${token}` } } })
            }
          >
            I already have an account
          </Button>
        </div>
      </Shell>
    );
  }

  if (!invite.is_athlete || !invite.email_matches) {
    return (
      <Shell>
        {greeting}
        <p className={bodyClass}>
          {invite.is_athlete
            ? `You're signed in as ${user.email}, which doesn't match this invite.`
            : "You're signed in without an athlete profile."}{" "}
          Log in with the invited email, or ask {coachLabel} to resend the invite to {user.email}.
        </p>
        <Button
          size="lg"
          variant="outline"
          className="w-fit"
          onClick={async () => {
            await signOut();
            navigate(`${ROUTES.AUTH}?mode=signin`, { state: { from: { pathname: `/invite/${token}` } } });
          }}
        >
          Log in with another account
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      {greeting}
      <div className="flex flex-col gap-3">
        <Label className="text-label-sm text-dark">
          How do you know {coachLabel}?
        </Label>
        <RadioGroup value={answer ?? ""} onValueChange={(v) => setAnswer(v as AttestationAnswer)}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="offline" id="invite-offline" />
            <Label htmlFor="invite-offline" className="text-body-m text-dark">
              We already train together, outside of AthaNext
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="platform" id="invite-platform" />
            <Label htmlFor="invite-platform" className="text-body-m text-dark">
              I found them through AthaNext
            </Label>
          </div>
        </RadioGroup>
      </div>
      {error ? <p className="text-body-m text-error-700">{error}</p> : null}
      <div className="flex flex-wrap gap-[10px]">
        <Button size="lg" disabled={!answer || claim.isPending} onClick={() => answer && submit(answer)}>
          {claim.isPending ? "Saving…" : "Accept invite"}
        </Button>
        <Button size="lg" variant="outline" disabled={claim.isPending} onClick={() => submit("declined")}>
          Not my coach
        </Button>
      </div>
    </Shell>
  );
};

export default InviteClaim;
