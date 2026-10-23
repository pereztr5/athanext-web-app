import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  checkoutFees,
  type FeeConfig,
  feeConfigFromMetadata,
  feeConfigMetadata,
  feeLine,
  feeRows,
  parseFeeConfig,
} from "./fees.ts";

const config: FeeConfig = { platformPercent: 10, processingPercent: 2.9, processingFixedCents: 30 };

Deno.test("org package: 10% platform fee only, $280 -> $308", () => {
  assertEquals(feeLine(28000, "org_package", config), {
    listCents: 28000,
    platformCents: 2800,
    processingCents: 0,
    totalCents: 30800,
  });
  assertEquals(feeRows(feeLine(28000, "org_package", config)), [{ label: "Platform fee", cents: 2800 }]);
});

Deno.test("org package ignores the existing-client waiver", () => {
  assertEquals(feeLine(28000, "org_package", config, true).totalCents, 30800);
});

Deno.test("$60 session: processing grossed up so Stripe's cut is covered", () => {
  const line = feeLine(6000, "session", config);
  assertEquals(line, { listCents: 6000, platformCents: 600, processingCents: 228, totalCents: 6828 });
  // Stripe keeps 2.9% + $0.30 of $68.28 = $2.28 (rounded), so AthaNext nets the $6 platform fee.
  assertEquals(Math.round(line.totalCents * 0.029 + 30), 228);
});

Deno.test("existing client: no platform fee, processing still applies", () => {
  assertEquals(feeLine(6000, "session", config, true), {
    listCents: 6000,
    platformCents: 0,
    processingCents: 210,
    totalCents: 6210,
  });
});

Deno.test("$0 is never charged", () => {
  assertEquals(feeLine(0, "session", config), { listCents: 0, platformCents: 0, processingCents: 0, totalCents: 0 });
});

Deno.test("invoice: processing only", () => {
  assertEquals(feeLine(10000, "invoice", config), {
    listCents: 10000,
    platformCents: 0,
    processingCents: 330,
    totalCents: 10330,
  });
});

Deno.test("a Checkout grosses up once and its lines add up to the total", () => {
  const fees = checkoutFees(
    [
      { listCents: 5000, kind: "session" },
      { listCents: 7000, kind: "session", platformWaived: true },
      { listCents: 0, kind: "session" },
    ],
    config,
  );
  assertEquals(fees.platformCents, 500);
  assertEquals(fees.totalCents, Math.round((5000 + 500 + 7000 + 30) / 0.971));
  assertEquals(fees.lines.reduce((n, l) => n + l.totalCents, 0), fees.totalCents);
  assertEquals(fees.lines[2].totalCents, 0);
  // The total doesn't depend on line order.
  const reversed = checkoutFees(
    [
      { listCents: 7000, kind: "session", platformWaived: true },
      { listCents: 5000, kind: "session" },
    ],
    config,
  );
  assertEquals(reversed.totalCents, fees.totalCents);
});

Deno.test("config parsing refuses missing values instead of using 0", () => {
  assertThrows(() => parseFeeConfig([{ key: "stripe_fees", value: "2.9" }]));
  assertThrows(() => parseFeeConfig(null));
  assertEquals(
    parseFeeConfig([
      { key: "platform_fees", value: "10" },
      { key: "stripe_fees", value: "2.9" },
      { key: "stripe_fee_fixed", value: "0.30" },
    ]),
    config,
  );
});

Deno.test("metadata round trip", () => {
  assertEquals(feeConfigFromMetadata(feeConfigMetadata(config)), config);
  assertEquals(feeConfigFromMetadata({ platform_fee_perc: "10" }), null);
});

Deno.test("camp: no platform fee for anyone, card processing only ($200 -> $206.28)", () => {
  const line = feeLine(20000, "camp", config);
  assertEquals(line, { listCents: 20000, platformCents: 0, processingCents: 628, totalCents: 20628 });
  // Same as an existing client's package: the waiver flag changes nothing for a camp.
  assertEquals(feeLine(20000, "camp", config, true), line);
  assertEquals(feeLine(20000, "package", config, true), line);
  assertEquals(feeRows(line), [{ label: "Card processing", cents: 628 }]);
});

Deno.test("camp: fixed processing charged once for several athletes", () => {
  const fees = checkoutFees([{ listCents: 15000, kind: "camp" }, { listCents: 15000, kind: "camp" }], config);
  assertEquals(fees.platformCents, 0);
  assertEquals(fees.listCents, 30000);
  // round((30000 + 30) / 0.971) = 30927
  assertEquals(fees.totalCents, 30927);
  assertEquals(fees.lines.map((l) => l.totalCents), [15464, 15463]);
});
