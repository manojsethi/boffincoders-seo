import type { AuditRule, RuleRegistry } from './types';
import { onPageRules } from './rules/on-page';
import { crawlIndexingRules } from './rules/crawl-indexing';
import { structuredDataRules } from './rules/structured-data';
import { contentQualityRules } from './rules/content-quality';
import { internalLinkRules } from './rules/internal-links';
import { siteHealthRules } from './rules/site-health';
import { imageRules } from './rules/images';
import { securitySocialRules } from './rules/security-social';
import { trustEeatRules } from './rules/trust-eeat';
import { dataDrivenRules } from './rules/data-driven';

const ALL_RULES: AuditRule[] = [
  ...onPageRules,
  ...crawlIndexingRules,
  ...structuredDataRules,
  ...contentQualityRules,
  ...internalLinkRules,
  ...siteHealthRules,
  ...imageRules,
  ...securitySocialRules,
  ...trustEeatRules,
  ...dataDrivenRules,
];

export function defaultRegistry(): RuleRegistry {
  const active = ALL_RULES.filter((r) => r.lifecycle === 'active' || r.lifecycle === 'experimental');
  const byId = new Map<string, AuditRule>();
  for (const r of active) byId.set(r.id, r);
  return { rules: active, byId };
}

export function allRules(): AuditRule[] {
  return ALL_RULES.slice();
}
