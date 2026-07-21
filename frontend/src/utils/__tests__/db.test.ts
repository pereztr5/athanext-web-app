import { describe, it, expect } from "vitest";
import { normalizePosition, normalizeAthletePosition } from "@/utils/db";

describe("normalizePosition", () => {
  it("maps soccer positions to Goalkeeper or Field Player", () => {
    expect(normalizePosition("Soccer", "goalkeeper")).toBe("Goalkeeper");
    expect(normalizePosition("soccer", "striker")).toBe("Field Player");
  });
  it("maps rowing positions to Coxswain or Rower", () => {
    expect(normalizePosition("Rowing", "coxswain")).toBe("Coxswain");
    expect(normalizePosition("rowing", "port")).toBe("Rower");
  });
  it("passes through unknown sports unchanged", () => {
    expect(normalizePosition("tennis", "Server")).toBe("Server");
  });
  it("returns empty string for empty position", () => {
    expect(normalizePosition("soccer", "")).toBe("");
  });
  it("treats null sport as unknown sport (passthrough)", () => {
    expect(normalizePosition(null, "x")).toBe("x");
  });
});

describe("normalizeAthletePosition", () => {
  it("maps detailed soccer positions", () => {
    expect(normalizeAthletePosition("soccer", "goalie")).toBe("Goalkeeper");
    expect(normalizeAthletePosition("soccer", "central midfield")).toBe("Midfielder");
    expect(normalizeAthletePosition("soccer", "left wing")).toBe("Winger");
    expect(normalizeAthletePosition("soccer", "striker")).toBe("Forward");
    expect(normalizeAthletePosition("soccer", "field player")).toBe("Midfielder");
  });
  it("checks 'defend' before 'mid' (defensive midfielder becomes Defender)", () => {
    expect(normalizeAthletePosition("soccer", "defending midfielder")).toBe("Defender");
  });
  it("maps detailed rowing positions", () => {
    expect(normalizeAthletePosition("rowing", "coxswain")).toBe("Coxswain");
    expect(normalizeAthletePosition("rowing", "stroke seat")).toBe("Stroke");
    expect(normalizeAthletePosition("rowing", "starboard")).toBe("Starboard");
  });
  it("passes through unmatched positions with original casing", () => {
    expect(normalizeAthletePosition("soccer", "Libero")).toBe("Libero");
  });
});
