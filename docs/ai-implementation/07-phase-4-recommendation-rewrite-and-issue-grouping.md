# 07. Phase 4: Recommendation Rewrite And Issue Grouping

## Phase Goal

Use local AI to make audit outputs easier to understand and less noisy.

Rules still detect issues. AI improves explanation and grouping.

## Recommendation Rewrite

Use Qwen3-4B.

Input:

- rule id.
- rule name.
- severity.
- page role.
- affected URL.
- evidence.
- why it matters.
- default recommendation.
- project website type.

Output:

```json
{
  "analystSummary": "This service page does not clearly state its main topic in the H1.",
  "clientFriendlyExplanation": "The main heading should quickly tell visitors and search engines what service this page is about.",
  "recommendedFix": "Rewrite the H1 to describe the service and target audience.",
  "validationMethod": "Re-crawl the page and confirm one clear H1 is present.",
  "confidence": 0.88
}
```

## Issue Grouping

Use Qwen3-4B after deterministic grouping.

AI should help label groups, not decide raw membership alone.

Inputs:

- grouped issues by rule/template/page type.
- sample affected URLs.
- page roles.
- evidence snippets.

Output:

```json
{
  "groupTitle": "Service page titles are too generic",
  "pattern": "Multiple service pages use brand-heavy titles instead of service-specific titles.",
  "recommendedBatchFix": "Update the title template to include the specific service and primary intent.",
  "affectedPageType": "service",
  "confidence": 0.81
}
```

## Product Use

Use rewritten recommendations in:

- Issue drawer.
- internal reports.
- client reports after review.

Use issue grouping in:

- Issues table.
- Reports.
- Work queues.
- Developer/content handoff.

## Safety Rules

AI must not:

- change severity.
- hide critical issues.
- invent evidence.
- say a fix is complete.
- claim ranking gains.

AI can:

- rewrite wording.
- explain page-role-specific impact.
- suggest batch fix wording.
- make recommendations easier to understand.

## Validation Checklist

Do not mark complete until:

- rewritten recommendations cite original evidence.
- AI text does not invent new facts.
- issue grouping reduces noise.
- analyst can see original rule output.
- AI output can be regenerated.
- client report uses only reviewed or safe AI wording.
- self-audit is written.

