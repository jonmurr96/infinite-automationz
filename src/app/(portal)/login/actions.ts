'use server';

import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { setSessionToken } from '@/lib/auth';

export async function loginAction(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { error: 'Please enter both email and password.' };
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.passwordHash) {
            return { error: 'Invalid credentials or account not setup.' };
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
            return { error: 'Invalid credentials.' };
        }

        await setSessionToken(user.id, user.role);

        return { success: true };
    } catch {
        return { error: 'Cannot fetch data from service. Please try again.' };
    }
}
