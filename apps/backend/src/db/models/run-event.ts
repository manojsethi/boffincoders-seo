import { Schema, model, Types } from 'mongoose';

const RunEventSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true },
    runId: { type: Types.ObjectId, required: true },
    runType: { type: String, required: true },
    kind: { type: String, required: true },
    message: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { collection: 'run_events', timestamps: true },
);
RunEventSchema.index({ projectId: 1, runId: 1, createdAt: 1 });

export const RunEventModel = model('RunEvent', RunEventSchema);
