import * as React from 'react';
import VariantEditor from './VariantEditor';
import PriceMatrix from './PriceMatrix';
import type { CurrencyRate } from '@/lib/pricing/auto-price';
import InventoryToggle from './InventoryToggle';
import MediaPanel from './MediaPanel';
import type { ProductDraft, ProductStatus } from './types';
import { emptyDraft, fromServer, toServerPayload } from './types';

type TabKey = 'general' | 'variants' | 'pricing' | 'inventory' | 'media';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'general', label: 'General' },
  { key: 'variants', label: 'Variants' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'media', label: 'Media' },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export interface ProductFormProps {
  initialProduct?: any;
  currencies: string[];
  defaultCurrency: string;
  rates: Record<string, CurrencyRate>;
  storageConfigured: boolean;
  mode: 'create' | 'edit';
}

const ProductForm: React.FC<ProductFormProps> = ({
  initialProduct,
  currencies,
  defaultCurrency,
  rates,
  storageConfigured,
  mode,
}) => {
  const [draft, setDraft] = React.useState<ProductDraft>(() =>
    initialProduct ? fromServer(initialProduct) : emptyDraft(),
  );
  const [tab, setTab] = React.useState<TabKey>('general');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [handleEdited, setHandleEdited] = React.useState(!!initialProduct);

  React.useEffect(() => {
    if (handleEdited || mode === 'edit') return;
    setDraft((d) => ({ ...d, handle: slugify(d.title) }));
  }, [draft.title, handleEdited, mode]);

  const submit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = toServerPayload(draft);
      const url = mode === 'create' ? '/api/products' : `/api/products/${draft.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; product?: any };
      if (!res.ok) {
        setMessage({ tone: 'bad', text: data?.error ?? 'Failed to save' });
        return;
      }
      setMessage({ tone: 'ok', text: 'Saved' });
      if (mode === 'create' && data.product?.id) {
        window.location.href = `/products/${data.product.id}`;
      } else if (data.product) {
        setDraft(fromServer(data.product));
      }
    } catch (err) {
      setMessage({ tone: 'bad', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft.id) return;
    if (!confirm('Delete this product? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${draft.id}`, { method: 'DELETE' });
      if (res.ok) {
        window.location.href = '/products';
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage({ tone: 'bad', text: data?.error ?? 'Failed to delete' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 border-b border-ds-line px-1">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                active
                  ? 'px-3 py-2 text-[13px] font-medium text-ds-ink border-b-2 border-ds-ink -mb-px'
                  : 'px-3 py-2 text-[13px] font-medium text-ds-muted hover:text-ds-ink border-b-2 border-transparent -mb-px'
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {message && (
        <div
          className={
            message.tone === 'ok'
              ? 'text-[12.5px] bg-ds-okBg border border-ds-okBorder text-ds-okText rounded-[8px] px-3 py-2'
              : 'text-[12.5px] bg-ds-badBg border border-ds-badBorder text-ds-badText rounded-[8px] px-3 py-2'
          }
        >
          {message.text}
        </div>
      )}

      <div className="bg-ds-card border border-ds-line rounded-[10px] p-6">
        {tab === 'general' && (
          <div className="space-y-4 max-w-2xl">
            <Field label="Title">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
              />
            </Field>
            <Field label="Handle" hint="URL-safe identifier (auto-derived from title)">
              <input
                value={draft.handle}
                onChange={(e) => {
                  setHandleEdited(true);
                  setDraft({ ...draft, handle: e.target.value });
                }}
                className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent font-ds-mono tabular"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as ProductStatus })
                  }
                  className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </Field>
              <Field label="Vendor">
                <input
                  value={draft.vendor}
                  onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
                  className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
                />
              </Field>
              <Field label="Product type">
                <input
                  value={draft.productType}
                  onChange={(e) => setDraft({ ...draft, productType: e.target.value })}
                  className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
                />
              </Field>
            </div>
            <Field label="Tags" hint="Comma-separated">
              <input
                value={draft.tags.join(', ')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    tags: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
              />
            </Field>
          </div>
        )}

        {tab === 'variants' && (
          <VariantEditor
            variants={draft.variants}
            onChange={(variants) => setDraft({ ...draft, variants })}
          />
        )}

        {tab === 'pricing' && (
          <PriceMatrix
            variants={draft.variants}
            currencies={currencies}
            defaultCurrency={defaultCurrency}
            rates={rates}
            onChange={(variants) => setDraft({ ...draft, variants })}
          />
        )}

        {tab === 'inventory' && (
          <InventoryToggle
            trackInventory={draft.trackInventory}
            variants={draft.variants}
            onChangeTrack={(trackInventory) => setDraft({ ...draft, trackInventory })}
            onChangeVariants={(variants) => setDraft({ ...draft, variants })}
          />
        )}

        {tab === 'media' && (
          <MediaPanel
            images={draft.images}
            storageConfigured={storageConfigured}
            productId={draft.id}
            onChange={(images) => setDraft({ ...draft, images })}
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {mode === 'edit' && (
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="h-8 px-3 text-[13px] rounded-[7px] border border-ds-badBorder bg-ds-card text-ds-bad hover:bg-ds-badBg disabled:opacity-50"
          >
            Delete
          </button>
        )}
        <a
          href="/products"
          className="h-8 px-3 text-[13px] rounded-[7px] border border-ds-line bg-ds-card text-ds-ink hover:bg-[#F9FAFB] no-underline inline-flex items-center"
        >
          Cancel
        </a>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !draft.title.trim()}
          className="h-8 px-3 text-[13px] rounded-[7px] border border-ds-ink bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50"
        >
          {saving ? 'Saving...' : mode === 'create' ? 'Create product' : 'Save changes'}
        </button>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div className="space-y-1">
    <label className="block text-[12.5px] font-medium text-ds-ink">{label}</label>
    {children}
    {hint && <div className="text-[11.5px] text-ds-muted">{hint}</div>}
  </div>
);

export default ProductForm;
