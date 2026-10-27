import { describe, expect, it } from "vitest";
import type { CoachCamp } from "@/api/camps";
import {
  CAMP_TIMES,
  campDayCount,
  campMissing,
  campPagePathFor,
  campPath,
  campShareUrl,
  campSourceFromSearch,
  campStepAnswered,
  draftToPayload,
  emptyCampDraft,
  emptyCampForm,
  formatCampDates,
  formatCampMoney,
  formatCampTimes,
  campOverlapNotice,
  campHeldNextStep,
  groupEndOptions,
  missingLine,
  moveGroupStart,
  newGroup,
  parseCampRoute,
  parsePriceCents,
  perDayLine,
  pickCampDay,
  runAgainDraft,
  validateCampForm,
  CAMP_WAIVER_MAX_BYTES,
  campReviewPayment,
  campWaiverFileError,
  campWaiverUrl,
  campWaiverUrlError,
  type CampDraft,
  type CampForm,
} from "@/utils/camps";

const NOW = new Date("2026-10-22T12:00:00Z");
const TODAY = "2026-10-22";
const groups = [
  { id: "g-elite", full: false },
  { id: "g-full", full: true },
];

const filledForm = (): CampForm => ({
  parent: { name: "Maria Rivera", email: "maria@example.com", phone: "+12395550142" },
  athletes: [{ first: "Diego", last: "Rivera", year: "2013", groupId: "g-elite", note: "" }],
  waiver: true,
});

const readyDraft = (): CampDraft => ({
  ...emptyCampDraft(),
  name: "Thanksgiving GK camp",
  startsOn: "2026-11-23",
  endsOn: "2026-11-26",
  location: "Paradise Coast Sports Complex",
  price: "260",
});

describe("camp link", () => {
  it("is athanext.com/<coach>/<camp>, and the share link marks the coach's own families", () => {
    expect(campPath("brayan", "thanksgiving-camp")).toBe("/brayan/thanksgiving-camp");
    expect(campShareUrl("https://athanext.com", "brayan", "thanksgiving-camp")).toBe("https://athanext.com/brayan/thanksgiving-camp?src=link");
    expect(campSourceFromSearch("?src=link&x=1")).toBe("link");
    expect(campSourceFromSearch("?src=instagram")).toBeNull();
  });

  it("sends profile camp cards to the camp page (no src) only when the camp has a published link", () => {
    expect(campPagePathFor("brayan", { slug: "fall-camp", published: true })).toBe("/brayan/fall-camp");
    expect(campPagePathFor("brayan", { slug: "fall-camp" })).toBe("/brayan/fall-camp");
    expect(campPagePathFor("brayan", { slug: "fall-camp", published: false })).toBeNull();
    expect(campPagePathFor("brayan", { slug: null, published: true })).toBeNull();
    expect(campPagePathFor(null, { slug: "fall-camp", published: true })).toBeNull();
  });

  it("parses the two route segments and refuses ones that can't be a camp link", () => {
    expect(parseCampRoute("brayan", "thanksgiving-camp")).toEqual({ coachSlug: "brayan", campSlug: "thanksgiving-camp" });
    expect(parseCampRoute("Brayan-G", "Thanksgiving-Camp")).toEqual({ coachSlug: "Brayan-G", campSlug: "thanksgiving-camp" });
    expect(parseCampRoute("brayan", "")).toBeNull();
    expect(parseCampRoute(undefined, "camp")).toBeNull();
    expect(parseCampRoute("brayan", "camp--two")).toBeNull();
    expect(parseCampRoute("brayan", "camp_two")).toBeNull();
    expect(parseCampRoute("bra yan", "camp")).toBeNull();
    expect(parseCampRoute("brayan", "x".repeat(81))).toBeNull();
  });
});

