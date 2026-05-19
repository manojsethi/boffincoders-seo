import { Schema, model, Types } from 'mongoose';

const ScheduleSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    type: { type: String, required: true },
    cadence: { type: String, default: 'weekly' },
    timezone: { type: String, default: 'UTC' },
    enabled: { type: Boolean, default: true },
    agendaJobName: { type: String, required: true },
    cronExpression: { type: String },
    humanInterval: { type: String },
    nextRunAt: { type: Date },
    lastRunAt: { type: Date },
    // Integration-sync schedules: pick a single provider, or leave empty to sync ALL connected
    // integrations on each tick. Other schedule types ignore this field.
    provider: { type: String, enum: ['gsc', 'ga4', 'cwv', 'all'], default: 'all' },
    createdBy: { type: String },
  },
  { collection: 'schedules', timestamps: true },
);
ScheduleSchema.index({ projectId: 1, type: 1 });

export const ScheduleModel = model('Schedule', ScheduleSchema);
