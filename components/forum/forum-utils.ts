// ═══════════════════════════════════════════════════
// Forum Utility Functions
// Date formatting & simple markdown rendering
// ═══════════════════════════════════════════════════

/**
 * Format a date string into a human-readable relative time.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Simple markdown to HTML renderer.
 * Escapes HTML first, then applies markdown transforms.
 * Returns sanitized HTML string for use with dangerouslySetInnerHTML.
 */
export function renderMarkdown(text: string): string {
  if (!text) return '';

  // Step 1: Escape HTML entities
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Step 2: Code blocks (``` ... ```) — must be before inline transforms
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Step 3: Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Step 4: Headings (## heading → <h4>, # heading → <h3>)
  html = html.replace(/^## (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^# (.+)$/gm, '<h3>$1</h3>');

  // Step 5: Bold (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Step 6: Italic (*text*)
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Step 7: Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Step 8: Blockquotes (lines starting with > )
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // Step 9: Line breaks (but not inside pre blocks)
  // Split by pre blocks, only apply <br> outside them
  const parts = html.split(/(<pre><code>[\s\S]*?<\/code><\/pre>)/);
  html = parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // inside pre block
      return part.replace(/\n/g, '<br>');
    })
    .join('');

  return html;
}

/**
 * Get initials from a username for avatar display.
 */
export function getInitials(name: string): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

/**
 * Get role badge class name.
 */
export function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'superadmin':
      return 'rv4-forum-role-badge superadmin';
    case 'admin':
      return 'rv4-forum-role-badge admin';
    case 'moderator':
      return 'rv4-forum-role-badge moderator';
    case 'banned':
      return 'rv4-forum-role-badge banned';
    default:
      return '';
  }
}

/**
 * Check if a user role can moderate (moderator, admin, superadmin).
 */
export function canModerate(role: string | undefined): boolean {
  return role === 'moderator' || role === 'admin' || role === 'superadmin';
}

/**
 * Check if a user role has admin access (admin, superadmin).
 */
export function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'superadmin';
}
