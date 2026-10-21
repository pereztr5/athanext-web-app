import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as backend from "../../../../backend/supabase/functions/_shared/fees.ts";
import { formatFeeBreakdown } from "../feeDisplay";
import { checkoutFees, feeLine, feeRows, parseFeeConfig, type FeeConfig, type FeeKind } from "../fees";

const config: FeeConfig = { platformPercent: 10, processingPercent: 2.9, processingFixedCents: 30 };
const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("one fee definition", () => {
  it("frontend utils/fees.ts is a byte-identical copy of the edge functions' _shared/fees.ts", () => {
    // Edit backend/supabase/functions/_shared/fees.ts, then copy it to frontend/src/utils/fees.ts.
    expect(source("../fees.ts")).toBe(source("../../../../backend/supabase/functions/_shared/fees.ts"));
  });

  it("shows the same total the payment functions charge, for every kind and price", () => {
    const kinds: FeeKind[] = ["session", "package", "org_package", "invoice"];
    for (let cents = 0; cents <= 100000; cents += 137) {
      for (const kind of kinds) {
        for (const waived of [false, true]) {
          expect(feeLine(cents, kind, config, waived)).toEqual(backend.feeLine(cents, kind, config, waived));
        }
      }
    }
    const items = [
      { listCents: 4500, kind: "session" as const },
      { listCents: 6000, kind: "session" as const, platformWaived: true },
      { listCents: 9999, kind: "session" as const },
    ];
    expect(checkoutFees(items, config)).toEqual(backend.checkoutFees(items, config));
  });
});

describe("feeLine", () => {
  it("org package: $280 list shows $308, all of it a platform fee", () => {
    const line = feeLine(28000, "org_package", config);
    expect(line).toEqual({ listCents: 28000, platformCents: 2800, processingCents: 0, totalCents: 30800 });
    expect(feeRows(line)).toEqual([{ label: "Platform fee", cents: 2800 }]);
    expect(formatFeeBreakdown(line, "package")).toBe("$280.00 package + $28.00 platform fee");
  });

  it("$60 session: 10% platform fee, card processing grossed up on the total", () => {
    const line = feeLine(6000, "session", config);
    expect(line).toEqual({ listCents: 6000, platformCents: 600, processingCents: 228, totalCents: 6828 });
    expect(feeRows(line)).toEqual([
      { label: "Platform fee", cents: 600 },
      { label: "Card processing", cents: 228 },
    ]);
    expect(formatFeeBreakdown(line)).toBe("$60.00 session + $6.00 platform fee + $2.28 card processing");
  });

  it("$0 is free", () => {
    expect(feeLine(0, "session", config).totalCents).toBe(0);
    expect(feeRows(feeLine(0, "session", config))).toEqual([]);
  });

  it("existing client: no platform fee, card processing still applies", () => {
    const line = feeLine(6000, "session", config, true);
    expect(line).toEqual({ listCents: 6000, platformCents: 0, processingCents: 210, totalCents: 6210 });
    expect(formatFeeBreakdown(line, "session", true)).toBe("$60.00 session + no platform fee (existing client) + $2.10 card processing");
  });

  it("a Checkout's lines add up to its total and the $0.30 is charged once", () => {
    const fees = checkoutFees(
      [
        { listCents: 5000, kind: "session" },
        { listCents: 5000, kind: "session" },
      ],
      config
    );
    expect(fees.totalCents).toBe(Math.round((10000 + 1000 + 30) / 0.971));
    expect(fees.lines[0].totalCents + fees.lines[1].totalCents).toBe(fees.totalCents);
  });
});

describe("parseFeeConfig", () => {
  it("refuses missing rates instead of showing a price without fees", () => {
    expect(() => parseFeeConfig([])).toThrow();
    expect(() => parseFeeConfig([{ key: "platform_fees", value: "10" }])).toThrow();
  });
});
