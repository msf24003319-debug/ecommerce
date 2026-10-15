import { content, settings } from "@/repositories/catalog";
import { ContactForm } from "@/components/account/forms";
import { notFound } from "next/navigation";
const defaults: Record<string, { title: string; content: string }> = {
  "about-us": {
    title: "The everyday, elevated.",
    content:
      "Maison Mira began with a simple idea: the things we wear every day deserve a little more thought.\n\nWe bring together considered essentials, soft textures, and effortless shapes. Pieces to feel at home in, wherever life takes you.\n\nOur collection is curated with comfort and beauty in mind. Discover the pieces that feel like you.",
  },
  faq: {
    title: "A few helpful answers.",
    content:
      "How can I pay?\nCash on delivery is available where supported. Final availability and charges are shown at checkout.\n\nWhere is my order?\nSign in and use Track your order with your order reference. Courier details appear after dispatch.\n\nCan I change my order?\nContact us promptly with your reference. We will confirm whether your order can still be changed.\n\nHow do I choose a size?\nSelect a size and colour on the product page. If you need help, send us a message.",
  },
  contact: {
    title: "We’re here for you.",
    content:
      "A question about a piece, a delivery, or something else? Send us a note and our team will help.",
  },
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: defaults[slug]?.title ?? slug.replaceAll("-", " "),
    alternates: { canonical: "/pages/" + slug },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = (await content(slug)) ?? defaults[slug];
  if (!page) notFound();
  const s = await settings();
  return (
    <div className="section narrow">
      <p className="eyebrow">MAISON MIRA</p>
      <h1>{page.title}</h1>
      <div className="prose whitespace">{page.content}</div>
      {slug === "contact" && (
        <>
          {s.contact_email && (
            <p>
              <a href={"mailto:" + s.contact_email}>{s.contact_email}</a>
            </p>
          )}
          {s.contact_phone && <p>{s.contact_phone}</p>}
          <ContactForm />
        </>
      )}
    </div>
  );
}
