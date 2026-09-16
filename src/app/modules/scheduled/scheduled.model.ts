import { Schema, model } from 'mongoose';
import { IScheduled, ScheduledModel } from './scheduled.interface'; 

const scheduledSchema = new Schema<IScheduled, ScheduledModel>({
  // Define schema fields here
});

export const Scheduled = model<IScheduled, ScheduledModel>('Scheduled', scheduledSchema);
