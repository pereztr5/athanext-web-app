/** Summary text for Book a Session's footer, bottom bars and "Your booking" column (Working Copy `AN.bookSum`). */
import type { BookableSession, BookingCoach } from "@/api/book";
import { money } from "@/utils/booking";
import { planBooking } from "@/utils/bookPlan";
import { plural } from "@/utils/schedule";

export type BookingPlan = ReturnType<typeof planBooking<BookableSession>>;

/** "2 sessions · 1 credit applied · 1 request" */
export const bookSum = (plan: BookingPlan, count: number) =>
  [
    count - plan.requests.length ? plural(count - plan.requests.length, "session") : "",
    plan.covered.size ? `${plural(plan.covered.size, "credit")} applied` : "",
    plan.requests.length ? plural(plan.requests.length, "request") : "",
  ]
    .filter(Boolean)
    .join(" · ");

/** The headline amount: due now, else what's paid to the coach directly, else what requests cost if accepted. */
export const dueText = (plan: BookingPlan) =>
  money(plan.dueNow || !(plan.requests.length || plan.payDirect) ? plan.dueNow : plan.payDirect ? plan.payDirect : plan.ifAccepted);

export const dueCaption = (plan: BookingPlan) => (plan.dueNow || !plan.requests.length ? "" : " · charged only if accepted");

/** Nothing charged in the app now or later (credits, pay directly) reads as booking, not paying. */
export const reviewLabel = (plan: BookingPlan) => (plan.dueNow || plan.requests.length ? "Review and pay" : "Review and book");

export const firstName = (coach: Pick<BookingCoach, "name"> | undefined) => coach?.name.split(" ")[0] ?? "the coach";
