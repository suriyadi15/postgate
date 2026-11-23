# postgate

A small service that **posts** to social platforms for a backend of your own. It is the write-side sibling of [rssgate](https://github.com/suriyadi15/rssgate): stateless, no database, the credentials travel with each request.
Version 0.1 supports X / Twitter with the `auth_token` cookie of a logged-in account. Scheduling and retries are up to the caller.

> Posting through the web session is against X's terms and can get an account locked (error codes 226 / 326). Use a test account first. Query ids and features change with X's web builds, when a call breaks compare with [TwitterInternalAPIDocument](https://github.com/fa0311/TwitterInternalAPIDocument).

## Run

```bash
bun install && ACCESS_KEY=change-me bun src/index.ts
# or: docker build -t postgate . && docker run -d -p 3000:3000 -e ACCESS_KEY=change-me postgate
```

| Env          | Default | Meaning                                                  |
| ------------ | ------- | -------------------------------------------------------- |
| `ACCESS_KEY` | none    | Required, the process stops without it                   |
| `PORT`       | 3000    |                                                          |

`TWITTER_AUTH_TOKEN` and `PROXY_URI` may also be set as process env, they are the defaults for requests that bring none.

## API

Every route except `/healthz` needs `Authorization: Bearer <ACCESS_KEY>`. The account comes with the request:
`X-Postgate-Config: {"TWITTER_AUTH_TOKEN":"<auth_token cookie>","PROXY_URI":"socks5h://user:pass@host:1080"}` (`PROXY_URI` is optional).
Errors are `{"error":{"message":"..."}}`: 400 bad input, 401 wrong key, 404 not found, 409 duplicate, 413 too large, 422 refused by X (looks automated), 429 rate limit, 502 X failure, 503 credential missing/expired/locked.

| Route                       | Body                                                              | Returns                       |
| --------------------------- | ----------------------------------------------------------------- | ----------------------------- |
| `GET /twitter/me`           |                                                                   | `{id, username, name}`        |
| `POST /twitter/tweet`       | `{text, replyTo?, quoteUrl?, sensitive?, media?}`                 | `{id, url}`                   |
| `DELETE /twitter/tweet/:id` |                                                                   | `{id, deleted: true}`         |

`replyTo` is a tweet id or URL, `quoteUrl` a tweet URL. `media` is up to 4 images, or one GIF or video, each `{"url": "https://..."}` or `{"data": "<base64>", "type": "image/png"}`.
Limits: image 5 MB, GIF 15 MB, video 512 MB (use `url` for large files, the JSON body is capped at 32 MB). Mutations are never retried, so a timeout cannot post twice; check the account before repeating one.

```bash
curl -X POST -H 'Authorization: Bearer change-me' \
     -H 'X-Postgate-Config: {"TWITTER_AUTH_TOKEN":"0a1b2c3d4e5f60718293a4b5c6d7e8f901234567"}' \
     -H 'Content-Type: application/json' \
     -d '{"text":"hello from postgate","media":[{"url":"https://example.com/cat.jpg"}]}' \
     http://localhost:3000/twitter/tweet
```

## Develop

```bash
bun test && bunx tsc --noEmit
```

Layout: `src/platforms/twitter.ts` talks to X, `src/routes/*` maps URLs to it, `src/{context,cache,http}.ts` are shared with rssgate.

## License

AGPL-3.0, see `LICENSE`. The session handling is derived from [RSSHub](https://github.com/DIYgod/RSSHub) (AGPL-3.0) through rssgate.
