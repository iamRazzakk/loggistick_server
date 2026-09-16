import { Model, Types } from 'mongoose';

export type IVehicleAssign = {
  driverId:Types.ObjectId;
  vehicleId:Types.ObjectId;
  assignedAt:Date;
  assignedBy:Types.ObjectId;
};

export type VehicleAssignModel = Model<IVehicleAssign>;
