import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/cache';
import bcrypt from 'bcryptjs';

const authSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
});

export default async function authRoutes(fastify: FastifyInstance) {
    fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { email, password } = authSchema.parse(request.body);

            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return reply.status(409).send({ error: 'User already exists' });
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const user = await prisma.user.create({
                data: { email, passwordHash, role: 'USER' }
            });

            const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
            reply.setCookie('token', token, {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 // 7 days
            });

            return reply.send({ id: user.id, email: user.email, role: user.role });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Validation Error', details: error.errors });
            }
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { email, password } = authSchema.parse(request.body);

            const user = await prisma.user.findUnique({ where: { email } });
            if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
                return reply.status(401).send({ error: 'Invalid email or password' });
            }

            const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
            reply.setCookie('token', token, {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60
            });

            return reply.send({ id: user.id, email: user.email, role: user.role });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Validation Error', details: error.errors });
            }
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
        reply.clearCookie('token', { path: '/' });
        return reply.send({ message: 'Logged out' });
    });

    fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const payload = request.user as { id: string };
        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }
        return reply.send({ id: user.id, email: user.email, role: user.role });
    });
}
