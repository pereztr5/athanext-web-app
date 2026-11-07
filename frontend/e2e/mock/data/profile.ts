import zlib from "node:zlib";
import type { MockBackend } from "../backend";
import { IDS } from "../personas";
import { seedPillars } from "./auth";
import { seedCoachLookup } from "./business";
import { installSchedule } from "./schedule";

// My profile (/profile) for a coach and an athlete, and Create your profile.
// The coach row comes from `coaches` with its user_profiles embed (sport, gender, ZIP), as
// useCoachDetails reads it; pillars from sport_pillars. Saves go to coaches (PATCH),
// user_profiles (upsert), coach_certifications (upsert) and athalink-images in storage.

type Row = Record<string, unknown>;

export const PROFILE = {
  certification: "0000ce70-0000-4000-8000-000000000001",
} as const;

/** Casey's own profile: a soccer coach with the sport's pillars to pick from. */
export const seedOwnCoachProfile = (backend: MockBackend) => {
  seedCoachLookup(backend);
  seedPillars(backend);
  installSchedule(backend);
  const coach = backend.table("coaches").find((c) => c.id === IDS.coach)!;
  coach.user_profiles = [{ id: IDS.coachUser, sport: "soccer", gender: null, zip_code: "10001" }];
  coach.pathway_tags = ["Youth Development"];
  backend.rpc.set_my_coach_coordinates = null;
  return coach;
};

/** get_athlete_profile_stats for Alex. */
export const seedAthleteStats = (backend: MockBackend, stats: Row = {}) => {
  backend.rpc.get_athlete_profile_stats = { sessions_completed: 12, hours_trained: 14, coaches_worked_with: 2, average_rating: 4.8, ...stats };
};

/** A parent or athlete account with no athlete_profiles row yet. */
export const withoutAthleteProfile = (backend: MockBackend) => {
  backend.tables.athlete_profiles = backend.table("athlete_profiles").filter((r) => r.id !== IDS.athleteProfile);
};

// A 64x64 solid-colour PNG, built here so the cropper has real pixels to work with.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const makePng = (size: number) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0x3c)]);
  const pixels = zlib.deflateSync(Buffer.concat(Array.from({ length: size }, () => row)));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", pixels), chunk("IEND", Buffer.alloc(0))]);
};
const PNG_BYTES = makePng(64);

/** A small but real PNG for photo pickers and the cropper. */
export const photoFile = (name = "portrait.png") => ({ name, mimeType: "image/png", buffer: PNG_BYTES });
