/**
 * Review and pay (ATH-94): splits picked times by how each coach is paid, and works out which
 * times credits cover (the earliest ones with each coach).
 */
export type PlanCoach = { id: string; needsRequest: boolean; paysDirect: boolean; credits: number };
export type PlanSession = { id: string; coachId: string; price: number; date: string; startTime: string };

export const planBooking = <S extends PlanSession>(picked: S[], coaches: Record<string, PlanCoach>, useCredits: boolean) => {
  const direct = picked.filter((s) => coaches[s.coachId]?.paysDirect);
  const requests = picked.filter((s) => !coaches[s.coachId]?.paysDirect && coaches[s.coachId]?.needsRequest);
  const instant = picked.filter((s) => !coaches[s.coachId]?.paysDirect && !coaches[s.coachId]?.needsRequest);
  const covered = new Set<string>();
  if (useCredits) {
    const byCoach = new Map<string, S[]>();
    instant.forEach((s) => byCoach.set(s.coachId, [...(byCoach.get(s.coachId) ?? []), s]));
    byCoach.forEach((list, coachId) => {
      [...list]
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
        .slice(0, coaches[coachId]?.credits ?? 0)
        .forEach((s) => covered.add(s.id));
    });
  }
  const sum = (list: S[]) => list.reduce((n, s) => n + s.price, 0);
  const availableCredits = [...new Set(instant.map((s) => s.coachId))].reduce((n, id) => n + (coaches[id]?.credits ?? 0), 0);
  return {
    instant,
    requests,
    direct,
    covered,
    availableCredits,
    dueNow: sum(instant.filter((s) => !covered.has(s.id))),
    ifAccepted: sum(requests),
    payDirect: sum(direct),
  };
};
