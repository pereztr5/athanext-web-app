import { describe, it, expect } from "vitest";
import { isReadyFamily, parseInviteList, sendLabel } from "@/utils/invites";

describe("parseInviteList", () => {
  it("reads pasted rows and CSV with a header", () => {
    const text = [
      "Parent name,Parent email,Athlete first name",
      "Dana Lee, Dana@Example.com ,Mia",
      '"Smith, Jo",jo@example.com',
      "Sam Ray\tsam@example.com\tLeo",
    ].join("\n");
    expect(parseInviteList(text).rows).toEqual([
      { name: "Dana Lee", email: "dana@example.com", athleteFirstName: "Mia" },
      { name: "Smith, Jo", email: "jo@example.com", athleteFirstName: "" },
      { name: "Sam Ray", email: "sam@example.com", athleteFirstName: "Leo" },
    ]);
  });

  it("skips missing names, bad emails, existing clients and repeats", () => {
    const text = [
      ",nobody@example.com",
      "Al,not-an-email",
      "Bo,",
      "Cy,known@example.com",
      "Di,di@example.com",
      "Di again,DI@example.com",
    ].join("\n");
    const { rows, skipped } = parseInviteList(text, ["Known@example.com"]);
    expect(rows.map((r) => r.email)).toEqual(["di@example.com"]);
    expect(skipped.map((s) => [s.line, s.reason])).toEqual([
      [1, "Missing parent name"],
      [2, "Email looks wrong"],
      [3, "Missing parent email"],
      [4, "Already a client or invited"],
      [6, "Listed twice"],
    ]);
  });

  it("lists every line in order, ready or skipped", () => {
    const { lines } = parseInviteList("Parent name,Email\nDana Lee,dana@example.com,Mia\n,x@example.com\nSam,sam@", []);
    expect(lines).toEqual([
      { line: 2, name: "Dana Lee", athleteFirstName: "Mia", reason: null },
      { line: 3, name: "", athleteFirstName: "", reason: "Missing parent name" },
      { line: 4, name: "Sam", athleteFirstName: "", reason: "Email looks wrong" },
    ]);
  });
});

describe("invite rows", () => {
  it("needs a name and a valid email", () => {
    expect(isReadyFamily({ name: " ", email: "a@b.co", athleteFirstName: "" })).toBe(false);
    expect(isReadyFamily({ name: "A", email: "a@b", athleteFirstName: "" })).toBe(false);
    expect(isReadyFamily({ name: "A", email: " a@b.co ", athleteFirstName: "" })).toBe(true);
  });

  it("labels the send button", () => {
    expect(sendLabel(0)).toBe("Send invite");
    expect(sendLabel(1)).toBe("Send invite");
    expect(sendLabel(3)).toBe("Send 3 invites");
  });
});
