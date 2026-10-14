import { Calendar, DollarSign, Shield, Users, type LucideIcon } from "lucide-react";

export type HelpArticle = { title: string; body: string };
export type HelpCategory = { name: string; icon: LucideIcon; articles: HelpArticle[] };

export const HELP_ARTICLES = {
  coach: [
    {
      name: "Getting paid",
      icon: DollarSign,
      articles: [
        {
          title: "How do payouts and marketplace fees work?",
          body: "Families pay when they book. Your share is held until the session is done (or a late cancel), then Stripe pays it to your bank on your weekly payout day. Families you invited join your roster and book with no platform fee. Marketplace families pay the standard platform fee on top of your price.",
        },
        {
          title: "When does a family get charged?",
          body: "Families pay when they book, or use package credits. Invoices you create are due on the date you set, and you can send up to 3 reminders.",
        },
        {
          title: "How do refunds work?",
          body: "If a family cancels with enough notice (your setting, usually 24 hours), or you cancel, they get a session credit or their package credit back. The card charge stays; you are not paid for that cancelled session. Late cancels keep the payment and you are still paid after the session time.",
        },
      ],
    },
    {
      name: "Calendar and bookings",
      icon: Calendar,
      articles: [
        {
          title: "How do I set my availability?",
          body: "Go to My Schedule, tap Create session, pick 1-on-1 and Open to book, then tap the times you are free. They repeat every week. To take a day off, open the day and tap Clear day. Google Calendar busy time is always blocked.",
        },
        {
          title: "What is a booking request?",
          body: "New marketplace families request a time. It holds the slot for 24 hours until you accept or decline.",
        },
        {
          title: "How do group polls work?",
          body: "Create a group session and post it to a channel as a poll. Families tap to join and pay, and spots fill first come.",
        },
      ],
    },
    {
      name: "Families and safety",
      icon: Shield,
      articles: [
        {
          title: "Why is a parent included in my messages?",
          body: "For athletes under 18 the parent is the account holder and is part of every message about the athlete. This keeps communication safe and visible.",
        },
        {
          title: "How do I invite families I already coach?",
          body: "In My Athletes, use Invite families to invite by email, import a list or share your link. Invited families join your roster and book you directly.",
        },
        {
          title: "Can athletes see each other?",
          body: "No. Group sessions show other families a spot count, not names. Only you see the roster.",
        },
      ],
    },
  ],
  athlete: [
    {
      name: "Booking and payments",
      icon: Calendar,
      articles: [
        {
          title: "How do I book several sessions at once?",
          body: "On Book a Session, tick every time that works, across days and coaches, then pay once.",
        },
        {
          title: "How do package credits work?",
          body: "Credits from a package are used first when you book. You can see what is left on your Dashboard.",
        },
        {
          title: "What is the cancellation policy?",
          body: "Cancel with enough notice (the coach's setting, usually 24 hours) and the session comes back as a credit with that coach. Later cancellations keep the charge.",
        },
      ],
    },
    {
      name: "Coaches and sessions",
      icon: Users,
      articles: [
        {
          title: "How do I find a new coach?",
          body: "Use Browse Coaches to search coaches and organizations near you, then view a profile and request a session.",
        },
        {
          title: "Where are session notes?",
          body: "Open a past session in My Sessions. Your coach usually shares notes within a day.",
        },
        {
          title: "How do I rate a session?",
          body: "Open a past session and choose Rate session.",
        },
      ],
    },
    {
      name: "Account and safety",
      icon: Shield,
      articles: [
        {
          title: "Who can see the athlete's profile?",
          body: "Only the account holder and coaches they have booked with. Other athletes in a group see a spot count, not names.",
        },
        {
          title: "Can another parent book for the athlete?",
          body: "Yes. Invite a second guardian in Account Settings.",
        },
        {
          title: "How do I delete the account?",
          body: "Go to Account Settings, then Password and account.",
        },
      ],
    },
  ],
} as const satisfies Record<"coach" | "athlete", HelpCategory[]>;
