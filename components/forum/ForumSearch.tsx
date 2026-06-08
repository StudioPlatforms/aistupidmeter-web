'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ForumSearchProps {
  initialQuery?: string;
}

export default function ForumSearch({ initialQuery = '' }: ForumSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/router/forum/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <form className="rv4-forum-search" onSubmit={handleSubmit}>
      <input
        type="text"
        className="rv4-forum-search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search topics…"
        aria-label="Search forum"
      />
    </form>
  );
}