describe("sign-up form", () => {
  it("passes a filled form", () => {
    expect(validateCampForm(filledForm(), groups, NOW)).toEqual({});
  });

  it("uses the mockup's copy for every missing field", () => {
    const errors = validateCampForm({ ...emptyCampForm(), athletes: [{ first: "", last: "", year: "", groupId: "g-elite", note: "" }] }, groups, NOW);
    expect(errors).toEqual({
      "parent.name": "Add your name",
      "parent.email": "Add an email we can send the receipt to",
      "athletes.0.first_name": "Add a first name",
      "athletes.0.last_name": "Add a last name",
      "athletes.0.birth_year": "Add a birth year, like 2013",
      waiver: "Agree to the waiver to continue",
    });
  });

  it("checks the email, an optional phone and the birth year range", () => {
    const form = filledForm();
    form.parent.email = "maria@";
    form.parent.phone = "call me";
    form.athletes[0].year = "2025";
    const errors = validateCampForm(form, groups, NOW);
    expect(errors["parent.email"]).toBe("Add an email we can send the receipt to");
    expect(errors["parent.phone"]).toBe("Add a phone number with the country code");
    expect(errors["athletes.0.birth_year"]).toBe("Add a birth year, like 2013");
    const noPhone = filledForm();
    noPhone.parent.phone = "";
    expect(validateCampForm(noPhone, groups, NOW)).toEqual({});
  });

  it("checks each sibling's group and refuses the same athlete twice", () => {
    const form = filledForm();
    form.athletes.push({ first: "Sofia", last: "Rivera", year: "2015", groupId: "", note: "" });
    form.athletes.push({ first: "Lucas", last: "Rivera", year: "2016", groupId: "g-full", note: "" });
    form.athletes.push({ first: "diego", last: "rivera", year: "2013", groupId: "g-elite", note: "" });
    const errors = validateCampForm(form, groups, NOW);
    expect(errors["athletes.1.group_id"]).toBe("Pick a group");
    expect(errors["athletes.2.group_id"]).toBe("This group is fully booked");
    expect(errors["athletes.3.first_name"]).toBe("diego is on the form twice");
    expect(errors["athletes.0.first_name"]).toBeUndefined();
  });
});

describe("group times", () => {
  it("offers half hours from 7am to 9pm", () => {
    expect(CAMP_TIMES[0]).toBe("07:00");
    expect(CAMP_TIMES[1]).toBe("07:30");
    expect(CAMP_TIMES[CAMP_TIMES.length - 1]).toBe("21:00");
    expect(groupEndOptions("20:00")).toEqual(["20:30", "21:00"]);
  });

  it("keeps the group's length when From changes, cut off at 9pm", () => {
    const group = { ...newGroup(), start: "09:00", end: "12:00" };
    expect(moveGroupStart(group, "10:30")).toMatchObject({ start: "10:30", end: "13:30" });
    expect(moveGroupStart(group, "19:30")).toMatchObject({ start: "19:30", end: "21:00" });
    expect(moveGroupStart(group, "21:00")).toMatchObject({ start: "20:30", end: "21:00" });
  });

  it("reads like the mockup", () => {
    expect(formatCampTimes("09:00", "12:30")).toBe("9am to 12:30pm ET");
    expect(formatCampTimes("09:00", "12:30", { zone: false })).toBe("9am to 12:30pm");
    expect(formatCampTimes(null, null)).toBe("");
  });
});

describe("dates", () => {
  it("moves the end with a later start, swaps an earlier end, and the same day twice is one day", () => {
    expect(pickCampDay({ startsOn: null, endsOn: null }, "start", "2026-11-23")).toEqual({ startsOn: "2026-11-23", endsOn: "2026-11-23" });
    expect(pickCampDay({ startsOn: "2026-11-23", endsOn: "2026-11-23" }, "end", "2026-11-26")).toEqual({ startsOn: "2026-11-23", endsOn: "2026-11-26" });
    expect(pickCampDay({ startsOn: "2026-11-23", endsOn: "2026-11-26" }, "start", "2026-11-28")).toEqual({ startsOn: "2026-11-28", endsOn: "2026-11-28" });
    expect(pickCampDay({ startsOn: "2026-11-23", endsOn: "2026-11-26" }, "end", "2026-11-20")).toEqual({ startsOn: "2026-11-20", endsOn: "2026-11-23" });
    expect(campDayCount("2026-11-23", "2026-11-23")).toBe(1);
    expect(campDayCount("2026-11-23", "2026-11-26")).toBe(4);
    expect(campDayCount("2026-11-26", "2026-11-23")).toBe(0);
  });

  it("formats dates like the camp page", () => {
    expect(formatCampDates("2026-11-23", "2026-11-26")).toBe("Mon to Thu, Nov 23 to 26");
    expect(formatCampDates("2026-11-28", "2026-11-28")).toBe("Sat, Nov 28");
    expect(formatCampDates("2026-11-30", "2026-12-02")).toBe("Mon, Nov 30 to Wed, Dec 2");
  });
});

describe("price", () => {
  it("takes dollars between $1 and $10,000", () => {
    expect(parsePriceCents("260")).toBe(26000);
    expect(parsePriceCents("$1,250.5")).toBe(125050);
    expect(parsePriceCents("0.50")).toBeNull();
    expect(parsePriceCents("10001")).toBeNull();
    expect(parsePriceCents("abc")).toBeNull();
  });

  it("shows the daily price under it", () => {
    expect(perDayLine(26000, 4)).toBe("4 days · $65 a day");
    expect(perDayLine(26000, 1)).toBe("1 day");
    expect(formatCampMoney(6550)).toBe("$65.50");
  });
});

