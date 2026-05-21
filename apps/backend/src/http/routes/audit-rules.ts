import { Router } from 'express';
import { allRules } from '../../audit/registry';
import type { AuditRule } from '../../audit/types';

export const auditRulesRouter = Router();

type RuleLearningCard = {
  id: string;
  version: string;
  name: string;
  scope: AuditRule['scope'];
  category: string;
  layer: string;
  pack: string;
  scoresInto: string;
  description: string;
  whyItMatters: string;
  recommendationTemplate: string;
  defaultSeverity: string;
  defaultImpact: number;
  defaultEffort: string;
  defaultValidationMethod: string | null;
  reportVisibility: string;
  ownerHint: string | null;
  lifecycle: string;
  requiredInputs: string[];
  optionalInputs: string[];
};

auditRulesRouter.get('/audit-rules', (_req, res) => {
  const rules = allRules().map(toLearningCard);
  const summary = {
    total: rules.length,
    active: rules.filter((r) => r.lifecycle === 'active').length,
    experimental: rules.filter((r) => r.lifecycle === 'experimental').length,
    byLayer: countBy(rules, (r) => r.layer),
    byCategory: countBy(rules, (r) => r.category),
    bySeverity: countBy(rules, (r) => r.defaultSeverity),
  };
  res.json({ summary, rules });
});

function toLearningCard(rule: AuditRule): RuleLearningCard {
  return {
    id: rule.id,
    version: rule.version,
    name: rule.name,
    scope: rule.scope,
    category: rule.category,
    layer: rule.layer,
    pack: rule.pack,
    scoresInto: rule.scoresInto,
    description: rule.description,
    whyItMatters: rule.whyItMatters,
    recommendationTemplate: rule.recommendationTemplate,
    defaultSeverity: rule.defaultSeverity,
    defaultImpact: rule.defaultImpact,
    defaultEffort: rule.defaultEffort,
    defaultValidationMethod: rule.defaultValidationMethod ?? null,
    reportVisibility: rule.reportVisibility,
    ownerHint: rule.ownerHint ?? null,
    lifecycle: rule.lifecycle,
    requiredInputs: [...rule.requiredInputs],
    optionalInputs: [...(rule.optionalInputs ?? [])],
  };
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}
