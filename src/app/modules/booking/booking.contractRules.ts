import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import { ICounty } from "../serviceAndTariff/counties/counties.interface";
import { County } from "../serviceAndTariff/counties/counties.model";
import { countyPointGeoFilter } from "../serviceAndTariff/counties/counties.geofence.utils";
import { User } from "../user/user.model";
import { Booking } from "./booking.model";
import { classifyZone, isCountyEffective, ZoneName } from "./pricing/tripPricing";

type LngLat = [number, number];

export type ContractRuleInput = {
  pickup: LngLat;
  dropoff: LngLat;
  stop?: LngLat;
  countyId?: string;
  userId?: string;
  serviceDate?: string;
  tripReason?: string;
  passengerSeats?: number;
  adminOverride?: boolean;
  adminOverrideReason?: string;
};

export type ContractRuleContext = {
  county: { _id: Types.ObjectId } & ICounty;
  zone: ZoneName;
  violations: string[];
  overridden: boolean;
};

const serviceDayOf = (serviceDate?: string) => {
  if (serviceDate && /^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) return serviceDate;
  return new Date().toISOString().slice(0, 10);
};

const loadCounty = async (input: ContractRuleInput) => {
  const serviceDay = serviceDayOf(input.serviceDate);
  let countyId = input.countyId;

  if (
    (!countyId || !Types.ObjectId.isValid(countyId)) &&
    input.userId &&
    Types.ObjectId.isValid(input.userId)
  ) {
    const rider = await User.findById(input.userId).select("county").lean();
    if (rider?.county) countyId = String(rider.county);
  }

  if (countyId && Types.ObjectId.isValid(countyId)) {
    const county = await County.findOne({
      _id: new Types.ObjectId(countyId),
      isActive: true,
    }).lean<({ _id: Types.ObjectId } & ICounty) | null>();
    if (!county) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Active county not found for this rider.",
      );
    }
    if (!isCountyEffective(county, serviceDay)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Pricing county is not effective on this service date.",
      );
    }
    return county;
  }

  const filter: Record<string, unknown> = {
    isActive: true,
    ...countyPointGeoFilter(input.pickup),
  };
  const county = await County.findOne(filter)
    .sort({ effectiveFrom: -1 })
    .lean<({ _id: Types.ObjectId } & ICounty) | null>();
  if (!county) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "No active pricing county covers this trip.",
    );
  }
  return county;
};

const pointInsideCounty = async (
  countyId: Types.ObjectId,
  point: LngLat,
) =>
  Boolean(
    await County.exists({
      _id: countyId,
      isActive: true,
      ...countyPointGeoFilter(point),
    }),
  );

const monthRange = (serviceDay: string) => {
  const [y, m] = serviceDay.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const endMonth = m === 12 ? 1 : m + 1;
  const endYear = m === 12 ? y + 1 : y;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  return { start, end };
};

/**
 * Program / eligibility gates that must run before persisting a booking.
 * Collects all violations (PDF §21). Override allowed only when configured.
 */
