import { badRequest } from '../errors';
import { deleteTweet, getMe, postTweet, type TweetInput } from '../platforms/twitter';
import type { Routes } from './types';

const asTweetInput = (body: unknown): TweetInput => {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw badRequest('The body must be a JSON object such as {"text":"hello"}.');
    }
    const b = body as Record<string, unknown>;
    const optionalString = (name: string) => {
        if (b[name] !== undefined && typeof b[name] !== 'string') {
            throw badRequest(`"${name}" must be a string.`);
        }
        return b[name] as string | undefined;
    };
    const text = optionalString('text') ?? '';
    const media = b.media;
    if (media !== undefined && (!Array.isArray(media) || media.some((m) => typeof m !== 'object' || m === null))) {
        throw badRequest('"media" must be an array of {"url"} or {"data","type"}.');
    }
    if (b.sensitive !== undefined && typeof b.sensitive !== 'boolean') {
        throw badRequest('"sensitive" must be a boolean.');
    }
    return { text, replyTo: optionalString('replyTo'), quoteUrl: optionalString('quoteUrl'), sensitive: b.sensitive as boolean | undefined, media: media as TweetInput['media'] };
};

export const twitter: Routes = {
    '/me': { GET: () => getMe() },
    '/tweet': { POST: ({ body }) => postTweet(asTweetInput(body)) },
    '/tweet/:id': { DELETE: ({ params }) => deleteTweet(params.id) },
};
