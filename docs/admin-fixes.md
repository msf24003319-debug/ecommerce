# Targeted admin fixes — 15 October 2026

This work addresses order status updates, the previous admin palette, coupon eligibility controls, and the first-page pagination label. It builds on the existing panel. No database migration, RLS change, permission change, new dependency, or `.env.local` edit was needed. No hosted deployment or hosted order/payment/stock mutation was performed.

## Confirmed order-status cause

For a persisted `confirmed` order, `processing` and `cancelled` are the correct allowed targets. The transition map, the SQL status constraint, and migration 014 use the same lowercase canonical statuses. The locked RPC checks the current status and requires a reason, applies stock restoration only for cancellation/return, and writes an audit event. Ordinary forward transitions do not deduct inventory.

The reproduced UI defect was an **uncontrolled select whose option set changed without resetting its selection**. After Pending advanced to Confirmed, React removed the selected Confirmed option and retained the Cancelled option while adding Processing. Chromium selected Cancelled instead of the normal next stage. The previous browser test explicitly selected every target, so it masked this defect.

Before changing that component, the new default-selection assertion failed against the existing production UI: expected `processing`, received `cancelled`. The original failure evidence is saved in `artifacts/admin-fixes/status-before.md`. The reproduction used the isolated migrated PostgreSQL fixture, not a hosted account.

The select now has an explicit default and a key derived from the order ID and persisted status. Every authoritative status change resets it to the first valid next target while preserving the other form fields. The current fulfillment status is displayed separately. Confirmation uses readable source/target labels. Repeat submissions are guarded and controls remain disabled during the mutation and refresh transition.

The server action still uses the caller's verified staff session and the original `transition_order` RPC. It reads the current status, rejects invalid/repeated/skipped actions, submits the exact order ID, target, reason, tracking and courier values, checks RPC errors/payloads, and reads the saved status back. It reports success only when the authoritative saved status matches the target. A failed verification tells the operator that the update was submitted and must be reloaded before retrying. Explicit invalidations cover the detail, order list, overview, and the root layout (including progress/history views). The existing RPC remains responsible for locked, atomic transition validation and one-time stock restoration.

Missing/incompatible workflow functions or the old order constraint receive a migration-specific explanation. A database invalid-transition error remains a rejection and advises reloading; if an offered stage still fails, it points to checking migration 014. This is diagnostic guidance, **not evidence that the hosted migration is missing**. No constraint was weakened and no applied migration was edited.

A separate hosted persistence/session/migration failure could not be confirmed without a real authorized staging session and order. No such session was supplied. The report does not treat the local test gateway as native Supabase Auth or PostgREST verification.

## Theme reference and restoration

Git inspection found that the parent repository tracks a different portfolio project and the commerce directory is untracked there. That history cannot identify a prior commerce theme, and unrelated parent changes were left untouched.

The existing pre-redesign backup at `../commerce - Copy/src/app/globals.css` contains the original admin CSS and palette. Its complete SHA-256 matches the current shared `src/app/globals.css`, which this task did not modify. The original tokens are:

| Token | Previous value |
| --- | --- |
| Ink | `#302f28` |
| Muted | `#7a786e` |
| Paper | `#fffefa` |
| Cream | `#f5f1e8` |
| Olive | `#575b40` |
| Borders | `#e5e1d7` |
| Terracotta accent | `#9c694e` |
| Admin canvas | `#f7f7f2` |
| Primary hover | `#44492f` |

Admin CSS now inherits those tokens instead of overriding them with green/slate values. It restores the documented canvas, primary hover, control borders and warm surfaces. Muted admin text uses a darker mixture of the original ink/muted colors for contrast. Semantic success/warning/danger badges remain distinct. Layout, typography hierarchy, navigation, drawer, forms, responsive tables and focus indicators are retained. Customer-facing shared styles remain byte-identical to the backup.

## Coupon selectors and data compatibility

The three raw JSON UUID inputs are replaced within the existing record editor by searchable, paginated checkbox selectors and removable selected-item lists. Coupon editing now uses full-width record cards so the selectors are readable on mobile instead of being squeezed into a table cell:

- Products: name, SKU and publication status, including archived/draft selections.
- Categories: category name and hidden-state label where applicable.
- Customers: customer name and phone from the already-authorized profile view. No Auth email directory, CNIC, document, guest capability, or unrelated private fields are queried.

A hidden JSON input per selector submits the original `product_ids`, `category_ids`, or `customer_ids` UUID array. Labels are never saved as eligibility data. Existing IDs are resolved in batches of at most 100; unresolved IDs remain selected with a retained-restriction notice. Legacy null entries are also retained visibly until explicitly removed; opening such a record does not crash or silently convert it to unrestricted eligibility. Errors or empty search responses never silently clear saved restrictions. Removal is explicit.

Search actions enforce the existing `settings` staff scope, use the authenticated Supabase client/RLS, select only safe display columns, and fetch at most 21 results (20 displayed plus a next-page indicator). Searches are debounced and obsolete responses are ignored. Closed edit forms defer selector requests until first opened; collapsing a form then retains its draft selections. Loading, empty, error and retry states are included.

Server saving continues through `saveRecord` and the existing coupon schema. Every submitted ID is UUID-validated. Newly attached IDs must resolve in the administrator's authorized view before writing. Existing unavailable IDs can remain in their original array without broadening the restriction; existing database guards still have the final say. The product-target trigger continues protecting against deletion races. Discount type/value, dates, activation, minimums and usage limits retain their existing validation and storage.

