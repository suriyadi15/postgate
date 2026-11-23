import { timingSafeEqual } from 'node:crypto';

import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { parseConfigHeader, runWithEnv } from './context';
import { badRequest, HttpError } from './errors';
import { twitter } from './routes/twitter';
import type { Routes } from './routes/types';

const sameKey = (given: string, expected: string) => {
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
};

export const createApp = (accessKey: string) => {
    const app = new Hono();

    app.get('/healthz', (c) => c.text('ok'));

    app.use('*', async (c, next) => {
        const bearer = c.req.header('authorization')?.match(/^Bearer (.+)$/i)?.[1];
        if (!sameKey(bearer ?? '', accessKey)) {
            throw new HttpError(401, 'Access denied, send the access key as "Authorization: Bearer <key>".');
        }
        const header = c.req.header('x-postgate-config');
        await runWithEnv(header === undefined ? {} : parseConfigHeader(header), () => next());
    });

    app.use(
        '*',
        bodyLimit({
            maxSize: 32 * 1024 * 1024,
            onError: () => {
                throw new HttpError(413, 'The body is too large.');
            },
        })
    );

    const groups: Record<string, Routes> = { twitter };
    for (const [namespace, routes] of Object.entries(groups)) {
        for (const [path, methods] of Object.entries(routes)) {
            for (const [method, handler] of Object.entries(methods)) {
                app.on(method, `/${namespace}${path}`, async (c) => {
                    let body: unknown;
                    if (method === 'POST') {
                        try {
                            body = await c.req.json();
                        } catch {
                            throw badRequest('The body must be valid JSON.');
                        }
                    }
                    const result = await handler!({ params: c.req.param() as Record<string, string>, body });
                    c.header('Cache-Control', 'no-store');
                    return c.json(result);
                });
            }
        }
    }

    app.notFound((c) => c.json({ error: { message: `No route ${c.req.method} ${c.req.path}` } }, 404));
    app.onError((error, c) => {
        if (error instanceof HttpError) {
            return c.json({ error: { message: error.message } }, error.status);
        }
        console.error(`Unhandled error on ${c.req.path}: ${error.stack ?? error}`);
        return c.json({ error: { message: 'Internal error' } }, 500);
    });

    return app;
};
