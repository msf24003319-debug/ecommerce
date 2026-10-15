import Link from "next/link";
import Image from "next/image";
import { getImageUrl } from "@/lib/images";
import {
  ArrowUpRight,
  Truck,
  PackageCheck,
  Heart,
  ShieldCheck,
} from "lucide-react";
import { catalog, categories, banners, settings } from "@/repositories/catalog";
import { ProductCard } from "@/components/storefront/product-card";
import { SavedProducts } from "@/components/storefront/saved-products";
import { configured } from "@/lib/supabase/server";
export default async function Home() {
  const [featured, collections, promos, s] = await Promise.all([
    catalog({ featured: true }),
    categories(),
    banners(),
    settings(),
  ]);
  const hero = promos[0];
  const categoryEdits = await Promise.all(
    collections.slice(0, 2).map(async (collection) => ({
      collection,
      ...(await catalog({ category: collection.slug })),
    })),
  );
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">THE MAISON MIRA EDIT / 2026</p>
          <h1>
            {hero?.title ?? (
              <>
                Made for your
                <br />
                <em>every day.</em>
              </>
            )}
          </h1>
          <p>
            {hero?.subtitle ??
              "Soft textures. Effortless silhouettes. Thoughtful pieces for all the moments that make you, you."}
          </p>
          <Link
            className="btn btn-primary"
            href={hero?.link ?? "/collections/all"}
          >
            Discover the collection <ArrowUpRight size={17} />
          </Link>
          <div className="hero-note">
            <span className="tiny-line" /> Considered essentials, endlessly
            wearable
          </div>
        </div>
        <div className="hero-art">
          {hero?.image_url ? (
            <Image
              src={getImageUrl(hero.image_url)}
              alt={hero.title}
              fill
              sizes="(max-width: 700px) 100vw, 50vw"
              priority
            />
          ) : (
            <>
              <div className="art-sun" />
              <div className="art-window" />
              <div className="art-drape drape-one" />
              <div className="art-drape drape-two" />
              <div className="art-plinth" />
              <div className="art-vase" />
              <span className="art-caption">THE ART OF FEELING AT HOME</span>
            </>
          )}
          <div className="hero-stamp">
            A LITTLE
            <br />
            EVERYDAY
            <br />
            <em>luxury</em>
          </div>
        </div>
        <span className="hero-index">01 — THE EVERYDAY EDIT</span>
      </section>
      {collections.length > 0 && (
        <nav className="category-shortcuts" aria-label="Shop by collection">
          <Link href="/collections/all">All pieces</Link>
          {collections.map((c) => (
            <Link key={c.id} href={"/collections/" + c.slug}>
              {c.name}
            </Link>
          ))}
        </nav>
      )}
      <div className="trust-strip">
        <span>
          <Truck size={20} />{" "}
          {s.shipping_zones.length
            ? "Delivery in selected cities"
            : "Nationwide delivery"}
        </span>
        <span>
          <PackageCheck size={20} /> Considered quality
        </span>
        <span>
          <ShieldCheck size={20} />{" "}
          {s.cod_enabled ? "Cash on delivery" : "Checkout temporarily paused"}
        </span>
        <span>
          <Heart size={20} /> Made to be loved
        </span>
      </div>
      {s.homepage_sections.map((section) =>
        section === "featured" ? (
          <section className="section" key={section}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR NEW FAVOURITES</p>
                <h2>The curated edit</h2>
              </div>
              <Link href="/collections/all">
                Explore all pieces <ArrowUpRight size={17} />
              </Link>
            </div>
            {featured.products.length ? (
              <div className="product-grid">
                {featured.products.slice(0, 4).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <div className="empty">
                {configured()
                  ? "The next edit is on its way. Visit our collection for available pieces."
                  : "The store is being connected. Products will appear here once Supabase is configured and the first collection is published."}
                <Link href="/collections/all" className="text-link">
                  Browse collections →
                </Link>
              </div>
            )}
          </section>
        ) : section === "categories" ? (
          <section className="section collection-section" key={section}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">FIND YOUR EVERYDAY</p>
                <h2>A little of what you love.</h2>
              </div>
            </div>
            <div className="category-grid">
              {collections.length ? (
                collections.map((c, i) => (
                  <Link
                    className={"category-tile tone-" + (i % 3)}
                    href={"/collections/" + c.slug}
                    key={c.id}
                  >
                    <span className="category-number">0{i + 1}</span>
                    <div className="category-art" />
                    {c.image_url && (
                      <Image
                        src={getImageUrl(c.image_url)}
                        alt={c.name}
                        fill
                        sizes="(max-width:760px) 100vw, 33vw"
                        className="category-photo"
                      />
                    )}
                    <div className="category-caption">
                      <h3>{c.name}</h3>
                      <p>{c.description}</p>
                    </div>
                    <ArrowUpRight />
                  </Link>
                ))
              ) : (
                <Link className="category-tile tone-0" href="/collections/all">
                  <span className="category-number">01</span>
                  <div className="category-art" />
                  <div>
                    <h3>Discover the collection</h3>
                    <p>Thoughtful pieces, waiting to be found.</p>
                  </div>
                  <ArrowUpRight />
                </Link>
              )}
            </div>
          </section>
        ) : (
          <section className="story-band" key={section}>
            <p className="eyebrow">LESS, BUT LOVELIER</p>
            <h2>
              Good things belong
              <br />
              in your <em>everyday.</em>
            </h2>
            <p>
              We believe that comfort and beauty are meant to live together.
              <br />
              That the pieces you reach for most should make you feel your best.
            </p>
            <Link href="/pages/about-us" className="btn btn-outline">
              Get to know Maison Mira <ArrowUpRight size={16} />
            </Link>
          </section>
        ),
      )}
      {promos.slice(1).length > 0 && (
        <section
          className="section promotion-section"
          aria-label="Current promotions"
        >
          <div className="promotion-grid">
            {promos.slice(1).map((promo) => (
              <Link className="promotion-tile" key={promo.id} href={promo.link}>
                {promo.image_url && (
                  <Image
                    src={getImageUrl(promo.image_url)}
                    alt={promo.title}
                    fill
                    sizes="(max-width:760px) 100vw, 50vw"
                  />
                )}
                <div>
                  <p className="eyebrow">THE MAISON MIRA EDIT</p>
                  <h2>{promo.title}</h2>
                  <p>{promo.subtitle}</p>
                  <span className="btn btn-outline">
                    Explore this edit <ArrowUpRight size={17} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      {categoryEdits
        .filter((edit) => edit.products.length > 0)
        .map((edit) => (
          <section className="section category-edit" key={edit.collection.id}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">SHOP THE COLLECTION</p>
                <h2>{edit.collection.name}</h2>
                <p className="muted">{edit.collection.description}</p>
              </div>
              <Link href={"/collections/" + edit.collection.slug}>
                View collection <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="product-grid">
              {edit.products.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ))}
      <section className="section recent-section">
        <div className="section-heading">
          <h2>Seen & loved</h2>
          <span>Your recent discoveries</span>
        </div>
        <SavedProducts recent />
      </section>
    </>
  );
}
