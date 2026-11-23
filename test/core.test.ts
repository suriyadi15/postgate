import { afterEach, describe, expect, test } from 'bun:test';

import { createApp } from '../src/app';
import { clearCache } from '../src/cache';
import { parseConfigHeader } from '../src/context';
import { HttpError } from '../src/errors';
import { buildCreateTweetVariables, categoryOf, checkMedia, chunks, mapGraphqlError, tweetIdOf } from '../src/platforms/twitter';

const app = createApp('k');
const auth = { authorization: 'Bearer k' };

afterEach(clearCache);

describe('config header', () => {
    test('accepts the token and a proxy', () => {
        expect(parseConfigHeader('{"TWITTER_AUTH_TOKEN":"t","PROXY_URI":"socks5h://u:p@h:1080"}')).toEqual({ TWITTER_AUTH_TOKEN: 't', PROXY_URI: 'socks5h://u:p@h:1080' });
    });
    test.each([
        ['not json', 'nope'],
        ['an array', '[]'],
        ['an unknown name', '{"ACCESS_KEY":"x"}'],
        ['an empty value', '{"TWITTER_AUTH_TOKEN":""}'],
        ['a proxy with an unsupported protocol', '{"PROXY_URI":"ftp://h:1"}'],
    ])('rejects %s', (_name, header) => {
        expect(() => parseConfigHeader(header)).toThrow();
    });
});

describe('app', () => {
    test('healthz is open', async () => {
        expect((await app.request('/healthz')).status).toBe(200);
    });
    test('401 without the key', async () => {
        expect((await app.request('/twitter/me')).status).toBe(401);
    });
    test('400 on a bad config header', async () => {
        const response = await app.request('/twitter/me', { headers: { ...auth, 'x-postgate-config': 'nope' } });
        expect(response.status).toBe(400);
    });
    test('503 without a token', async () => {
        const response = await app.request('/twitter/me', { headers: auth });
        expect(response.status).toBe(503);
    });
    test('400 on a body that is not JSON', async () => {
        const response = await app.request('/twitter/tweet', { method: 'POST', headers: { ...auth, 'x-postgate-config': '{"TWITTER_AUTH_TOKEN":"t"}' }, body: 'x' });
        expect(response.status).toBe(400);
    });
    test('400 on an empty tweet', async () => {
        const response = await app.request('/twitter/tweet', { method: 'POST', headers: { ...auth, 'x-postgate-config': '{"TWITTER_AUTH_TOKEN":"t"}' }, body: '{"text":" "}' });
        expect(response.status).toBe(400);
    });
    test('404 on an unknown route', async () => {
        expect((await app.request('/twitter/nope', { headers: auth })).status).toBe(404);
    });
});

describe('tweet variables', () => {
    test('plain text', () => {
        expect(buildCreateTweetVariables({ text: 'hi' })).toEqual({ tweet_text: 'hi', dark_request: false, media: { media_entities: [], possibly_sensitive: false }, semantic_annotation_ids: [] });
    });
    test('reply, quote, media and sensitive', () => {
        const v = buildCreateTweetVariables({ text: 'hi', replyTo: 'https://x.com/jack/status/20', quoteUrl: 'https://x.com/a/status/1', sensitive: true }, ['111', '222']);
        expect(v.reply).toEqual({ in_reply_to_tweet_id: '20', exclude_reply_user_ids: [] });
        expect(v.attachment_url).toBe('https://x.com/a/status/1');
        expect(v.media).toEqual({ media_entities: [{ media_id: '111', tagged_users: [] }, { media_id: '222', tagged_users: [] }], possibly_sensitive: true });
    });
    test('tweet ids', () => {
        expect(tweetIdOf('123')).toBe('123');
        expect(tweetIdOf('https://x.com/jack/status/20?s=1')).toBe('20');
        expect(() => tweetIdOf('abc')).toThrow();
    });
});

describe('errors', () => {
    test.each([
        [187, 409],
        [186, 400],
        [185, 429],
        [226, 422],
        [326, 503],
        [999, 502],
    ])('code %i becomes %i', (code, status) => {
        const error = mapGraphqlError([{ code, message: 'm' }]);
        expect(error).toBeInstanceOf(HttpError);
        expect(error.status).toBe(status as 400);
    });
});

describe('media', () => {
    test('categories', () => {
        expect(categoryOf('image/png')).toBe('tweet_image');
        expect(categoryOf('image/gif')).toBe('tweet_gif');
        expect(categoryOf('video/mp4')).toBe('tweet_video');
        expect(() => categoryOf('text/plain')).toThrow();
    });
    test('combinations', () => {
        expect(() => checkMedia(['tweet_image', 'tweet_image', 'tweet_image', 'tweet_image'])).not.toThrow();
        expect(() => checkMedia(['tweet_image', 'tweet_image', 'tweet_image', 'tweet_image', 'tweet_image'])).toThrow();
        expect(() => checkMedia(['tweet_video', 'tweet_image'])).toThrow();
        expect(() => checkMedia(['tweet_video'])).not.toThrow();
    });
    test('chunks', () => {
        const parts = chunks(new Uint8Array(10), 4);
        expect(parts.map((p) => p.length)).toEqual([4, 4, 2]);
    });
});
