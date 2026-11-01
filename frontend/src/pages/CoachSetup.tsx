/**
 * Coach setup (sign-up redesign, Oct 31): the 7 steps after a coach creates their account.
 * Photo, pricing, availability and payout details are required before going live; bio,
 * Instagram and credentials help families choose. Each step opens the editor that already
 * exists for it; the database (coach_setup_status) says which are done, and refuses going live
 * until the required ones are.
 */
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { PageHeader } from "@/components/ui/page-header";
import { card, meta, primaryButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";

type SetupKey =
  | "photo"
  | "bio"
  | "instagram"
  | "credentials"
  | "pricing"
  | "availability"
  | "payouts";
type SetupStatus = Record<SetupKey | "ready" | "listed", boolean> & {
  coach_id: string;
};

// A function, not a constant: routes.tsx imports this page, so ROUTES isn't ready at load time.
const setupSteps = (): {
  key: SetupKey;
  title: string;
  detail: string;
  to: string;
  required: boolean;
}[] => {
  const PROFILE_EDIT = `${ROUTES.PROFILE}?mode=edit`;
  return [
    {
      key: "photo",
      title: "Profile photo",
      detail: "Families pick coaches they can see.",
      to: PROFILE_EDIT,
      required: true,
    },
    {
      key: "bio",
      title: "Bio",
      detail: "Who you are and how you coach.",
      to: PROFILE_EDIT,
      required: false,
    },
    {
      key: "instagram",
      title: "Instagram",
      detail: "Your handle or link.",
      to: PROFILE_EDIT,
      required: false,
    },
    {
      key: "credentials",
      title: "Credentials",
      detail: "Licences, certifications and where you played.",
      to: PROFILE_EDIT,
      required: false,
    },
    {
      key: "pricing",
      title: "Pricing",
      detail: "Your 1-on-1 price or a session package.",
      to: PROFILE_EDIT,
      required: true,
    },
    {
      key: "availability",
      title: "Availability",
      detail: "The weekly times families can book.",
      to: `${ROUTES.SCHEDULE_SETTINGS}#weekly-hours`,
      required: true,
    },
    {
      key: "payouts",
      title: "Payout details",
      detail: "Where Stripe sends what families pay you.",
      to: `${ROUTES.SETTINGS}?tab=booking`,
      required: true,
    },
  ];
};

const CoachSetupPage = () => {
  const { isCoach, ready } = useRole();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const coachId = userProfile?.coach_id ?? null;

  const status = useQuery({
    queryKey: ["coach-setup-status", coachId],
    enabled: Boolean(coachId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("coach_setup_status" as never);
      if (error) throw error;
      return data as unknown as SetupStatus | null;
    },
  });

  const goLive = useMutation({
    mutationFn: async () => {
      if (!coachId) throw new Error("No coach profile");
      const { error } = await supabase
        .from("coaches")
        .update({ listed: true })
        .eq("id", coachId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["coach-setup-status"] });
      toast({
        title: "You're live",
        description: "Families can find and book you now.",
      });
      navigate(ROUTES.DASHBOARD);
    },
    onError: (err: Error) =>
      toast({
        title: "Not live yet",
        description: err.message,
        variant: "destructive",
      }),
  });

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-light-525 border-t-primary" />
      </div>
    );
  }
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;

  const s = status.data;
  const STEPS = setupSteps();
  const required = STEPS.filter((step) => step.required);
  const requiredDone = s ? required.filter((step) => s[step.key]).length : 0;

  return (
    <div className="px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper-focused flex-col gap-4 md:gap-6">
        <PageHeader
          title="Set up your coaching profile"
          subtitle={
            s?.listed
              ? "You're live. Finish the rest whenever you like."
              : `${requiredDone} of ${required.length} required steps done. Families can book you once they're all done.`
          }
        />
        <section className={card} aria-label="Setup steps">
          {status.isLoading ? <p className={meta}>Loading…</p> : null}
          {status.isError ? (
            <p className="text-body-m text-error-700">
              Couldn't load your setup. Refresh to try again.
            </p>
          ) : null}
          <ol className="flex flex-col divide-y divide-light-525">
            {STEPS.map((step, i) => {
              const done = Boolean(s?.[step.key]);
              return (
                <li key={step.key}>
                  <Link
                    to={step.to}
                    className="flex items-center gap-3 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span
                      className={cn(
                        "flex size-7 flex-none items-center justify-center rounded-full text-label-xsm",
                        done
                          ? "bg-primary text-light"
                          : "border border-light-600 text-dark-300",
                      )}
                      aria-hidden="true"
                    >
                      {done ? (
                        <Check className="size-3.5" strokeWidth={2.5} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-label-sm text-dark">
                        {step.title}
                        {step.required && !done ? (
                          <BrandPill tone="amber">Required</BrandPill>
                        ) : null}
                        {done ? <span className="sr-only">(done)</span> : null}
                      </span>
                      <span className={meta}>{step.detail}</span>
                    </span>
                    <ChevronRight
                      className="size-4 flex-none text-dark-300"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
        {s && !s.listed ? (
          <button
            type="button"
            className={cn(primaryButton, "self-start")}
            disabled={!s.ready || goLive.isPending}
            onClick={() => goLive.mutate()}
          >
            {goLive.isPending ? "Going live…" : "Go live on the marketplace"}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default CoachSetupPage;
