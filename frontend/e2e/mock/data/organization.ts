import { mockId, type MockBackend } from "../backend";
import { IDS, coachRow } from "../personas";
import { dayFromToday } from "./athletes";

// E2E Rowing Club, owned by Casey Coach, with Jordan Lee as a member coach and one invite out:
// get_my_organization, get_organization_sessions, get_organizations_public, get_org_page_extras,
// get_my_org_packages and the public coach list (get_coaches_public), plus an org invite for
// /org-invite/:token (get_organization_invite). Shapes follow src/api/organizations.ts and
// 20261007160000_organizations.sql / 20261010130000_academy_packages.sql.

type Row = Record<string, unknown>;

export const ORG = {
  jordan: "0000e0e0-0000-4000-8000-0000000000c2",
  invite: "0000e0e0-0000-4000-8000-0000000000a1",
  package: "0000e0e0-0000-4000-8000-0000000000b1",
  token: "org-invite-e2e-token",
  name: "E2E Rowing Club",
} as const;

const coaches = (): Row[] => [
  { coach_id: IDS.coach, name: "Casey Coach", slug: IDS.coachSlug, photo: null, hourly_rate: 80, is_owner: true, rate: null, pending_rate: null, shown: true, joined_at: "2025-01-01", pillars: ["Technique"] },
  { coach_id: ORG.jordan, name: "Jordan Lee", slug: "jordan-lee", photo: null, hourly_rate: 70, is_owner: false, rate: 20, pending_rate: 25, shown: true, joined_at: "2025-02-01", pillars: ["Speed"] },
];

const session = (row: Row): Row => ({
  id: mockId(),
  end_time: "11:00:00",
  session_type: "individual",
  session_name: null,
  pillar: null,
  capacity: 1,
  price: 70,
  athletes: 1,
  came: 1,
  marked: true,
  no_show: false,
  paid: 70,
  to_org: 14,
  ...row,
});

/** This month's sessions (today, so they're always in the current month). */
const sessions = (): Row[] => {
  const today = dayFromToday(0);
  return [
    session({ coach_id: ORG.jordan, date: today, start_time: "06:00:00", pillar: "Speed" }),
    session({ coach_id: ORG.jordan, date: today, start_time: "07:00:00", pillar: "Speed", marked: false }),
    session({ coach_id: IDS.coach, date: today, start_time: "08:00:00", session_type: "group", session_name: "Erg intervals", capacity: 6, athletes: 4, came: 3, price: 40, paid: 160, to_org: 0, pillar: "Technique" }),
  ];
};

export const seedOrganization = (backend: MockBackend) => {
  const state = {
    name: ORG.name as string,
    line: "Juniors rowing on the Hudson",
    about: "We coach juniors from first strokes to racing.",
    coaches: coaches(),
    packages: [
      { id: ORG.package, name: "Spring 10-pack", kind: "individual", session_count: 10, price: 650, validity_days: 90, renews_monthly: false, coach_ids: [IDS.coach, ORG.jordan] },
    ] as Row[],
  };
  backend.rpc.get_my_organization = (_args: Row, { user }) =>
    user?.id === IDS.coachUser
      ? {
          id: IDS.organization,
          name: state.name,
          slug: IDS.organizationSlug,
          line: state.line,
          about: state.about,
          logo_url: null,
          pricing: [],
          coaches: state.coaches,
          invites: [{ id: ORG.invite, email: "riley@e2e.test", rate: 15, sent_at: new Date(Date.now() - 2 * 86_400_000).toISOString() }],
        }
      : null;
  backend.rpc.get_organization_sessions = sessions();
  backend.rpc.get_my_org_coach_removals = [];
  backend.rpc.get_my_org_packages = () => state.packages;
  backend.rpc.save_org_package = (args: Row) => {
    const saved = {
      id: (args.p_id as string) ?? mockId(),
      name: args.p_name,
      kind: args.p_kind,
      session_count: args.p_session_count,
      price: args.p_price,
      validity_days: args.p_validity_days,
      renews_monthly: args.p_kind === "group",
      coach_ids: args.p_coach_ids,
    };
    state.packages = [...state.packages.filter((p) => p.id !== saved.id), saved];
    return saved;
  };
  backend.rpc.save_organization_page = (args: Row) => {
    state.name = String(args.p_name);
    state.line = String(args.p_line);
    state.about = String(args.p_about);
    const shown = new Map((args.p_coaches as { coach_id: string; shown: boolean }[]).map((c) => [c.coach_id, c.shown]));
    state.coaches = (args.p_coaches as { coach_id: string }[]).map((c) => ({ ...state.coaches.find((x) => x.coach_id === c.coach_id)!, shown: shown.get(c.coach_id) }));
    return IDS.organization;
  };
  backend.rpc.get_organizations_public = () => [
    {
      id: IDS.organization,
      name: state.name,
      slug: IDS.organizationSlug,
      line: state.line,
      about: state.about,
      logo_url: null,
      pricing: [],
      coach_ids: state.coaches.filter((c) => c.shown).map((c) => c.coach_id),
      member_ids: state.coaches.map((c) => c.coach_id),
    },
  ];
  backend.rpc.get_org_page_extras = () => ({
    owner_id: IDS.coach,
    owner_name: "Casey Coach",
    packages: state.packages,
    coach_prices: { [IDS.coach]: 80, [ORG.jordan]: 70 },
    groups: [{ id: mockId(), coach_id: ORG.jordan, coach_name: "Jordan Lee", title: "Saturday sculling", date: dayFromToday(5), start_time: "09:00:00", price: 35, capacity: 8, booked: 7 }],
  });
  backend.rpc.get_coaches_public = [
    { ...coachRow, coach_position: "Head coach", positions: ["Midfield"], session_types: ["in-person"] },
    { id: ORG.jordan, name: "Jordan Lee", slug: "jordan-lee", coach_position: "Sculling coach", positions: [], session_types: ["video"], hourly_rate: 70, age_min: 12, age_max: 18, profile_image_url: null, image_url: null, listed: true },
  ];
  backend.functions["organization-email"] = { link: "http://localhost:5199/org-invite/new", emailed: true };
  backend.rpc.cancel_organization_invite = null;
  backend.functions["create-package-payment"] = { url: "https://checkout.stripe.com/c/pay/cs_test_e2e_academy" };
  return state;
};

/** get_organization_invite for ORG.token; respond_organization_invite marks it answered. */
export const seedOrgInvite = (backend: MockBackend, invite: Row = {}) => {
  const state: Row = {
    kind: "join",
    status: "pending",
    rate: 20,
    current_rate: null,
    organization: "Hudson Rowing Academy",
    owner: "Morgan Hale",
    is_coach: true,
    in_other_org: false,
    ...invite,
  };
  backend.rpc.get_organization_invite = (args: Row) => (args.p_token === ORG.token ? state : null);
  backend.rpc.respond_organization_invite = (args: Row) => {
    state.status = args.p_accept ? "accepted" : "declined";
    return null;
  };
  return state;
};
