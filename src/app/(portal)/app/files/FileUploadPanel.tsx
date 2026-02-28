'use client';

import { useState } from 'react';

type WorkItemOption = {
  id: string;
  title: string | null;
  type: string;
};

export default function FileUploadPanel({
  workItems,
  onUploaded,
  readOnly,
}: {
  workItems: WorkItemOption[];
  onUploaded?: () => void;
  readOnly: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState('');
  const [workItemId, setWorkItemId] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload() {
    if (!file || readOnly) return;

    setIsUploading(true);
    setStatus('Preparing upload...');

    try {
      const presign = await fetch('/api/files/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
        }),
      });

      if (!presign.ok) throw new Error(await presign.text());
      const { uploadUrl, fileUrl } = await presign.json();

      setStatus('Uploading file...');
      const uploaded = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!uploaded.ok) throw new Error('Upload to storage failed');

      setStatus('Finalizing record...');
      const confirm = await fetch('/api/files/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileUrl,
          fileType: file.type || undefined,
          fileSize: file.size,
          workItemId: workItemId || undefined,
          tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      if (!confirm.ok) throw new Error(await confirm.text());

      setStatus('Upload complete.');
      setFile(null);
      setTags('');
      setWorkItemId('');
      onUploaded?.();
    } catch (error) {
      setStatus((error as Error).message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="portal-surface p-4 space-y-3">
      <h3 className="font-semibold text-lg text-[var(--ia-text-strong)]">Upload File Asset</h3>
      <input
        type="file"
        disabled={readOnly || isUploading}
        onChange={(event) => setFile(event.target.files?.[0] || null)}
        className="block w-full text-sm text-[var(--ia-text)]"
      />
      <select
        value={workItemId}
        onChange={(event) => setWorkItemId(event.target.value)}
        disabled={readOnly || isUploading}
        className="w-full rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)]"
      >
        <option value="">No linked work item</option>
        {workItems.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title || item.id} ({item.type})
          </option>
        ))}
      </select>
      <input
        value={tags}
        onChange={(event) => setTags(event.target.value)}
        disabled={readOnly || isUploading}
        placeholder="tags (comma-separated)"
        className="w-full rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] placeholder:text-[var(--ia-text-muted)]"
      />
      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || readOnly || isUploading}
        className="rounded-[10px] border border-[#d4af3766] bg-[var(--ia-brand-gold-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ia-brand-gold-highlight)] disabled:opacity-50"
      >
        {isUploading ? 'Uploading...' : 'Upload'}
      </button>
      {status ? <p className="text-sm text-[var(--ia-text-muted)]">{status}</p> : null}
    </div>
  );
}
