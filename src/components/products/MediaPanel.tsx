import * as React from 'react';
import type { ImageDraft } from './types';
import { newClientId } from './types';

export interface MediaPanelProps {
  images: ImageDraft[];
  storageConfigured: boolean;
  productId?: string;
  onChange: (next: ImageDraft[]) => void;
}

interface UploadState {
  uploading: boolean;
  error: string | null;
}

const MediaPanel: React.FC<MediaPanelProps> = ({ images, storageConfigured, productId, onChange }) => {
  const [uploadState, setUploadState] = React.useState<UploadState>({ uploading: false, error: null });
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const canUpload = storageConfigured && !!productId;

  const remove = (clientId: string) => {
    onChange(images.filter((i) => i.clientId !== clientId).map((i, idx) => ({ ...i, position: idx })));
  };

  const move = (clientId: string, dir: -1 | 1) => {
    const idx = images.findIndex((i) => i.clientId === clientId);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next.map((i, p) => ({ ...i, position: p })));
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!canUpload) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploadState({ uploading: true, error: null });
    let appended: ImageDraft[] = [...images];
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/products/${productId}/upload-image`, {
          method: 'POST',
          body: fd,
        });
        const data = (await res.json().catch(() => ({}))) as {
          image?: { id: string; src: string; alt: string | null; position: number };
          error?: string;
          message?: string;
        };
        if (!res.ok || !data.image) {
          throw new Error(data.message || data.error || `Upload failed (${res.status})`);
        }
        appended = [
          ...appended,
          {
            clientId: newClientId(),
            id: data.image.id,
            src: data.image.src,
            alt: data.image.alt,
            position: appended.length,
          },
        ];
        onChange(appended);
      }
      setUploadState({ uploading: false, error: null });
    } catch (err) {
      setUploadState({ uploading: false, error: (err as Error).message });
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (!canUpload) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void uploadFiles(files);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void uploadFiles(files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {!storageConfigured && (
        <div className="text-[12.5px] text-ds-warnText bg-ds-warnBg border border-ds-warnBorder rounded-[8px] px-3 py-2">
          Configure S3 in Settings → Storage to enable image uploads.
        </div>
      )}
      {storageConfigured && !productId && (
        <div className="text-[12.5px] text-ds-muted bg-ds-surface2 border border-ds-line rounded-[8px] px-3 py-2">
          Save the product first to enable image uploads.
        </div>
      )}

      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={
            dragOver
              ? 'border-2 border-dashed border-ds-accent bg-ds-accentBg rounded-[10px] p-6 text-center transition-colors'
              : 'border-2 border-dashed border-ds-line bg-ds-card rounded-[10px] p-6 text-center transition-colors'
          }
        >
          <div className="text-[13px] text-ds-ink mb-2">
            Drag and drop images here, or
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState.uploading}
            className="h-8 px-3 text-[13px] rounded-[7px] border border-ds-line bg-ds-card text-ds-ink hover:bg-[#F9FAFB] disabled:opacity-50"
          >
            {uploadState.uploading ? 'Uploading…' : 'Choose files'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            onChange={onFileInputChange}
            className="hidden"
          />
          <div className="text-[11.5px] text-ds-muted mt-2">
            JPG, PNG, WebP, GIF, AVIF. Max 10MB.
          </div>
          {uploadState.error && (
            <div className="text-[12px] text-ds-bad mt-2">{uploadState.error}</div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {images.length === 0 ? (
          <div className="text-[12.5px] text-ds-muted">No images yet.</div>
        ) : (
          images.map((img, idx) => (
            <div
              key={img.clientId}
              className="flex items-center gap-3 bg-ds-card border border-ds-line rounded-[8px] p-2"
            >
              <img
                src={img.src}
                alt={img.alt ?? ''}
                className="w-12 h-12 rounded-md object-cover border border-ds-line"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] text-ds-ink truncate">{img.src}</div>
                {img.alt && <div className="text-[11.5px] text-ds-muted truncate">{img.alt}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => move(img.clientId, -1)}
                  disabled={idx === 0}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-ds-line text-ds-slate hover:bg-ds-surface2 disabled:opacity-40"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(img.clientId, 1)}
                  disabled={idx === images.length - 1}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-ds-line text-ds-slate hover:bg-ds-surface2 disabled:opacity-40"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(img.clientId)}
                  className="h-7 px-2 text-[12px] rounded-md border border-ds-line text-ds-bad hover:bg-ds-surface2"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MediaPanel;
