import { describe, expect, it } from "vitest";
import { appPathFor, offerBubbleText, splitMessageLinks } from "../messageLinks";

const ORIGIN = "https://athanext-staging.vercel.app";

describe("splitMessageLinks", () => {
  it("keeps text without links as one part", () => {
    expect(splitMessageLinks("See you Tuesday", ORIGIN)).toEqual([{ kind: "text", text: "See you Tuesday" }]);
  });

  it("turns a shared session link into an in-app path", () => {
    const parts = splitMessageLinks(`Book here: ${ORIGIN}/michael?session=abc.`, ORIGIN);
    expect(parts).toEqual([
      { kind: "text", text: "Book here: " },
      { kind: "link", text: `${ORIGIN}/michael?session=abc`, href: `${ORIGIN}/michael?session=abc`, appPath: "/michael?session=abc" },
      { kind: "text", text: "." },
    ]);
  });

  it("opens other sites outside the app", () => {
    const parts = splitMessageLinks("Map: https://maps.google.com/x and more", ORIGIN);
    expect(parts[1]).toMatchObject({ kind: "link", href: "https://maps.google.com/x", appPath: null });
    expect(parts[2]).toEqual({ kind: "text", text: " and more" });
  });
});

describe("appPathFor", () => {
  it("treats athanext.com hosts as the app", () => {
    expect(appPathFor("https://app.athanext.com/invoices/1", ORIGIN)).toBe("/invoices/1");
    expect(appPathFor("https://athanext.com/brayan/camp", ORIGIN)).toBe("/brayan/camp");
  });

  it("rejects other hosts and bad URLs", () => {
    expect(appPathFor("https://evil.example/athanext.com", ORIGIN)).toBeNull();
    expect(appPathFor("not a url", ORIGIN)).toBeNull();
  });
});

describe("offerBubbleText", () => {
  it("drops the booking link the card already has", () => {
    expect(offerBubbleText(`Riley offered a 1-on-1 session on Wed, Oct 28 at 6:00 pm. Book it here: ${ORIGIN}/coach/riley?session=abc`)).toBe(
      "Riley offered a 1-on-1 session on Wed, Oct 28 at 6:00 pm.",
    );
    expect(offerBubbleText(`Casey, I have 2 sessions for you ($170). Book and pay here: ${ORIGIN}/coach/x?session=1`)).toBe(
      "Casey, I have 2 sessions for you ($170).",
    );
    expect(offerBubbleText(`Next week's sessions are up. Tick the ones you're in for and pay once. ${ORIGIN}/offers/1`)).toBe(
      "Next week's sessions are up. Tick the ones you're in for and pay once.",
    );
  });

  it("leaves a message without links alone", () => {
    expect(offerBubbleText("Thanks for the intro call!")).toBe("Thanks for the intro call!");
  });
});