export const assertContractRulesBeforePrice = async (
  input: ContractRuleInput,
): Promise<ContractRuleContext> => {
  const county = await loadCounty(input);
  const pickupInside = await pointInsideCounty(county._id, input.pickup);
  const dropoffInside = await pointInsideCounty(county._id, input.dropoff);
  const zone = classifyZone(pickupInside, dropoffInside);
  const violations: string[] = [];

  const eligibility = county.eligibility ?? {};
  const program = county.programRules ?? {};

  if (eligibility.authorizationIdRequired && input.userId) {
    const rider = await User.findById(input.userId)
      .select("authorizationID")
      .lean();
    if (!rider?.authorizationID || !String(rider.authorizationID).trim()) {
      violations.push(
        "Authorization ID is required for this funding source program.",
      );
    }
  }

  const monthlyLimit = eligibility.monthlyTripLimit ?? 0;
  if (monthlyLimit > 0 && input.userId) {
    const day = serviceDayOf(input.serviceDate);
    const { start, end } = monthRange(day);
    const used = await Booking.countDocuments({
      userId: new Types.ObjectId(input.userId),
      countyId: county._id,
      serviceDate: { $gte: start, $lt: end },
      bookingStatus: { $nin: ["cancelled", "rejected"] },
    });
    if (used >= monthlyLimit) {
      violations.push(
        `Monthly trip limit has been reached (${monthlyLimit}).`,
      );
    }
  }

  if (input.stop && program.extraStopsAllowed === false) {
    violations.push(
      "Additional stops are not permitted under this program.",
    );
  }

  const seats = input.passengerSeats ?? 1;
  const companions = Math.max(0, seats - 1);
  if (companions > 0) {
    if (program.companionsAllowed === false) {
      violations.push("Companions are not permitted under this program.");
    } else if (
      program.maximumCompanions != null &&
      companions > program.maximumCompanions
    ) {
      violations.push(
        `Maximum companions allowed is ${program.maximumCompanions}.`,
      );
    }
  }

  const reasons = program.tripReasons ?? [];
  if (reasons.length && input.tripReason) {
    const match = reasons.find(
      (row) =>
        row.name.trim().toLowerCase() ===
        String(input.tripReason).trim().toLowerCase(),
    );
    if (!match) {
      violations.push(
        `Trip reason "${input.tripReason}" is not configured for this funding source.`,
      );
    } else {
      const permission = zone === "inside" ? match.inside : match.outside;
      if (permission === "blocked") {
        violations.push(
          `Trip reason "${match.name}" is not permitted ${zone} the service area.`,
        );
      }
    }
  }

  const allowOverride = Boolean(eligibility.allowAdminOverride);
  const wantsOverride = Boolean(input.adminOverride);
  if (violations.length && wantsOverride) {
    if (!allowOverride) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Program rules blocked this trip and admin override is not enabled. ${violations.join(" ")}`,
      );
    }
    if (!input.adminOverrideReason?.trim()) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Admin override requires a reason when program rules are violated.",
      );
    }
    return {
      county,
      zone,
      violations,
      overridden: true,
    };
  }

  if (violations.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      violations.join(" "),
    );
  }

  return { county, zone, violations: [], overridden: false };
};

/** After quote: enforce per-reason max miles (hard stop, not extra-mile pricing). */
export const assertMaxMilesAfterQuote = (params: {
  county: ICounty;
  zone: ZoneName;
  tripReason?: string;
  billingMileage: number;
  adminOverride?: boolean;
  adminOverrideReason?: string;
  priorViolations?: string[];
}) => {
  const reasons = params.county.programRules?.tripReasons ?? [];
  if (!reasons.length || !params.tripReason) return params.priorViolations ?? [];

  const match = reasons.find(
    (row) =>
      row.name.trim().toLowerCase() ===
      String(params.tripReason).trim().toLowerCase(),
  );
  if (!match || match.maxMiles == null || match.maxMiles <= 0) {
    return params.priorViolations ?? [];
  }

  if (params.billingMileage <= match.maxMiles) {
    return params.priorViolations ?? [];
  }

  const message = `Trip exceeds the maximum mileage (${match.maxMiles} mi) for "${match.name}".`;
  const violations = [...(params.priorViolations ?? []), message];

  if (params.adminOverride) {
    if (!params.county.eligibility?.allowAdminOverride) {
      throw new ApiError(StatusCodes.BAD_REQUEST, message);
    }
    if (!params.adminOverrideReason?.trim()) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Admin override requires a reason when mileage limit is exceeded.",
      );
    }
    return violations;
  }

  throw new ApiError(StatusCodes.BAD_REQUEST, message);
};

export const companionChargeFor = (
  county: ICounty,
  passengerSeats?: number,
) => {
  const seats = passengerSeats ?? 1;
  const companions = Math.max(0, seats - 1);
  if (companions <= 0) return 0;
  if (county.programRules?.companionsAllowed === false) return 0;
  const per = county.programRules?.companionCharge ?? 0;
  return companions * per;
};
