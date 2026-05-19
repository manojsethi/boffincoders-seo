# Known Blockers

## B-001 — `/_global-error` prerender failure on `next build`

**Severity:** blocks production deployment, does NOT block dev runtime or Phase B product validation.

**Stack versions:**
- next ^16.0.4
- react ^19.2.0
- react-dom ^19.2.0
- antd ^5.22.5
- @ant-design/v5-patch-for-react-19 ^1.0.3
- @ant-design/nextjs-registry ^1.0.2

**Symptom:**

```
Error occurred prerendering page "/_global-error".
TypeError: Cannot read properties of null (reading 'useContext')
    at <unknown> (.next/server/chunks/ssr/08c5_next_dist_07tq4ni._.js:4:28828) {
  digest: '4046171469'
}
> Export encountered errors on 1 path:
	/_global-error/page: /_global-error
```

**Scope:**
- Only `/_global-error` (Next's synthetic internal error boundary).
- All 13 real app routes compile + render correctly.
- `pnpm dev` works fully — full product flow usable in dev.

**Suspected cause:** Antd 5 `ConfigProvider` (cssinjs) reads React context during SSR prerender of Next's synthetic `/_global-error` route, where the React owner is null.

**Workarounds tried (none worked):**
- Pin React 19.1.7, 19.2.0
- Downgrade Next 16 → 15.5, 15.3
- Add `app/global-error.tsx`
- `experimental.prerenderEarlyExit: false`
- `export const dynamic = 'force-dynamic'` on root
- Add `pages/_document.tsx` (rejected by user — wrong direction)

**Next steps when picked up:**
1. Wait on upstream Next 16 + Antd 5 + React 19 interop fix (track Next + Antd issue trackers).
2. Consider isolating Antd `ConfigProvider` so `/_global-error` renders without it (custom global-error.tsx that mounts only minimal markup, no Antd).
3. Try `output: 'standalone'` + skipping `/_global-error` prerender via `notFound()` boundary if Next exposes a knob.

**Owner:** unassigned.
**Created:** 2026-05-16 (during Phase B self-audit).
