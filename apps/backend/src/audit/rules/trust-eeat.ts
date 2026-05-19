import { APPLIES, notApplicable } from '../applicability';
import type { AuditRule, FindingDraft } from '../types';

/**
 * Site has no About page. E-E-A-T baseline trust signal.
 */
const aboutPageMissing: AuditRule = {
  id: 'eeat.about-page-missing',
  version: '1.0.0',
  name: 'Site has no About page',
  category: 'eeat',
  layer: 'trust-entity',
  pack: 'core',
  scoresInto: 'trust-entity',
  description: 'Detects sites with no crawled page in the About role.',
  whyItMatters:
    'About page is a baseline E-E-A-T signal. Missing one makes the brand entity weaker for Google + AI.',
  recommendationTemplate: 'Publish an About page that describes the organization + key people.',
  defaultSeverity: 'low',
  defaultImpact: 25,
  defaultEffort: 'medium',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'site',
  appliesTo({ site }) {
    if (site.pages.length < 5) return notApplicable('other');
    return APPLIES;
  },
  evaluateSite({ site }) {
    const has = site.pages.some((p) => p.pageRole === 'about');
    if (has) return [];
    return [
      {
        status: 'opportunity',
        severity: 'low',
        title: 'No About page detected',
        observed: 'No crawled page maps to the About role.',
        whyItMatters: 'About page is a baseline E-E-A-T signal for organization trust.',
        recommendation: 'Publish /about (or equivalent) with org mission + key people.',
        evidence: { pageCount: site.pages.length },
        evidenceSources: ['crawl'],
        confidence: 0.85,
        confidenceLevel: 'medium',
        impactScore: 25,
        effortEstimate: 'medium',
        groupKey: 'eeat-about-missing',
      },
    ];
  },
};

/**
 * Site has no Contact page.
 */
const contactPageMissing: AuditRule = {
  id: 'eeat.contact-page-missing',
  version: '1.0.0',
  name: 'Site has no Contact page',
  category: 'eeat',
  layer: 'trust-entity',
  pack: 'core',
  scoresInto: 'trust-entity',
  description: 'Detects sites with no Contact page (or contact-equivalent) in the crawl set.',
  whyItMatters:
    'Contact page is an E-E-A-T baseline and a hard requirement for many SERP features.',
  recommendationTemplate: 'Publish /contact with NAP + form.',
  defaultSeverity: 'low',
  defaultImpact: 25,
  defaultEffort: 'medium',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'site',
  appliesTo({ site }) {
    if (site.pages.length < 5) return notApplicable('other');
    return APPLIES;
  },
  evaluateSite({ site }) {
    const has = site.pages.some((p) => p.pageRole === 'contact');
    if (has) return [];
    return [
      {
        status: 'opportunity',
        severity: 'low',
        title: 'No Contact page detected',
        observed: 'No crawled page maps to the Contact role.',
        whyItMatters: 'Contact baseline matters for E-E-A-T + many SERP enrichments.',
        recommendation: 'Publish /contact (or equivalent) with NAP + form.',
        evidence: { pageCount: site.pages.length },
        evidenceSources: ['crawl'],
        confidence: 0.85,
        confidenceLevel: 'medium',
        impactScore: 25,
        effortEstimate: 'medium',
        groupKey: 'eeat-contact-missing',
      },
    ];
  },
};

/**
 * Site has no legal/privacy page.
 */
const privacyPageMissing: AuditRule = {
  id: 'eeat.privacy-page-missing',
  version: '1.0.0',
  name: 'Site has no Privacy / legal page',
  category: 'eeat',
  layer: 'trust-entity',
  pack: 'core',
  scoresInto: 'trust-entity',
  description: 'Detects sites with no Privacy / Terms / legal-equivalent page.',
  whyItMatters:
    'Legal pages are a baseline E-E-A-T + compliance signal.',
  recommendationTemplate: 'Publish /privacy + /terms.',
  defaultSeverity: 'low',
  defaultImpact: 20,
  defaultEffort: 'medium',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'site',
  appliesTo({ site }) {
    if (site.pages.length < 5) return notApplicable('other');
    return APPLIES;
  },
  evaluateSite({ site }) {
    const has = site.pages.some((p) => p.pageRole === 'legal');
    if (has) return [];
    return [
      {
        status: 'opportunity',
        severity: 'low',
        title: 'No legal / privacy page detected',
        observed: 'No crawled page maps to the Legal role.',
        whyItMatters: 'Privacy + Terms are baseline trust signals for E-E-A-T.',
        recommendation: 'Publish /privacy + /terms.',
        evidence: { pageCount: site.pages.length },
        evidenceSources: ['crawl'],
        confidence: 0.85,
        confidenceLevel: 'medium',
        impactScore: 20,
        effortEstimate: 'medium',
        groupKey: 'eeat-privacy-missing',
      },
    ];
  },
};

/** Avoid unused warning */
const _draft: FindingDraft | null = null;
void _draft;

export const trustEeatRules: AuditRule[] = [aboutPageMissing, contactPageMissing, privacyPageMissing];

void APPLIES;
