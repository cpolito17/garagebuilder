# Domain and deployment

`garagebuilder.lol` is the canonical origin. The domain is registered at
Namecheap; DNS is served by Cloudflare; the site is the `garagebuilder` Worker
with its static assets attached.

This is a one-time setup. Once it is done, `npm run worker:deploy` is the whole
deployment story and nothing here needs revisiting.

---

## 1. Add the zone to Cloudflare

1. Cloudflare dashboard, **Add a domain**, enter `garagebuilder.lol`.
2. Choose **manual DNS entry** (there is nothing to import — the domain is new)
   and the **Free** plan.
3. Cloudflare shows two assigned nameservers, of the form
   `xxx.ns.cloudflare.com`. Copy both. They are specific to this account; the
   ones in anyone else's guide will not work.

Leave the zone's DNS records empty for now. Section 3 fills them in, and it does
it for you.

## 2. Point Namecheap at those nameservers

1. Namecheap → **Domain List** → `garagebuilder.lol` → **Manage**.
2. **Nameservers** → change *Namecheap BasicDNS* to **Custom DNS**.
3. Paste the two Cloudflare nameservers, one per row. Remove any other rows.
4. Save (the green checkmark).

Do not use Namecheap's "Redirect Domain" or keep BasicDNS records alongside
this. The nameserver change hands the whole zone to Cloudflare; anything left
behind in BasicDNS stops being read.

Propagation is usually minutes and occasionally up to 24 hours. Cloudflare
emails when the zone goes **Active**. Nothing below works until it does.

Newly registered domains are also in the ICANN 60-day registrar transfer lock.
That lock has no bearing here — changing nameservers is not a transfer.

## 3. Attach the domain to the Worker

Already configured, in `wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "garagebuilder.lol",     "custom_domain": true },
  { "pattern": "www.garagebuilder.lol", "custom_domain": true }
]
```

A Workers **Custom Domain** is not a DNS record you write. On deploy,
Cloudflare creates and owns the proxied record for each hostname, points it at
this Worker, and issues the edge certificate. So there is no A record, no CNAME,
and no origin IP anywhere in this setup — which is also why the apex works at
all. A bare `garagebuilder.lol` cannot hold a CNAME under the DNS spec, and the
usual CNAME-flattening workaround is unnecessary when Cloudflare owns both ends.

Then, from a machine with Cloudflare credentials:

```bash
npx wrangler login      # once
npm run worker:deploy   # build, then deploy
```

The first deploy after adding the routes prints a confirmation for each custom
domain. Certificate issuance takes a few minutes; until it finishes the domain
answers with an SSL handshake error rather than a 5xx, which is expected and
resolves on its own.

## 4. Verify

```bash
curl -sI https://garagebuilder.lol | head -1                    # 200
curl -sI https://www.garagebuilder.lol | grep -i '^location'    # https://garagebuilder.lol/
curl -s https://garagebuilder.lol/ | grep -o 'og:title[^/]*'    # generic preview
```

Then paste a finished garage link into any chat app and confirm the preview
reads *"Beat my $50,000 garage — …"* rather than the generic card. That
exercises the Worker, the assets, and the certificate in one shot.

---

## Decisions worth knowing

**`www` redirects to the apex, in the Worker.** Both hostnames are attached as
custom domains, so both reach the Worker; `apexRedirect` in `worker/index.ts`
301s anything under `www.` to the same URL without it, query string intact.
This is done in code rather than as a dashboard Redirect Rule because the
canonical `<link>` and `og:url` tags are built from the request origin — a
garage shared from `www` would otherwise advertise itself as a second URL and
split its own preview cache. One origin, decided before anything else runs.

**The `workers.dev` URL is off** (`"workers_dev": false`, and `preview_urls`
with it). It is a third public origin serving the same app, and link previews
and search indexing are the things that suffer from having several.

**The Worker is named `garagebuilder`.** It has to match the Worker already
deployed in the account — renaming in `wrangler.jsonc` does not rename a
deployed Worker, it deploys a second one and leaves the domain attached to the
first.

## Email

Adding the zone does not create mail records, and this app sends and receives
none. If `hello@garagebuilder.lol` is ever wanted, Cloudflare **Email Routing**
forwards it to a real inbox for free and writes its own MX and SPF records.
Enable it before adding any hand-written MX record, not after.
