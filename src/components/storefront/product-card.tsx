"use client";
import Link from "next/link";
import Image from "next/image";
import { Heart, ArrowUpRight } from "lucide-react";
import type { Product } from "@/types";
import { money } from "@/lib/utils";
import { productPresentation } from "@/lib/storefront";
import { useShopping } from "./shopping-provider";
export function ProductCard({ product }: { product: Product }) {
  const { wishlist, toggle, ready } = useShopping();
  const images = [...product.product_images].sort(
    (a, b) => a.position - b.position,
  );
  const image = images[0],
    alternate = images[1];
  const display = productPresentation(product);
  const sale = display.discounted;
  return (
    <article className="product-card">
      <div className="product-image">
        <Link
          href={"/products/" + product.slug}
          aria-label={`View ${product.name}`}
        >
          {image ? (
            <Image
              src={image.url}
              alt={image.alt}
              fill
              className="card-primary-image"
              sizes="(max-width: 760px) calc(50vw - 29px), (max-width: 1100px) calc(33vw - 35px), 300px"
            />
          ) : (
            <div className="no-image">
              <ShoppingIllustration />
              <span>Photography coming soon</span>
            </div>
          )}
          {alternate && (
            <Image
              src={alternate.url}
              alt={alternate.alt}
              fill
              className="card-alternate-image"
              sizes="(max-width: 760px) calc(50vw - 29px), (max-width: 1100px) calc(33vw - 35px), 300px"
            />
          )}
        </Link>
        {(!display.available || sale || product.featured) && (
          <span className="product-badge">
            {!display.available
              ? "SOLD OUT"
              : sale
                ? `${Math.round((1 - product.sale_price! / Math.max(product.price, 1)) * 100)}% OFF`
                : product.featured
                  ? "CURATED PICK"
                  : ""}
          </span>
        )}
        <button
          className={
            "wish-button " + (wishlist.includes(product.id) ? "selected" : "")
          }
          onClick={() => toggle(product.id)}
          disabled={!ready}
          aria-label={
            wishlist.includes(product.id)
              ? "Remove from wishlist"
              : "Save to wishlist"
          }
          aria-pressed={wishlist.includes(product.id)}
        >
          <Heart size={19} />
        </button>
        <Link className="card-shop" href={"/products/" + product.slug}>
          {display.available ? "Choose options" : "View piece"}{" "}
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="product-meta">
        <small>{product.categories?.name ?? "The collection"}</small>
        <h3>
          <Link href={"/products/" + product.slug}>{product.name}</Link>
        </h3>
        <div className="card-price">
          {display.varies && <span>From </span>}
          {money(display.price)} {sale && <del>{money(product.price)}</del>}
        </div>
        <p className="muted">
          {display.colours.length > 0 &&
            `${display.colours.length} ${display.colours.length === 1 ? "colour" : "colours"} · `}
          {display.available ? "Available" : "Out of stock"}
        </p>
      </div>
    </article>
  );
}
function ShoppingIllustration() {
  return (
    <svg
      width="110"
      height="150"
      viewBox="0 0 110 150"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M30 15L43 8h24l13 7 20 25-14 12-9-11v97H33V41l-9 11-14-12 20-25Z"
        fill="#d4b8a5"
        stroke="#ad8871"
      />
      <path d="M43 8c0 17 24 17 24 0" stroke="#ad8871" />
    </svg>
  );
}
