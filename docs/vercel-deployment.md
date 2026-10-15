# Vercel deployment

This checkout is the standalone ecommerce Git repository and contains one Next.js
application at its root. No internal service bindings or other applications are
declared. The portfolio in the parent directory is outside this deployment.

vercel.json selects the Next.js framework and npm run build. It has no Services
wrapper or catch-all rewrite: the standard Vercel Next.js integration owns page,
API, static asset, and image-optimizer routing. Public application paths remain
the same.

## Project settings

For github.com/msf24003319-debug/ecommerce, select Root Directory **.** (repository
root), Framework Preset **Next.js**, install command **npm ci**, and build command
**npm run build**. Leave Output Directory at the framework default. Do not select
Services or configure a static export directory.

If importing a different parent Git repository containing this app in commerce/,
select that subdirectory instead. Root Directory is relative to the imported Git
repository, not the local Desktop directory.

Set these variables for the intended Production/Preview environment:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (public publishable/anon key)
- NEXT_PUBLIC_SITE_URL (the public HTTPS storefront origin)

Configure corresponding redirect URLs in Supabase Auth. Do not commit .env.local
or put secret/service-role keys in public environment variables.

## Image routing investigation

On October 15, 2026, https://commerce-two-sand-50.vercel.app/ returned 200, but
/_next/image requests for Supabase and Unsplash returned 404 HTML with
x-matched-path: /_not-found. Even /_next/image without query parameters reached
the page fallback. Both original source images returned 200 JPEGs. Local
next start had previously returned optimized images with 200. This establishes a
deployed optimizer-routing failure, separate from source-image access and the
earlier malformed Supabase URL problem.

The previous configuration wrapped this single app in Services mode and routed
every path into that service. The replacement uses the standard Next.js
integration to restore framework-owned optimizer routing. A new hosted deployment
is required to validate this correction; a local build cannot prove the hosted
route has been restored.

After deploying:

1. Confirm the Vercel project uses Next.js rather than Services.
2. Open the storefront, collection filters, product details, and cart.
3. Disable cache in DevTools Network and reload. Requests to /_next/image should
   return 200 with an image content type, rather than HTML.
4. Check a Supabase product photo and an Unsplash category photo. If either fails,
   open its original source URL separately and inspect the optimizer response.
5. Verify authentication, admin access, and checkout using a test account.

Image optimization remains enabled. No database updates or image URL edits are
required for this deployment configuration change.

References:
- https://vercel.com/docs/services/routing
- https://vercel.com/docs/frameworks/full-stack/nextjs
