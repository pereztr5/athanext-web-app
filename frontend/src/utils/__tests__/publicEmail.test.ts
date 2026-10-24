import { describe, it, expect } from "vitest";
import { contactEmailRequest, parentInviteEmailRequest, partnershipEmailRequest } from "@/utils/publicEmail";

describe("public send-email requests", () => {
  it("contact sends fields only, never an address, subject or HTML", () => {
    const body = contactEmailRequest({
      fullName: " Pat Lee ",
      email: " Pat@Example.com ",
      subject: " Billing ",
      message: " <b>Hi</b> ",
    });
    expect(body).toEqual({ kind: "contact", name: "Pat Lee", email: "pat@example.com", topic: "Billing", message: "<b>Hi</b>" });
    expect(body).not.toHaveProperty("to");
    expect(body).not.toHaveProperty("subject");
    expect(body).not.toHaveProperty("html");
    expect(contactEmailRequest({ fullName: "Pat", email: "p@x.com", subject: "s", message: "m", phone: " 555 " })).toMatchObject({ phone: "555" });
  });

  it("partnership maps the inquiry text to message", () => {
    expect(
      partnershipEmailRequest({ name: "Sam", organization: " Club FC ", email: "Sam@Club.org", partnershipInterest: " Let's talk " })
    ).toEqual({ kind: "partnership", name: "Sam", organization: "Club FC", email: "sam@club.org", message: "Let's talk" });
  });

  it("parent invite sends the picks, at most three pillars, no link or HTML", () => {
    const body = parentInviteEmailRequest({
      email: " Parent@Example.com ",
      sport: "Soccer",
      pos: null,
      level: "Club",
      pillars: ["A", "B", "C", "D"],
      age: "12",
      zip: "",
    });
    expect(body).toEqual({
      kind: "parent_invite",
      email: "parent@example.com",
      sport: "Soccer",
      position: undefined,
      level: "Club",
      pillars: ["A", "B", "C"],
      age: "12",
      zip: undefined,
    });
    expect(JSON.stringify(body)).not.toMatch(/html|http/);
  });
});
