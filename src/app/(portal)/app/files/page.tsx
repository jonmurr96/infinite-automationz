import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPortalUserContext, isWorkspaceReadOnly } from '@/lib/portal';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import FileUploadPanel from './FileUploadPanel';

export default async function FilesPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const context = await getPortalUserContext(session.userId);
  if (!context) return <div>No workspace found.</div>;

  const { workspace } = context;
  const readOnly = isWorkspaceReadOnly(workspace);
  const query = (searchParams?.q || '').trim().toLowerCase();

  const [files, workItems] = await Promise.all([
    prisma.fileAsset.findMany({
      where: { workspaceId: workspace.id },
      include: { workItem: true, uploadedBy: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.workItem.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, title: true, type: true },
      orderBy: { updatedAt: 'desc' },
      take: 75,
    }),
  ]);

  const filtered = query
    ? files.filter((file) => {
      const tags = file.tagsJson ? (JSON.parse(file.tagsJson) as string[]) : [];
      return file.fileName.toLowerCase().includes(query) || tags.some((tag) => tag.toLowerCase().includes(query));
    })
    : files;

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-6">
      <SectionHeader
        eyebrow="Asset Library"
        title="Files"
        description="Upload, tag, search, and link assets directly to work items."
        rightSlot={
          <form className="flex gap-2" action="/app/files" method="GET">
            <input
              name="q"
              defaultValue={searchParams?.q || ''}
              placeholder="Search by file or tag"
              className="rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] placeholder:text-[var(--ia-text-muted)]"
            />
            <button type="submit" className="rounded-[10px] border border-[var(--ia-border)] px-3 py-2 text-xs uppercase tracking-[0.12em] text-[var(--ia-text)] hover:bg-white/[0.08]">
              Search
            </button>
          </form>
        }
      />

      <FileUploadPanel workItems={workItems} readOnly={readOnly} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-white/[0.03] border-b border-[var(--ia-border)] text-[var(--ia-text-muted)] uppercase text-[10px] tracking-[0.14em]">
              <tr>
                <th className="py-3 px-4 font-semibold">File</th>
                <th className="py-3 px-4 font-semibold">Linked Item</th>
                <th className="py-3 px-4 font-semibold">Tags</th>
                <th className="py-3 px-4 font-semibold">Uploaded By</th>
                <th className="py-3 px-4 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filtered.map((file) => {
                const tags = file.tagsJson ? (JSON.parse(file.tagsJson) as string[]) : [];
                return (
                  <tr key={file.id} className="hover:bg-white/[0.03] transition-colors duration-150">
                    <td className="py-4 px-4">
                      <a href={file.fileUrl} target="_blank" className="text-[#bfdbfe] underline break-all">{file.fileName}</a>
                    </td>
                    <td className="py-4 px-4 text-[var(--ia-text)]">
                      {file.workItem ? (
                        <a href={`/app/services/${file.workItem.type}/${file.workItem.id}`} className="underline">
                          {file.workItem.title || file.workItem.id}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="py-4 px-4 text-[var(--ia-text-muted)]">{tags.length ? tags.join(', ') : '-'}</td>
                    <td className="py-4 px-4 text-[var(--ia-text-muted)]">{file.uploadedBy?.displayName || file.uploadedBy?.email || '-'}</td>
                    <td className="py-4 px-4 text-[var(--ia-text-muted)]">{new Date(file.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState title="No files found" description={query ? 'Try a different search term or clear the filter.' : 'Upload your first file to begin.'} />
      ) : null}
    </div>
  );
}