describe("editor: what is still missing", () => {
  it("lists every required answer until it's there", () => {
    const missing = campMissing(emptyCampDraft(), TODAY);
    expect(missing).toEqual(["camp name", "dates", "location", "price per athlete"]);
    expect(missingLine(missing)).toBe("Still missing: camp name, dates, location, price per athlete");
    expect(campMissing(readyDraft(), TODAY)).toEqual([]);
    expect(missingLine([])).toBeNull();
  });

  it("needs group names once there are two groups, and dates from today on", () => {
    const draft = readyDraft();
    draft.groups = [newGroup(), newGroup()];
    expect(campStepAnswered("groups", draft, TODAY)).toBe(false);
    expect(campMissing(draft, TODAY)).toEqual(["group names"]);
    draft.groups = draft.groups.map((g, i) => ({ ...g, name: i ? "Youth" : "Elite" }));
    expect(campMissing(draft, TODAY)).toEqual([]);
    expect(campMissing({ ...draft, startsOn: "2026-10-01", endsOn: "2026-10-02" }, TODAY)).toEqual(["dates from today on"]);
  });

  it("lets Next through only with an answer; details is optional", () => {
    const draft = emptyCampDraft();
    expect(campStepAnswered("name", draft, TODAY)).toBe(false);
    expect(campStepAnswered("name", { ...draft, name: "Camp" }, TODAY)).toBe(true);
    expect(campStepAnswered("price", { ...draft, price: "0" }, TODAY)).toBe(false);
    expect(campStepAnswered("details", draft, TODAY)).toBe(true);
  });

  it("builds the save payload: a one-day camp ends on its start day", () => {
    const { camp, groups: list } = draftToPayload({ ...readyDraft(), endsOn: null, included: [" Camp jersey ", ""] });
    expect(camp).toMatchObject({ name: "Thanksgiving GK camp", price_cents: 26000, starts_on: "2026-11-23", ends_on: "2026-11-23", included: ["Camp jersey"] });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ start_time: "09:00", end_time: "12:00", spots: 12 });
    expect(list[0]).not.toHaveProperty("id");
  });
});

describe("run a camp again", () => {
  const saved: CoachCamp = {
    id: "camp-1",
    coach_id: "coach-1",
    name: "Summer GK camp",
    description: "Keepers only",
    price_cents: 30000,
    starts_on: "2026-07-06",
    ends_on: "2026-07-09",
    days: 4,
    location: "Paradise Coast Sports Complex",
    capacity: 24,
    taken: 20,
    slug: "summer-gk-camp",
    coach_slug: "brayan",
    cover_url: "https://example.com/cover.jpg",
    included: ["Camp jersey"],
    tags: [],
    pay_direct: true,
    linked_coach: { id: "coach-2", name: "Ana Diaz", slug: "ana", photo_url: null },
    co_coach_ids: [],
    age_min: null,
    age_max: null,
    is_active: true,
    published: true,
    published_at: "2026-06-01T00:00:00Z",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    groups: [
      { id: "g1", name: "Elite", description: "U15 to U18", start_time: "08:00", end_time: "10:00", spots: 12, taken: 10, sort_order: 0 },
      { id: "g2", name: "Youth", description: null, start_time: "10:30", end_time: "12:00", spots: 12, taken: 10, sort_order: 1 },
    ],
  };

  it("fills everything but the dates, as new groups", () => {
    const draft = runAgainDraft(saved);
    expect(draft.startsOn).toBeNull();
    expect(draft.endsOn).toBeNull();
    expect(draft).toMatchObject({
      name: "Summer GK camp",
      location: "Paradise Coast Sports Complex",
      price: "300",
      coverUrl: "https://example.com/cover.jpg",
      included: ["Camp jersey"],
      payDirect: true,
      linkedCoach: { id: "coach-2" },
    });
    expect(draft.groups.map((g) => [g.name, g.start, g.end, g.spots, g.id])).toEqual([
      ["Elite", "08:00", "10:00", 12, undefined],
      ["Youth", "10:30", "12:00", 12, undefined],
    ]);
    expect(campMissing(draft, TODAY)).toEqual(["dates"]);
  });
});

