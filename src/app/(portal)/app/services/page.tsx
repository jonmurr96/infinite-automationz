import Link from 'next/link';
import { LayersIcon } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';

export default async function ServicesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { workspaces: { include: { serviceInstances: true } } },
  });

  if (!user || user.workspaces.length === 0) return <div>No workspace found</div>;

  const workspace = user.workspaces[0];
  const isAdmin = user.role === 'ADMIN';
  const services = workspace.serviceInstances;

  const moduleMap: Record<string, { title: string; desc: string; href: string }> = {
    SOCIAL: { title: 'Social Media Automation', desc: 'Content calendar, approval, and posting workflows.', href: '/app/services/social_post' },
    WEBSITE: { title: 'AI Website', desc: 'Website changes, intake forms, and maintenance requests.', href: '/app/services/website_change' },
    RECEPTIONIST: { title: 'AI Receptionist', desc: 'Knowledge base and receptionist change requests.', href: '/app/services/receptionist_kb' },
    AVATAR: { title: 'AI Avatar / Clone', desc: 'Avatar training and content generation workflows.', href: '/app/services/avatar_request' },
    VIDEO_ADS: { title: 'AI Video Ads', desc: 'Brief, script, and final ad delivery lifecycle.', href: '/app/services/video_ad' },
    AUTOMATIONS: { title: 'Advanced Automations', desc: 'Custom workflow implementation and support.', href: '/app/services/automation_request' },
  };

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-6">
      <SectionHeader
        eyebrow="Module Access"
        title="Active Services"
        description="Access the modules provisioned from your purchased plans and bundles."
        rightSlot={<StatusPill label={`${services.length} active`} tone="gold" />}
      />

      {services.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-lg font-semibold text-[var(--ia-text-strong)]">No active service modules</p>
          <p className="text-sm text-[var(--ia-text-muted)] mt-2">Your modules appear here after provisioning from checkout/webhook flow.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((mod) => {
            const mapped = moduleMap[mod.moduleType];
            if (!mapped) return null;
            return (
              <Link key={mod.id} href={mapped.href}>
                <Card className="h-full p-5 hover:border-[var(--ia-border-strong)] hover:-translate-y-0.5 transition-all duration-220">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-[10px] border border-[#d4af3766] bg-[var(--ia-brand-gold-soft)] text-[var(--ia-brand-gold-highlight)] flex items-center justify-center">
                      <LayersIcon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--ia-text-strong)]">{mapped.title}</h3>
                      <StatusPill label="Active" compact tone="success" />
                    </div>
                  </div>
                  <p className="text-sm text-[var(--ia-text)] mt-4 leading-relaxed">{mapped.desc}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {isAdmin ? (
        <Card className="p-4">
          <h3 className="text-sm uppercase tracking-[0.14em] text-[var(--ia-text-muted)]">Admin Context</h3>
          <p className="text-sm text-[var(--ia-text)] mt-2">As admin, you can review module workflows and operate across all customer workspaces via preview mode.</p>
        </Card>
      ) : null}
    </div>
  );
}
