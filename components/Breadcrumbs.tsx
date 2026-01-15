import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string; // Optional because last item shouldn't be a link
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Breadcrumb Navigation Component with Schema.org BreadcrumbList structured data
 * 
 * Usage:
 * <Breadcrumbs items={[
 *   { label: 'Home', href: '/' },
 *   { label: 'Methodology', href: '/methodology' },
 *   { label: 'Current Page' }
 * ]} />
 */
export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  // Generate BreadcrumbList structured data
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.label,
      ...(item.href && { 'item': `https://aistupidlevel.info${item.href}` })
    }))
  };

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Visual Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            
            return (
              <li key={index} className="flex items-center gap-2">
                {index > 0 && (
                  <span className="text-gray-400" aria-hidden="true">
                    /
                  </span>
                )}
                
                {isLast ? (
                  <span 
                    className="text-gray-300 font-medium"
                    aria-current="page"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href!}
                    className="text-[var(--phosphor-green)] hover:text-[var(--phosphor-dim)] transition-colors underline-offset-4 hover:underline"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
