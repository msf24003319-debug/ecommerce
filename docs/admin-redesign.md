# Admin panel redesign — 15 October 2026

Follow-up: [Targeted admin fixes](admin-fixes.md) restores the original palette and updates order status, coupon eligibility, and first-page pagination behavior. The description below records the earlier redesign.
This updates the existing administration routes. It retains the current Next.js server pages, authenticated Supabase client, permissions, database schema, actions, RPCs, and business workflows. No new database migration was created, no hosted migration was applied, no dependency was added, and `.env.local` was not edited.

## Inspected routes and implementation

- `/admin` overview.
- `/admin/[section]`: products, categories, inventory, orders, customers, inquiries, feedback, coupons, promotions, content, settings, reports, and staff.
- `/admin/products/[id]`, including `new`; `/admin/orders/[id]`; `/admin/customers/[id]`.
- Shared admin layout; product/variant/stock editor; gallery/image metadata editor; bulk product status; archive/delete and asset cleanup; generic record editor; order actions; feedback moderation; shared order display and progress tracker.
- Staff authorization and scopes, export authorization, report/catalog/progress repositories, action validation and failure handling, guest capability-cookie checks, and migrations 001–014 (schema, relationships, RLS, stock, checkout, payment, lifecycle, and moderation operations).

## Design and behavior

The workspace uses a restrained green/slate palette, white surfaces, consistent typography, readable controls, status colors, table styling, focus indicators, responsive grids, and shared spacing. Storefront chrome is hidden only while an admin shell is present; customer routes retain their styles. The sidebar groups existing authorized destinations, indicates the active section, and supports collapsing groups. Tablet/mobile navigation uses a native modal drawer with focus containment, Escape, and a close control. Breadcrumbs and a profile/account menu sit above the workspace. List-section loading skeletons and a retryable error boundary cover management pages. The loading boundary is kept off product detail routes so deleted/missing products retain HTTP 404 responses.

Overview filters and actions now precede the metrics and charts. Queries run concurrently within the staff member's existing scopes. Collections exclude both cancelled and returned orders. Unpaid active-order COD totals are labelled separately and explicitly include undelivered orders. Inventory alerts use available stock (`on_hand - reserved`), rather than physical stock alone. Date validation handles impossible/reversed dates and Pakistan calendar boundaries, including fractional seconds at the end of the final day. Reports share those date rules and collection exclusions.

These are bounded operational summaries: overview reads up to 1,000 orders and 1,000 inventory rows, and warns at the limit; reports retain their 5,000-order cap. Collections are paid order totals after discounts and including shipping, grouped by order placement date. They are not net sales, accounting profit, or a payment-date cash ledger. Unsupported partial payments, notifications, languages, and financial routes were not invented.

Products retain their real editor and lifecycle controls. The table includes available stock across active variants, publication status, price, sorting, filtering, and a visible management action. Product forms separate pricing and search appearance and provide jump links to variants and gallery management. Existing independent S/M/L/color/SKU/price/stock fields, uploads, view/color image metadata, display order, and duplication remain intact.

Orders include customer/guest identity, placed date, payment badge, fulfillment status, and total, with payment/status/search filters preserved in pagination. Detail pages retain the original immutable items, delivery information, progress, private timeline, mandatory reasons, valid next transitions, and separate payment actions. Financial/status operations retain confirmations and repeat-submission guards.

Inventory adds SKU search, available-stock indicators, confirmed adjustments, and the latest 20 stock movements (orders and manual adjustments). On-hand, reserved, and available quantities are separate. Adjustments still use `adjust_inventory`, report the returned authoritative value, and refresh server data. No optimistic stock state is introduced.

Customer listings now select only displayed profile fields and separate customers from staff. Feedback retains escaped content, ratings, publication filters, existing moderation actions, product links, and replies. The current database has a single unpublished state, so pending and hidden are correctly grouped. Replies on published reviews are already public in the existing product view; the moderator interface explains that existing visibility rather than promising private replies.

## Exact changed files

Application:

