/**
 * One JSON-LD script. The "<" escape stops a string inside the data from closing the script tag.
 * Pass a graphLd(...) from lib/seo.ts; one script per page keeps the markup readable.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
