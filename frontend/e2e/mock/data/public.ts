import type { MockBackend } from "../backend";

// Rows for the public pages: Contact us details, the Resources marketplace and site configuration.

export const PARTNERSHIP_IDS = {
  video: "0000ba00-0000-4000-8000-000000000001",
  erg: "0000ba00-0000-4000-8000-000000000002",
} as const;

export const seedContactInfo = (backend: MockBackend) => {
  backend.seed("contact_us", [
    { id: "0000ca00-0000-4000-8000-000000000001", email: "hello@e2e.test", contact_number: "+1 555 555 0199", location: "Austin, TX", created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
  ]);
};

export const seedPartnerships = (backend: MockBackend) => {
  backend.seed("partnerships", [
    {
      id: PARTNERSHIP_IDS.video,
      name: "Match Video Analysis",
      description: "Frame-by-frame breakdown of your games.",
      detailed_description: "An analyst reviews a full match and sends back clips with notes.",
      logo: "",
      status: "Available Now",
      price: 4900,
      cta_label: "Purchase",
      sport_type: "soccer",
      features: ["Tagged clips", "Written notes"],
      benefits: ["See your decisions on film"],
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
    },
    {
      id: PARTNERSHIP_IDS.erg,
      name: "Erg Training Plans",
      description: "Twelve-week plans for rowers.",
      logo: "",
      status: "Coming Soon",
      price: 0,
      cta_label: "Get updates",
      sport_type: "rowing",
      features: [],
      benefits: [],
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
    },
  ]);
};

export const seedAdminEmail = (backend: MockBackend, email = "coaches@e2e.test") => {
  backend.seed("configurations", [{ id: "0000cf00-0000-4000-8000-000000000001", key: "contact_admin_email", value: email }]);
};
