import { DRIVER_POPULATE_FIELDS } from "../app/modules/driverduty/driverduty.constants";
import { VehicleAssign } from "../app/modules/vehicleassign/vehicleassign.model";

type WithId = { _id: unknown };

export const attachAssignedDriver = async <T extends WithId>(vehicles: T[]) => {
  if (!vehicles.length) {
    return vehicles;
  }

  const assignments = await VehicleAssign.find({
    vehicleId: { $in: vehicles.map((vehicle) => vehicle._id) },
  })
    .populate("driverId", DRIVER_POPULATE_FIELDS)
    .lean();

  const driverByVehicle = new Map(
    assignments.map((assignment) => [
      String(assignment.vehicleId),
      assignment.driverId ?? null,
    ]),
  );

  return vehicles.map((vehicle) => ({
    ...vehicle,
    driver: driverByVehicle.get(String(vehicle._id)) ?? null,
  }));
};