describe("waiver", () => {
  it("takes https links only, like save_camp", () => {
    expect(campWaiverUrl(" https://example.com/waiver.pdf ")).toBe("https://example.com/waiver.pdf");
    expect(campWaiverUrl("https://docs.google.com/document/d/abc/edit?usp=sharing")).toBe(
      "https://docs.google.com/document/d/abc/edit?usp=sharing",
    );
    for (const bad of ["http://example.com/w.pdf", "javascript:alert(1)", "https://", "https://localhost/w.pdf", "https://a b.com", "example.com/w.pdf"]) {
      expect(campWaiverUrl(bad)).toBeNull();
      expect(campWaiverUrlError(bad)).toBe("Add a link that starts with https://");
    }
    expect(campWaiverUrl(`https://example.com/${"a".repeat(1000)}`)).toBeNull();
    expect(campWaiverUrlError("")).toBeNull();
    expect(campWaiverUrlError("   ")).toBeNull();
    expect(campWaiverUrl(null)).toBeNull();
  });

  it("uploads PDFs up to 10 MB", () => {
    expect(campWaiverFileError({ name: "waiver.pdf", type: "application/pdf", size: 200_000 })).toBeNull();
    expect(campWaiverFileError({ name: "waiver.pdf", type: "", size: 200_000 })).toBeNull();
    expect(campWaiverFileError({ name: "waiver.png", type: "image/png", size: 200_000 })).toBe("Choose a PDF file.");
    expect(campWaiverFileError({ name: "waiver.pdf", type: "application/pdf", size: CAMP_WAIVER_MAX_BYTES + 1 })).toBe(
      "The waiver must be under 10 MB.",
    );
    expect(campWaiverFileError({ name: "waiver.pdf", type: "application/pdf", size: 0 })).not.toBeNull();
  });

  it("is optional: saved when valid, null when empty, and a bad link is listed as missing", () => {
    const draft = { ...emptyCampDraft(), name: "Summer camp" };
    expect(draftToPayload(draft).camp.waiver_url).toBeNull();
    expect(campMissing(draft, TODAY)).not.toContain("a waiver link that starts with https://");
    expect(draftToPayload({ ...draft, waiverUrl: "https://example.com/w.pdf" }).camp.waiver_url).toBe("https://example.com/w.pdf");
    expect(campMissing({ ...draft, waiverUrl: "http://example.com/w.pdf" }, TODAY)).toContain("a waiver link that starts with https://");
  });
});

describe("paying the coach directly", () => {
  it("is on for new camps", () => {
    expect(emptyCampDraft().payDirect).toBe(true);
    expect(draftToPayload(emptyCampDraft()).camp.pay_direct).toBe(true);
  });

  it("is offered to any family when the camp allows it, with no card processing", () => {
    const quote = {
      direct_allowed: true,
      card: { listCents: 50000, platformCents: 0, processingCents: 1524, totalCents: 51524 },
    };
    expect(campReviewPayment(quote, "card", 50000)).toEqual({
      direct: false,
      directOffered: true,
      listCents: 50000,
      feeCents: 1524,
      totalCents: 51524,
    });
    expect(campReviewPayment(quote, "direct", 50000)).toEqual({
      direct: true,
      directOffered: true,
      listCents: 50000,
      feeCents: null,
      totalCents: 50000,
    });
    // Switch off: card only, even if "direct" was picked earlier.
    const cardOnly = campReviewPayment({ ...quote, direct_allowed: false }, "direct", 50000);
    expect(cardOnly.direct).toBe(false);
    expect(cardOnly.directOffered).toBe(false);
    expect(cardOnly.totalCents).toBe(51524);
    // Quote still loading: no total for card yet.
    expect(campReviewPayment(undefined, "card", 50000)).toMatchObject({ direct: false, feeCents: null, totalCents: null });
  });
});

describe("campOverlapNotice", () => {
  it("says how many open times close and how many booked sessions block publishing", () => {
    expect(campOverlapNotice({ open: 3, booked: 0 })).toEqual({
      closes: "3 open 1-on-1 times overlap this camp and will be closed while it's published.",
      blocks: null,
    });
    expect(campOverlapNotice({ open: 1, booked: 1 })).toEqual({
      closes: "1 open 1-on-1 time overlaps this camp and will be closed while it's published.",
      blocks: "1 booked session overlaps this camp. Move it before you publish.",
    });
    expect(campOverlapNotice({ open: 0, booked: 2 }).blocks).toBe("2 booked sessions overlap this camp. Move them before you publish.");
  });

  it("stays quiet with nothing to say", () => {
    expect(campOverlapNotice(null)).toEqual({ closes: null, blocks: null });
    expect(campOverlapNotice({ open: 0, booked: 0 })).toEqual({ closes: null, blocks: null });
  });
});

describe("campHeldNextStep", () => {
  it("tells the family how to pay the coach", () => {
    expect(campHeldNextStep("Riley")).toBe("Pay Riley directly (cash, Zelle or Venmo). They'll mark you paid, and you'll get an email.");
    expect(campHeldNextStep(" ")).toBe("Pay your coach directly (cash, Zelle or Venmo). They'll mark you paid, and you'll get an email.");
  });
});
