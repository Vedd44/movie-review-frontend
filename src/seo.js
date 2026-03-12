import { useEffect } from "react";
import { buildAbsoluteUrl, DEFAULT_SOCIAL_IMAGE, SITE_DESCRIPTION, SITE_NAME } from "./siteConfig";

const upsertMeta = (attribute, key, content) => {
  if (!content) {
    return;
  }

  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
};

const upsertLink = (rel, href) => {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
};

export const buildBreadcrumbJsonLd = (items = []) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: buildAbsoluteUrl(item.path),
  })),
});

export const buildItemListJsonLd = (items = [], pathPrefix = "") => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: buildAbsoluteUrl(`${pathPrefix}${item.path || ""}`),
    name: item.name,
  })),
});

export const usePageMetadata = ({
  title,
  description = SITE_DESCRIPTION,
  path = "/",
  robots = "index,follow",
  type = "website",
  image = DEFAULT_SOCIAL_IMAGE,
  structuredData = [],
}) => {
  useEffect(() => {
    const canonicalUrl = buildAbsoluteUrl(path);
    const imageUrl = image.startsWith("http") ? image : buildAbsoluteUrl(image);
    document.title = title;

    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", robots);
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:image", imageUrl);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", imageUrl);
    upsertLink("canonical", canonicalUrl);

    const existingScripts = document.head.querySelectorAll("script[data-reelbot-schema]");
    existingScripts.forEach((script) => script.remove());

    structuredData.filter(Boolean).forEach((entry, index) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-reelbot-schema", String(index));
      script.text = JSON.stringify(entry);
      document.head.appendChild(script);
    });

    return () => {
      document.head.querySelectorAll("script[data-reelbot-schema]").forEach((script) => script.remove());
    };
  }, [description, image, path, robots, structuredData, title, type]);
};
