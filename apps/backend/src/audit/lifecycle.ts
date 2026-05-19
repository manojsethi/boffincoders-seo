// Shared issue-lifecycle helpers. Doc 11 §"Raw Vs Rendered Evidence" + §"Rule Result To Issue Conversion".
// `verified`, `ignored`, `not-applicable`, `blocked-by-data-gap` are NOT actionable SEO issues.

export const ACTIVE_LIFECYCLE_STATUSES: readonly string[] = [
  'open',
  'planned',
  'in-progress',
  'fixed-pending-verification',
];

export const INACTIVE_LIFECYCLE_STATUSES: readonly string[] = [
  'verified',
  'ignored',
  'not-applicable',
  'blocked-by-data-gap',
];
