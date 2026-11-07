import type { MockBackend } from "./backend";

// Answers for RPCs that the app shell calls on every signed-in page, so a test that doesn't
// care about them gets a quiet, realistic "nothing new". Tests override these per case by
// assigning backend.rpc[name] / backend.functions[name].
export const seedDefaults = (backend: MockBackend) => {
  // Linking camp sign-ups made before the account existed (AuthContext, family accounts).
  backend.rpc.claim_camp_registrations = { claimed: 0, athletes_created: 0, athletes_merged: 0 };
};
