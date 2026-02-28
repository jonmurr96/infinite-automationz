'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { assertWorkItemAccess, assertWorkspaceMutable } from '@/lib/portal';
import { canTransitionStatus, parseWorkItemData, stringifyWorkItemData } from '@/lib/work-item';

export async function updateItemStatus(id: string, newStatus: string, revisionReason?: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const { user, workspace, item } = await assertWorkItemAccess(session.userId, id);
    assertWorkspaceMutable(workspace);

    if (
        !canTransitionStatus({
            type: item.type,
            currentStatus: item.status,
            nextStatus: newStatus,
            isAdmin: user.role === 'ADMIN',
        })
    ) {
        throw new Error('Invalid status transition');
    }

    const data = parseWorkItemData(item.dataJson);
    const updateData: Parameters<typeof prisma.workItem.update>[0]['data'] = {
        status: newStatus,
    };

    if (newStatus === 'Changes Requested') {
        updateData.revisionCount = { increment: 1 };
        if (revisionReason) {
            data.revisionReason = revisionReason;
            updateData.dataJson = stringifyWorkItemData(data);
        }
    }

    if (user.role === 'CLIENT' && newStatus === 'Approved') {
        await prisma.approvalSnapshot.create({
            data: {
                snapshotData: item.dataJson || '{}',
                approverId: user.id,
                workItemId: item.id,
            },
        });
    }

    await prisma.workItem.update({
        where: { id },
        data: updateData,
    });

    await prisma.activityLog.create({
        data: {
            workspaceId: workspace.id,
            workItemId: item.id,
            actorId: user.id,
            action: 'WORK_ITEM_STATUS_CHANGED',
            metadataJson: JSON.stringify({
                from: item.status,
                to: newStatus,
                revisionReason: revisionReason || null,
            }),
        },
    });

    return { success: true };
}

export async function markOutOfScope(id: string, reason: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const { user, workspace, item } = await assertWorkItemAccess(session.userId, id);
    if (user.role !== 'ADMIN') throw new Error('Forbidden');
    assertWorkspaceMutable(workspace);

    const paidChangeRequest = await prisma.workItem.create({
        data: {
            workspaceId: workspace.id,
            type: 'paid_change_request',
            status: 'Draft',
            title: `Paid Change Request: ${item.title || item.id}`,
            description: reason,
            priority: 'HIGH',
        },
    });

    const data = parseWorkItemData(item.dataJson);
    data.outOfScopeReason = reason;
    data.paidChangeRequestId = paidChangeRequest.id;

    await prisma.workItem.update({
        where: { id: item.id },
        data: {
            isOutOfScope: true,
            dataJson: stringifyWorkItemData(data),
        },
    });

    await prisma.notification.create({
        data: {
            workspaceId: workspace.id,
            type: 'OUT_OF_SCOPE',
            title: 'Out-of-scope item detected',
            message: `A paid change request draft was created for "${item.title || item.id}".`,
            link: `/app/services/${item.type}/${item.id}`,
        },
    });

    await prisma.activityLog.create({
        data: {
            workspaceId: workspace.id,
            workItemId: item.id,
            actorId: user.id,
            action: 'WORK_ITEM_MARKED_OUT_OF_SCOPE',
            metadataJson: JSON.stringify({
                reason,
                paidChangeRequestId: paidChangeRequest.id,
            }),
        },
    });

    return { success: true, paidChangeRequestId: paidChangeRequest.id };
}

export async function addPostedUrl(id: string, postedUrl: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const { user, workspace, item } = await assertWorkItemAccess(session.userId, id);
    if (user.role !== 'ADMIN') throw new Error('Forbidden');
    assertWorkspaceMutable(workspace);

    const data = parseWorkItemData(item.dataJson);
    const postedUrls = Array.isArray(data.postedUrls) ? data.postedUrls : [];
    postedUrls.push(postedUrl);
    data.postedUrls = postedUrls;

    await prisma.workItem.update({
        where: { id: item.id },
        data: {
            status: 'Posted',
            postedAt: new Date(),
            dataJson: stringifyWorkItemData(data),
        },
    });

    await prisma.activityLog.create({
        data: {
            workspaceId: workspace.id,
            workItemId: item.id,
            actorId: user.id,
            action: 'WORK_ITEM_POSTED_URL_ADDED',
            metadataJson: JSON.stringify({ postedUrl }),
        },
    });

    return { success: true };
}
