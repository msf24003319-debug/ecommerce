# Vercel deployment configuration (pending confirmation)

The current workspace contains one deployable Next.js application. `vercel.json`
uses services mode with a service named `commerce`, rooted at the directory
containing that configuration. All public paths route to this service, including
the storefront, `/admin`, `/api/*`, and `/auth/callback`. Existing authentication
and authorization still apply to these routes.

No internal service bindings are declared: the application's API handlers and
server actions belong to this same Next.js application. Its Supabase SDK calls
target an externally hosted Supabase project, not another Vercel service. The
relative browser calls to `/api/catalog` and `/api/variants` already agree with
the catch-all route. No application URL changes are required for this layout.

The Git root on this machine is the parent `Menu` directory, while this app and
configuration are in `Menu/commerce`. When importing that Git repository, select
`commerce` as the Vercel project Root Directory. Do not add a second service with
root `commerce` inside this configuration: that would resolve to the nonexistent
`Menu/commerce/commerce`. The sibling `commerce - Copy` is not configured as a
separate production service. A repository-root multi-service deployment requires
identifying the other actual application directories first.

Configure the existing application variables in Vercel for the intended
environments:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (a public publishable/anon key)
- `NEXT_PUBLIC_SITE_URL` (the public HTTPS storefront origin, used for metadata,
  sitemap URLs, and authentication redirects)

Configure corresponding redirect URLs in Supabase authentication settings. Do
not commit `.env.local` or set hypothetical binding variables manually.

Run `vercel dev` from this app directory to verify services locally; Vercel also
documents `vercel dev -L` for local operation without cloud authentication. The
Vercel CLI is not installed in the current workspace, so this check has not been
run. Configuration review does not constitute a hosted deployment test.

Before deployment, confirm the `commerce` name, the public catch-all path, the
absence of internal services/bindings, and the intended location of any additional
services. No deployment has been performed.

Reference: https://vercel.com/docs/services