The checkout representation and semantics are unchanged: an empty product array means all products subject to category restrictions; an empty category array means no category restriction; populated product and category restrictions must both match. Empty customer eligibility means all otherwise-eligible customers/guests. A populated customer array restricts usage to the selected signed-in accounts, preserving guest restrictions and redemption limits.

Database tests cover unrestricted, one-product, multiple-product/category, specific-customer and mixed cases, exact stored arrays, valid discounts, guest denial for customer-specific codes, and rejection when product/category restrictions have no intersection.

## Pagination

The `Page 1` label came from the unconditional `<span>Page {page}</span>` in the shared `Pagination` function in `src/app/admin/[section]/page.tsx`. It now renders a page label only for later pages. A single first page without next/previous controls returns no pagination element, avoiding an empty padded gap. Previous/next behavior, role/accessibility labels, query state, search, status, sorting and payment filters remain intact.

## Exact changed files

Application:

- `src/actions/commerce.ts`
- `src/actions/coupon-options.ts` (new)
- `src/repositories/coupon-options.ts` (new)
- `src/lib/coupon-eligibility.ts` (new)
- `src/lib/admin-fields.ts`
- `src/components/admin/editor.tsx`
- `src/components/admin/eligibility-picker.tsx` (new)
- `src/components/admin/order-actions.tsx`
- `src/app/admin/admin.css`
- `src/app/admin/[section]/page.tsx`

Tests:

- `tests/unit/admin-fixes.test.ts` (new)
- `tests/unit/admin-readiness.test.ts`
- `tests/unit/actions.test.ts` (server-only import mocked in the unit environment)
- `tests/features/admin-fixes.spec.ts` (new)
- `tests/features/order-feedback.spec.ts`
- `tests/integration/product-guest.test.ts`
- `tests/e2e/public.spec.ts` (visible filter-control selector for streamed pages)
- `tests/fixtures/supabase-server.mjs`

Documentation/evidence:

- `docs/admin-fixes.md` (this report)
- `docs/admin-redesign.md` (follow-up reference)
- `artifacts/admin-fixes/status-before.md` (pre-fix reproduction)
- `artifacts/admin-fixes/theme-desktop.png`, `theme-mobile.png`, `coupons-desktop.png`, `coupons-mobile.png`, and `README.md` record the final fixture UI and evidence context.

The order detail loader, transition map, order-progress repository and migrations were inspected and preserved. `.next`, TypeScript cache and test-run outputs were regenerated by the checks.

## Verification

- Baseline: typecheck/lint passed, 124 unit tests passed, 78 database tests passed.
- Before-fix status reproduction: failed as expected, `processing` expected but `cancelled` selected after confirmation.
- Updated typecheck and lint: passed.
- Updated unit suite: 144 tests passed.
- Updated database suite: 79 tests passed against the actual migrated SQL in isolated PGlite.
- Full updated feature browser suite: all 18 tests passed on the final layout, across desktop and mobile. This includes all five coupon eligibility combinations, selected-ID persistence and removal, palette token assertions, first-page label removal, preserved pagination URLs, automatic next-stage selection, a Processing reload, direct persisted-order/timeline checks, and unchanged COD status during forward fulfillment. Existing admin-section tests also inspect 1440px, 834px, and 390px widths.
- Final normal production build: passed, exit 0, using the unchanged `.env.local`. Generated server/static bundles contain no fixture key.
- Final public regression rerun: all 39 tests passed across desktop, tablet and mobile, exit 0.

The test-only REST gateway was extended to model selector searches, safe profile lists, ranges, coupon writes and direct order/timeline assertions. During development, browser assertions were corrected to wait for the asynchronous database commit and to identify selected items by their remove controls (which include the resolved names); the test gateway's numeric/date comparisons were corrected independently of production application code. Screenshot review found cramped mobile editing in table cells; coupon records now use full-width cards, with expanded-form overflow assertions and fresh desktop/mobile screenshots.

Native Supabase Auth/Storage, independent database-connection concurrency, actual staging order acceptance, and production deployment are not newly verified. No new migration is necessary or applied by this task; existing migrations 001–014 remain deployment prerequisites.

The first final public run passed 38/39 tests; a broad text locator matched a hidden streamed filter summary as well as the visible control. The test now explicitly clicks the visible filter toggle. Production storefront implementation and styling were not changed for that failure.


### Final command results

| Command | Final result |
| --- | --- |
| `npm.cmd run typecheck` | Passed, exit 0 |
| `npm.cmd run lint` | Passed, exit 0 |
| `npm.cmd test` | Passed, 144 tests |
| `npm.cmd run test:db` | Passed, 79 tests |
| `npm.cmd run test:features` | Passed, 18 desktop/mobile tests, including expanded mobile coupon-card overflow and Processing reload checks |
| `npm.cmd run test:e2e` | Passed, 39 desktop/tablet/mobile tests after correcting the visible-control locator |
| `npm.cmd run build` | Passed, final normal production configuration; no fixture key in the generated bundles |

No known local test failure remains. The original shared stylesheet still matches the pre-redesign backup; `.env.local` and migration 014 retain their original file metadata. Native staging order/session verification and deployment remain unperformed, as described above. No new migration was created or applied.
