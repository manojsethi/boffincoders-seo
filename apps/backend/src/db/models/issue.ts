import { Schema, model, Types } from 'mongoose';

/**
 * Persistent work item created from rule findings. Survives across audit runs.
 * Doc 11 §"Issue Grouping" + §"Cross-Page Rules".
 */
const IssueSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true },
    canonicalKey: { type: String, required: true },

    ruleId: { type: String, required: true },
    ruleVersion: { type: String, default: '1.0.0' },

    // Page-level link (when applicable)
    pageId: { type: Types.ObjectId },
    segment: { type: String },
    entityKey: { type: String },

    // Cross-page grouping for template-/site-wide issues
    groupKey: { type: String },
    affectedUrls: { type: [String], default: [] },
    affectedPageCount: { type: Number, default: 0 },

    currentFindingId: { type: Types.ObjectId },
    firstSeenAuditRunId: { type: Types.ObjectId, required: true },
    lastSeenAuditRunId: { type: Types.ObjectId, required: true },

    lifecycleStatus: { type: String, default: 'open' },
    ownerType: { type: String, default: 'analyst' },
    priority: { type: Number, default: 0 },
    actionPriority: { type: String, enum: ['P0', 'P1', 'P2'], default: 'P2' },
    impact: { type: Number, default: 0 },
    effort: { type: String, default: 'unknown' },
    confidence: { type: Number, default: 0 },
    confidenceLevel: { type: String, enum: ['high', 'medium', 'low'] },

    severity: { type: String, required: true },
    category: { type: String, required: true },
    layer: { type: String },
    title: { type: String, required: true },

    // Latest finding status drives whether issue auto-resolves on next audit
    latestStatus: { type: String, default: 'fail' },

    dueDate: { type: Date },
    notes: { type: String, default: '' },
    verifiedAt: { type: Date },
    verifiedByAuditRunId: { type: Types.ObjectId },
  },
  { collection: 'issues', timestamps: true },
);
IssueSchema.index({ projectId: 1, canonicalKey: 1 }, { unique: true });
IssueSchema.index({ projectId: 1, lifecycleStatus: 1, priority: -1 });
IssueSchema.index({ projectId: 1, groupKey: 1 });

export const IssueModel = model('Issue', IssueSchema);
