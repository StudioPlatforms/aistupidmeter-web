'use client';

import { useState, useRef, useCallback } from 'react';
import { renderMarkdown } from './forum-utils';

interface PostEditorProps {
  initialContent?: string;
  onSubmit: (content: string) => void | Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export default function PostEditor({
  initialContent = '',
  onSubmit,
  onCancel,
  placeholder = 'Write your reply… (Markdown supported)',
  submitLabel = 'SUBMIT',
  isSubmitting = false,
}: PostEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = useCallback(
    (before: string, after: string = '') => {
      const ta = textareaRef.current;
      if (!ta) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = content.substring(start, end);
      const newText =
        content.substring(0, start) +
        before +
        selected +
        after +
        content.substring(end);

      setContent(newText);

      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.focus();
        const newPos = start + before.length + selected.length + after.length;
        ta.setSelectionRange(
          start + before.length,
          start + before.length + selected.length
        );
      });
    },
    [content]
  );

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;
    await onSubmit(content.trim());
    if (!initialContent) {
      setContent('');
      setShowPreview(false);
    }
  };

  return (
    <div className="rv4-forum-editor">
      {/* Toolbar */}
      <div className="rv4-forum-editor-toolbar">
        <button
          type="button"
          onClick={() => insertMarkdown('**', '**')}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => insertMarkdown('*', '*')}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => insertMarkdown('`', '`')}
          title="Inline code"
        >
          {'</>'}
        </button>
        <button
          type="button"
          onClick={() => insertMarkdown('\n```\n', '\n```\n')}
          title="Code block"
        >
          {'{ }'}
        </button>
        <button
          type="button"
          onClick={() => insertMarkdown('[', '](url)')}
          title="Link"
        >
          🔗
        </button>
        <button
          type="button"
          onClick={() => insertMarkdown('> ', '')}
          title="Quote"
        >
          ❝
        </button>

        <div className="separator" />

        <button
          type="button"
          className={showPreview ? 'active' : ''}
          onClick={() => setShowPreview(!showPreview)}
          title="Toggle preview"
        >
          {showPreview ? 'EDIT' : 'PREVIEW'}
        </button>
      </div>

      {/* Textarea / Preview */}
      {showPreview ? (
        <div
          className="rv4-forum-editor-preview rv4-forum-post-content"
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(content) || '<em style="color: var(--phosphor-dim)">Nothing to preview</em>',
          }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          className="rv4-forum-editor-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          rows={8}
        />
      )}

      {/* Actions */}
      <div className="rv4-forum-editor-actions">
        {onCancel && (
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            CANCEL
          </button>
        )}
        <button
          type="button"
          className="btn-submit"
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
        >
          {isSubmitting ? 'POSTING…' : submitLabel}
        </button>
      </div>
    </div>
  );
}
