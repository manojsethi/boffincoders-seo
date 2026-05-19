# 08. Phase 5: Report Assist And Client Language

## Phase Goal

Use local AI to help draft report sections from verified product data.

AI should help write; product data should decide.

## Report Sections AI Can Draft

Use Qwen3-4B.

Good candidates:

- executive summary.
- what changed this week.
- what improved.
- what got worse.
- next actions.
- client-friendly issue category summary.
- data gap explanation.

## Inputs

Use structured data only:

- report type.
- period start/end.
- issue counts.
- fixed/verified issues.
- top opportunities.
- GSC deltas.
- GA4 deltas.
- CWV summary.
- goals.
- data freshness.

Avoid dumping huge raw crawl markdown into report prompts.

## Output

Structured report draft:

```json
{
  "sectionTitle": "Executive Summary",
  "bodyMarkdown": "...",
  "confidence": 0.82,
  "dataUsed": ["gsc_summary", "issue_counts", "goals"],
  "warnings": []
}
```

## Client Language Rules

Client-facing language must be:

- clear.
- specific.
- non-alarmist.
- evidence-backed.
- action-oriented.

Avoid:

- raw rule ids.
- unexplained acronyms.
- hidden assumptions.
- fake certainty.
- "AI says".

## Analyst Review

AI-drafted report sections must be reviewable.

Flow:

1. report generated from data.
2. AI drafts language.
3. analyst reviews.
4. analyst edits.
5. report is published.

## When To Use External Model

If report is high-value and local model quality is weak:

- allow external model fallback.
- require explicit configuration.
- log provider/model.
- keep cost visible.

## Validation Checklist

Do not mark complete until:

- report draft uses real data.
- no fake metrics are invented.
- client language is understandable.
- analyst can edit before publishing.
- AI sections are marked as generated/draft internally.
- self-audit is written.

