'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import ForumLayout from '@/components/forum/ForumLayout';
import ForumAdminSidebar from '@/components/forum/ForumAdminSidebar';

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  display_order?: number;
  is_locked?: number;
  topic_count?: number;
  post_count?: number;
}

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  icon: string;
  display_order: number;
  is_locked: boolean;
}

const emptyForm: CategoryForm = {
  name: '',
  slug: '',
  description: '',
  icon: '💬',
  display_order: 0,
  is_locked: false,
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function ForumAdminCategories() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const role = (session?.user as any)?.role || 'user';
  const isAdmin = role === 'admin' || role === 'superadmin';

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/forum/categories');
      const data = await res.json();
      if (data.success && data.categories) {
        setCategories(data.categories);
      } else {
        setError(data.error || 'Failed to load categories');
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (!isAdmin) return;
    fetchCategories();
  }, [status, isAdmin, fetchCategories]);

  const openAddModal = () => {
    setEditingCategory(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      icon: cat.icon || '💬',
      display_order: cat.display_order || 0,
      is_locked: cat.is_locked === 1,
    });
    setShowModal(true);
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: editingCategory ? prev.slug : generateSlug(name),
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim() || generateSlug(form.name),
        description: form.description.trim() || undefined,
        icon: form.icon.trim() || '💬',
        display_order: form.display_order,
        is_locked: form.is_locked,
      };

      let res: Response;
      if (editingCategory) {
        res = await fetch(`/api/forum/categories/${editingCategory.slug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/forum/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (data.success || res.ok) {
        setShowModal(false);
        setForm(emptyForm);
        setEditingCategory(null);
        await fetchCategories();
      } else {
        setError(data.error || 'Failed to save category');
      }
    } catch {
      setError('Failed to save category.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setError('');

    try {
      const res = await fetch(`/api/forum/categories/${deleteConfirm.slug}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success || res.ok) {
        setDeleteConfirm(null);
        await fetchCategories();
      } else {
        setError(data.error || 'Failed to delete category');
      }
    } catch {
      setError('Failed to delete category.');
    } finally {
      setDeleting(false);
    }
  };

  if (status === 'loading') {
    return (
      <ForumLayout title="FORUM ADMIN" subtitle="Category Management">
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING</span>
        </div>
      </ForumLayout>
    );
  }

  if (!isAdmin) {
    return (
      <ForumLayout>
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <div className="rv4-page-title">ACCESS DENIED</div>
          </div>
        </div>
        <div className="rv4-body">
          <div className="rv4-error-banner">
            🔒 You don&apos;t have permission to access this page. Required role: admin or higher.
          </div>
        </div>
      </ForumLayout>
    );
  }

  return (
    <ForumLayout title="FORUM ADMIN" subtitle="Category Management">
      <ForumAdminSidebar currentPath={pathname} />

      {error && <div className="rv4-error-banner" style={{ marginBottom: '14px' }}>{error}</div>}

      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ fontSize: '12px', color: 'var(--phosphor-dim)' }}>
          {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
        </div>
        <button className="rv4-ctrl-btn primary" onClick={openAddModal}>
          + Add Category
        </button>
      </div>

      {loading && (
        <div className="rv4-loading" style={{ minHeight: '200px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING CATEGORIES</span>
        </div>
      )}

      {/* Desktop Table */}
      {!loading && categories.length > 0 && (
        <div className="rv4-table-wrapper" style={{ marginBottom: '14px' }}>
          <table className="rv4-table">
            <thead>
              <tr>
                <th>Icon</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Topics</th>
                <th>Posts</th>
                <th>Order</th>
                <th>Locked</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td style={{ fontSize: '18px', textAlign: 'center' }}>{cat.icon || '💬'}</td>
                  <td className="td-green">{cat.name}</td>
                  <td className="td-dim td-mono">{cat.slug}</td>
                  <td className="td-dim" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat.description || '—'}
                  </td>
                  <td>{cat.topic_count || 0}</td>
                  <td>{cat.post_count || 0}</td>
                  <td>{cat.display_order || 0}</td>
                  <td>
                    {cat.is_locked ? (
                      <span style={{ color: 'var(--amber-warning)', fontSize: '11px', fontWeight: 'bold' }}>🔒 YES</span>
                    ) : (
                      <span className="td-dim">No</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="rv4-ctrl-btn" onClick={() => openEditModal(cat)} style={{ padding: '4px 10px', fontSize: '10px' }}>
                        Edit
                      </button>
                      <button className="rv4-ctrl-btn danger" onClick={() => setDeleteConfirm(cat)} style={{ padding: '4px 10px', fontSize: '10px' }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && categories.length === 0 && (
        <div className="rv4-forum-empty">
          <div className="empty-icon">📁</div>
          <div className="empty-title">No Categories Yet</div>
          <div className="empty-text">Create your first forum category to get started.</div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="rv4-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="rv4-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rv4-modal-header">
              <div className="rv4-modal-title">
                {editingCategory ? '✏️ Edit Category' : '➕ Add Category'}
              </div>
              <button className="rv4-modal-close" onClick={() => setShowModal(false)}>
                ✕ CLOSE
              </button>
            </div>
            <div className="rv4-modal-body">
              {/* Name */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Category name"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--terminal-black, #0a0a0a)',
                    border: '1px solid rgba(192,192,192,0.3)',
                    borderRadius: '2px',
                    color: 'var(--phosphor-green)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Slug */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Slug
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="auto-generated-from-name"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--terminal-black, #0a0a0a)',
                    border: '1px solid rgba(192,192,192,0.3)',
                    borderRadius: '2px',
                    color: 'var(--phosphor-dim)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the category…"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--terminal-black, #0a0a0a)',
                    border: '1px solid rgba(192,192,192,0.3)',
                    borderRadius: '2px',
                    color: 'var(--phosphor-green)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Icon & Display Order Row */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Icon (emoji)
                  </label>
                  <input
                    type="text"
                    value={form.icon}
                    onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                    placeholder="💬"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--terminal-black, #0a0a0a)',
                      border: '1px solid rgba(192,192,192,0.3)',
                      borderRadius: '2px',
                      color: 'var(--phosphor-green)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm((prev) => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--terminal-black, #0a0a0a)',
                      border: '1px solid rgba(192,192,192,0.3)',
                      borderRadius: '2px',
                      color: 'var(--phosphor-green)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Is Locked */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_locked}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_locked: e.target.checked }))}
                    style={{ accentColor: 'var(--phosphor-green)' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--phosphor-dim)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🔒 Lock Category (only admins can post)
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="rv4-ctrl-btn"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  CANCEL
                </button>
                <button
                  className="rv4-ctrl-btn primary"
                  onClick={handleSubmit}
                  disabled={submitting || !form.name.trim()}
                  style={{ opacity: submitting || !form.name.trim() ? 0.5 : 1 }}
                >
                  {submitting ? 'SAVING…' : editingCategory ? 'UPDATE CATEGORY' : 'CREATE CATEGORY'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="rv4-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="rv4-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="rv4-modal-header">
              <div className="rv4-modal-title" style={{ color: 'var(--red-alert)' }}>
                ⚠️ Delete Category
              </div>
              <button className="rv4-modal-close" onClick={() => setDeleteConfirm(null)}>
                ✕ CLOSE
              </button>
            </div>
            <div className="rv4-modal-body">
              <p style={{ color: 'var(--phosphor-dim)', fontSize: '12px', marginBottom: '8px' }}>
                Are you sure you want to delete the category <strong style={{ color: 'var(--phosphor-green)' }}>&quot;{deleteConfirm.name}&quot;</strong>?
              </p>
              <p style={{ color: 'var(--red-alert)', fontSize: '11px', marginBottom: '20px' }}>
                ⚠️ This action cannot be undone. All topics and posts in this category will be affected.
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="rv4-ctrl-btn"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                >
                  CANCEL
                </button>
                <button
                  className="rv4-ctrl-btn danger"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ opacity: deleting ? 0.5 : 1 }}
                >
                  {deleting ? 'DELETING…' : 'DELETE CATEGORY'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ForumLayout>
  );
}
