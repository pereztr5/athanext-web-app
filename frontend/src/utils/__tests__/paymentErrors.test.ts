import { describe, expect, it } from "vitest";
import { functionPaymentError, PAYMENT_FALLBACK, paymentErrorMessage, readFunctionError } from "../paymentErrors";

describe("paymentErrorMessage", () => {
  it("keeps messages written for families", () => {
    expect(paymentErrorMessage("You already have a booking for this session.")).toBe(
      "You already have a booking for this session."
    );
    expect(paymentErrorMessage(new Error("Your earlier payment for this session went through. Check My sessions."))).toBe(
      "Your earlier payment for this session went through. Check My sessions."
    );
  });

  it("hides database and missing-field errors", () => {
    expect(paymentErrorMessage('duplicate key value violates unique constraint "x"')).toBe(PAYMENT_FALLBACK);
    expect(paymentErrorMessage("athlete_id is required")).toBe(PAYMENT_FALLBACK);
    expect(paymentErrorMessage("Edge Function returned a non-2xx status code")).toBe(PAYMENT_FALLBACK);
    expect(paymentErrorMessage("An unknown error occurred")).toBe(PAYMENT_FALLBACK);
  });

  it("explains network, sign-in, capacity and setup problems", () => {
    expect(paymentErrorMessage("Failed to fetch")).toMatch(/connection/);
    expect(paymentErrorMessage("Invalid authentication token")).toMatch(/Sign in again/);
    expect(paymentErrorMessage("Occurrence on 2026-10-30 is fully booked")).toBe("That time just filled up. Pick another time.");
    expect(paymentErrorMessage("Payments aren't set up yet. Please try again later.")).toMatch(/aren't available/);
    expect(paymentErrorMessage("No such customer: 'cus_123'")).toMatch(/aren't available/);
  });

  it("uses the fallback for empty input", () => {
    expect(paymentErrorMessage("")).toBe(PAYMENT_FALLBACK);
    expect(paymentErrorMessage(undefined)).toBe(PAYMENT_FALLBACK);
    expect(paymentErrorMessage(null, "Couldn't book.")).toBe("Couldn't book.");
  });
});

describe("readFunctionError", () => {
  it("reads the function's JSON error body", async () => {
    const error = { message: "Edge Function returned a non-2xx status code", context: { json: async () => ({ error: "Session not found." }) } };
    expect(await readFunctionError(error)).toBe("Session not found.");
  });

  it("falls back to the error message when the body isn't JSON", async () => {
    const error = { message: "Failed to fetch", context: { json: async () => { throw new Error("not json"); } } };
    expect(await readFunctionError(error)).toBe("Failed to fetch");
  });

  it("maps in one step", async () => {
    const error = { message: "x", context: { json: async () => ({ error: "athlete_id is required" }) } };
    expect(await functionPaymentError(error, "Couldn't book.")).toBe("Couldn't book.");
  });
});
