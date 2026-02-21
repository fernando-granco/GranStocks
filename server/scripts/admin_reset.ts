import { prisma } from '../src/services/cache';
import bcrypt from 'bcryptjs';

async function resetAdmin() {
    console.log('🔑 Running Superadmin Reset...');

    const email = process.env.SUPERADMIN_EMAIL;
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!email || !password) {
        console.error('❌ ERROR: SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD not set in .env');
        process.exit(1);
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const existingAdmin = await prisma.user.findUnique({
            where: { email }
        });

        if (existingAdmin) {
            await prisma.user.update({
                where: { email },
                data: { passwordHash, role: 'ADMIN' }
            });
            console.log(`✅ Success: Reset password and enforced ADMIN role for ${email}`);
        } else {
            await prisma.user.create({
                data: { email, passwordHash, role: 'ADMIN' }
            });
            console.log(`✅ Success: Created new Superadmin account for ${email}`);
        }
    } catch (error) {
        console.error('❌ Database error during reset:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

resetAdmin();
