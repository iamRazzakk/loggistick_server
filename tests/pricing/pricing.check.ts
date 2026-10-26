import {
  applyChargeOutcome,
  bracketError,
  classifyZone,
  legacyBandsToBrackets,
  priceFundingSourceCharge,
  priceMileageBrackets,
  roundMileage,
  selectBillingMileage,
} from "../../src/app/modules/booking/pricing/tripPricing";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

const perMile = priceFundingSourceCharge(
  { priceMethod: "per_mile", base_rate: 5, per_mile_rate: 2 },
  4.5,
);
assert(perMile.charge === 14, `per mile expected 14, got ${perMile.charge}`);

const zeroBase = priceFundingSourceCharge(
  { priceMethod: "per_mile", base_rate: 0, per_mile_rate: 3 },
  2,
);
assert(zeroBase.charge === 6, `zero base expected 6, got ${zeroBase.charge}`);

const flat = priceFundingSourceCharge(
  { priceMethod: "flat_rate", flat_rate_price: 40 },
  18,
);
assert(flat.charge === 40, `flat expected 40, got ${flat.charge}`);

const firstX = priceFundingSourceCharge(
  {
    priceMethod: "first_x_miles",
    initial_miles: 3,
    initial_charge: 10,
    additional_per_mile: 2,
  },
  4.5,
);
assert(firstX.charge === 13, `first x expected 13, got ${firstX.charge}`);

const rounded = priceFundingSourceCharge(
  {
    priceMethod: "first_x_miles",
    initial_miles: 3,
    initial_charge: 10,
    additional_per_mile: 2,
  },
  4.5,
  "nearest",
  0,
);
assert(rounded.billingMileage === 5, `rounded miles expected 5, got ${rounded.billingMileage}`);
assert(rounded.charge === 14, `rounded first x expected 14, got ${rounded.charge}`);
assert(roundMileage(4.4, "nearest", 0) === 4, "nearest mile");
assert(roundMileage(4.1, "up", 0) === 5, "round up");

const brackets = [
  { min_mileage: 0, max_mileage: 10, charge: 20 },
  { min_mileage: 10, max_mileage: 20, charge: 30 },
];
assert(priceMileageBrackets(brackets, 10) === 20, "boundary stays on the lower bracket");
assert(priceMileageBrackets(brackets, 10.01) === 30, "just above boundary uses the next bracket");
assert(priceMileageBrackets(brackets, 20) === 30, "top boundary uses the last bracket");
assert(bracketError(brackets) === null, "contiguous brackets are valid");
assert(
  bracketError([
    { min_mileage: 0, max_mileage: 10, charge: 1 },
    { min_mileage: 12, max_mileage: 20, charge: 2 },
  ]) === "Mileage brackets leave a gap",
  "gaps are rejected",
);
assert(
  bracketError([
    { min_mileage: 0, max_mileage: 10, charge: 1 },
    { min_mileage: 8, max_mileage: 20, charge: 2 },
  ]) === "Mileage brackets overlap",
  "overlaps are rejected",
);

const legacy = legacyBandsToBrackets([
  { starting_mileage: 20, first_miles_price: 30, per_mile_price: 1.5 },
  { starting_mileage: 35, first_miles_price: 50, per_mile_price: 2 },
]);
assert(priceMileageBrackets(legacy, 20) === 30, "legacy exact cap");
assert(priceMileageBrackets(legacy, 20.01) === 50, "legacy next cap");

let missingBracket = false;
try {
  priceMileageBrackets(legacy, 36);
} catch {
  missingBracket = true;
}
assert(missingBracket, "miles past the last bracket are rejected");

assert(classifyZone(true, true) === "inside", "both inside");
assert(classifyZone(true, false) === "outside", "dropoff outside");
assert(classifyZone(false, true) === "outside", "pickup outside");

const none = applyChargeOutcome(40, 5, "none");
assert(none.fundingSourceCharge === 0 && none.passengerCopay === 0, "no charge");
const passenger = applyChargeOutcome(40, 5, "passenger_only");
assert(
  passenger.fundingSourceCharge === 0 && passenger.passengerCopay === 5,
  "passenger only",
);
const funding = applyChargeOutcome(40, 5, "funding_source_only");
assert(
  funding.fundingSourceCharge === 40 && funding.passengerCopay === 0,
  "funding source only",
);
const both = applyChargeOutcome(40, 5, "both");
assert(both.fundingSourceCharge === 40 && both.passengerCopay === 5, "both charges");
assert(both.fundingSourceCharge + both.passengerCopay !== 40, "copay is not taken out of the funding charge");

const gps = selectBillingMileage({
  source: "actual_gps",
  calculatedRouteMileage: 8,
  actualGpsMileage: null,
  straightLineMileage: 6,
});
assert(gps.billingMileageSource === "straight_line_fallback", "missing gps falls back");
assert(gps.billingMileage === 6, "fallback miles");

const route = selectBillingMileage({
  source: "calculated_route",
  calculatedRouteMileage: 8,
  actualGpsMileage: 9,
  straightLineMileage: 6,
});
assert(route.billingMileage === 8 && route.billingMileageSource === "calculated_route", "route source");

console.log("pricing checks passed");
