'use client';

import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ForumBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function ForumBreadcrumbs({ items }: ForumBreadcrumbsProps) {
  // Always prepend "Forum" as first item
  const allItems: BreadcrumbItem[] = [
    { label: 'Forum', href: '/router/forum' },
    ...items,
  ];

  return (
    <nav className="rv4-forum-breadcrumbs">
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;

        return (
          <span key={index} style={{ display: 'flex', alignItems: 'center' }}>
            {index > 0 && <span className="rv4-forum-breadcrumb-separator" />}
            {isLast ? (
              <span className="rv4-forum-breadcrumb-current">{item.label}</span>
            ) : (
              <Link href={item.href || '#'} className="rv4-forum-breadcrumb">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
