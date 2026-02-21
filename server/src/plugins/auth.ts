import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';

export default fp(async (fastify) => {
    // Register cookie plugin
    fastify.register(cookie, {
        secret: process.env.COOKIE_SECRET || 'supersecretcookie_default_dev_only', // Use a real secret in production
        hook: 'onRequest'
    });

    // Register JWT plugin
    fastify.register(jwt, {
        secret: process.env.JWT_SECRET || 'supersecretjwt_default_dev_only',
        cookie: {
            cookieName: 'token',
            signed: false
        }
    });

    // Decorate fastify with an authentication middleware
    fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized: Invalid or missing token' });
        }
    });

    // Decorate fastify with an admin middleware
    fastify.decorate('requireAdmin', async function (request: FastifyRequest, reply: FastifyReply) {
        try {
            await request.jwtVerify();
            const user = request.user as { role: string };
            if (user.role !== 'ADMIN') {
                reply.status(403).send({ error: 'Forbidden: Admin access only' });
            }
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized: Invalid or missing token' });
        }
    });
});

// Add type declarations for Fastify
declare module 'fastify' {
    export interface FastifyInstance {
        authenticate: any;
        requireAdmin: any;
    }
}