- `src/app/admin/admin.css` (new)
- `src/app/admin/error.tsx` (new)
- `src/app/admin/[section]/loading.tsx` (new)
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/[section]/page.tsx`
- `src/app/admin/customers/[id]/page.tsx`
- `src/app/admin/orders/[id]/page.tsx`
- `src/app/admin/products/[id]/page.tsx`
- `src/components/admin/navigation.tsx` (new)
- `src/components/admin/product-editor.tsx`
- `src/components/admin/order-actions.tsx`
- `src/components/admin/bulk-status.tsx`
- `src/components/account/feedback.tsx` (moderation interface only)
- `src/lib/admin-overview.ts` (new)
- `src/repositories/reports.ts`

Tests and documentation:

- `tests/unit/admin-overview.test.ts` (new)
- `tests/features/admin-redesign.spec.ts` (new)
- `tests/features/order-feedback.spec.ts`
- `tests/fixtures/supabase-server.mjs`
- `docs/admin-redesign.md` (this report)
- `artifacts/admin-redesign/desktop.png`, `tablet.png`, `mobile.png`, and `README.md` (test-fixture screenshots and their context)

## Verification

Final verification results are recorded below. Browser fixtures are test-only: their JWTs, identities, and local REST gateway are not production authentication. The gateway runs actual migrated PostgreSQL logic in PGlite under the relevant database roles. It does not prove native hosted Supabase Auth/Storage transport or independent-connection concurrency.

No hosted administrative mutation, production order, payment, or stock adjustment was performed. Native staging checks still require valid authorized accounts and access to the existing deployment. Existing deployment prerequisites for migrations 011–014 continue to apply.

### Critical workflow evidence

| Workflow | Verification boundary |
| --- | --- |
| Product creation, original-ID editing, S/M/L variants, independent stock | Production browser pages with the local migrated fixture; actual SQL lifecycle and variant tests |
| Product uploads | Unit tests exercise validated JPEG/PNG/WebP uploads and failure cleanup against mocked Storage; actual SQL tests cover designated view/color metadata preservation. Native hosted Storage upload/download remains a staging check. |
| Inventory adjustments and refresh | Production browser adjustment, authoritative result, reload, and movement-history assertions; migrated SQL stock tests |
| Guest and registered checkout | Production browser journeys and migrated SQL; capability-cookie and cross-user denial tests |
| Fulfillment, cancellation, returns | Browser covers all forward stages and return; SQL covers invalid/backward/repeated transitions, packed cancellation, and one-time variant restoration |
| COD collection and refund | Production browser reconciliation controls and migrated locked RPC tests |
| Feedback moderation and replies | Guest/member browser journeys, unpublished/public visibility, escaped rendering tests, and SQL authorization |
| Authorization | Existing staff-scope and inactive-user unit tests, database RLS/capability tests, and anonymous browser route/API denial; native hosted Auth not newly verified |

Transient failures found during development were corrected before the final run: test builds must use their fixture origin; the broad loading boundary changed missing-product responses; exact label/text selectors needed accessible-role targeting for select controls and streamed hidden markup. No authorization or database behavior was relaxed to make tests pass.

### Confirmed checks

- `npm.cmd run typecheck`: passed, exit 0.
- `npm.cmd run lint`: passed, exit 0, no warnings.
- `npm.cmd test`: passed, 124 tests in 16 files.
- `npm.cmd run test:db`: passed, 78 tests in 5 files, executing the existing migrations in isolated PostgreSQL/PGlite.
- `npm.cmd run test:features`: passed, all 14 browser tests across desktop/mobile. The admin section test additionally checks 1440px, 834px, and 390px layouts in each project. Product creation, editing, S/M/L inventory, refresh persistence, gallery/checkout, fulfillment, feedback, COD collection, return/refund, cancellation of deletion, transport failure, protected archival, and permanent deletion are covered as described above.

- `npm.cmd run build`: final normal production build passed, exit 0, using the unchanged `.env.local` configuration. The generated server/static bundles were checked and contain no fixture key.

- `npm.cmd run test:e2e`: final normal-build regression run passed, all 39 tests across desktop, tablet, and mobile (exit 0). This includes every anonymous admin section/detail denial, protected API/export checks, storefront navigation, cart/wishlist, checkout return destinations, form failures, and security headers.

All seven requested check commands completed successfully. Screenshot evidence is in `artifacts/admin-redesign/`. Native hosted Auth/Storage and independent-connection concurrency remain staging verification limits; the UI changes introduce no new migration prerequisites.
