'use server';

import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { setSessionToken } from '@/lib/auth';

export async function initializeOnboarding(formData: FormData) {
    const email = formData.get('email') as string;
    const displayName = formData.get('displayName') as string;
    const password = formData.get('password') as string;

    if (!email || !displayName || !password) {
        return { error: 'Please fill out all fields.' };
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        return { error: 'User setup failed. Please contact support.' };
    }

    await prisma.user.update({
        where: { email },
        data: { displayName, passwordHash },
    });

    // Log in immediately
    await setSessionToken(user.id, user.role);

    return { success: true };
}
