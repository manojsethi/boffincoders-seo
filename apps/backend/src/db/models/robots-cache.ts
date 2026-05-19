import { Schema, model } from 'mongoose';

const RobotsCacheSchema = new Schema(
  {
    host: { type: String, required: true, unique: true },
    robotsTxt: { type: String, default: '' },
    sitemaps: { type: [String], default: [] },
    fetchedAt: { type: Date },
    statusCode: { type: Number },
  },
  { collection: 'robots_cache', timestamps: true },
);

export const RobotsCacheModel = model('RobotsCache', RobotsCacheSchema);
