import { describe, expect, it } from "vitest";
import { errorMessage } from "../errorMessage";

describe("errorMessage", () => {
  it("reads the message from an Error", () => {
    expect(errorMessage(new Error("Boom"), "Try again.")).toBe("Boom");
  });

  it("reads the message from a supabase-js PostgREST error object", () => {
    const err = { code: "P0001", message: "Your free plan has ended", details: null, hint: null };
    expect(errorMessage(err, "Try again.")).toBe("Your free plan has ended");
  });

  it("reads a thrown string", () => {
    expect(errorMessage("Nope", "Try again.")).toBe("Nope");
  });

  it("falls back when there is no usable message", () => {
    expect(errorMessage(new Error(""), "Try again.")).toBe("Try again.");
    expect(errorMessage({ message: "   " }, "Try again.")).toBe("Try again.");
    expect(errorMessage({ message: 42 }, "Try again.")).toBe("Try again.");
    expect(errorMessage({ code: "500" }, "Try again.")).toBe("Try again.");
    expect(errorMessage(null, "Try again.")).toBe("Try again.");
    expect(errorMessage(undefined, "Try again.")).toBe("Try again.");
  });

  it("returns undefined without a fallback", () => {
    expect(errorMessage(null)).toBeUndefined();
    expect(errorMessage({ message: "Server said no" })).toBe("Server said no");
  });
});
