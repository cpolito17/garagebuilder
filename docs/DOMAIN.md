# Domain and deployment

`garagechallenge.lol` is the canonical origin. The domain is registered at
Namecheap; DNS is served by Cloudflare; the site is the `garagebuilder` Worker
with its static assets attached.

This is a one-time setup. Once it is done, `npm run worker:deploy` is the whole
deployment story and nothing here needs revisiting.

---

## 1. Add the zone to Cloudflare

1. Cloudflare dashboard, **Add a domain**, enter `garagechallenge.lol`.
2. Choose **manual DNS entry** (there is nothing to import — the domain is new)
   and the **Free** plan.
3. Cloudflare shows two assigned nameservers, of the form
   `xxx.ns.cloudflare.com`. Copy both. They are specific to this account; the
   ones in anyone else's guide will not work.

Leave the zone's records empty for now. Section 3 fills in the two that serve
the site, and it does that for you.

## 2. Point Namecheap at those nameservers

1. Namecheap → **Domain List** → `garagechallenge.lol` → **Manage**.
2. **Nameservers** → change *Namecheap BasicDNS* to **Custom DNS**.
3. Paste the two Cloudflare nameservers, one per row. Remove any other rows.
4. Save (the green checkmark).

This is the only DNS change made at the registrar. It is a delegation, not a
record: it moves the entire zone to Cloudflare, and every record in section 3
and 4 is then created in the Cloudflare dashboard, not in Namecheap.

| Where | Record | Value |
| --- | --- | --- |
| Namecheap, Custom DNS row 1 | NS | `<first>.ns.cloudflare.com` |
| Namecheap, Custom DNS row 2 | NS | `<second>.ns.cloudflare.com` |

Do not also set Namecheap's "Redirect Domain" or leave BasicDNS host records in
place. Once the nameservers change, nothing left behind in BasicDNS is read
again, and a stale redirect there is a confusing thing to debug later.

Propagation is usually minutes and occasionally up to 24 hours. Cloudflare
emails when the zone goes **Active**. Nothing below works until it does.

Newly registered domains are also in the ICANN 60-day registrar transfer lock.
That lock has no bearing here — changing nameservers is not a transfer.

## 3. The two records that serve the site

These are created for you. Do not add them by hand.

Already configured, in `wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "garagechallenge.lol",     "custom_domain": true },
  { "pattern": "www.garagechallenge.lol", "custom_domain": true }
]
```

A Workers **Custom Domain** is not a DNS record you write. On deploy,
Cloudflare creates the record for each hostname, points it at this Worker, and
issues the edge certificate. What you will see afterwards in **DNS → Records**:

| Type | Name | Content | Proxy | Created by |
| --- | --- | --- | --- | --- |
| CNAME | `garagechallenge.lol` | the `garagebuilder` Worker | Proxied (orange) | Cloudflare Workers |
| CNAME | `www` | the `garagebuilder` Worker | Proxied (orange) | Cloudflare Workers |

Both are managed records: the dashboard shows them greyed out, and they are
edited by changing `routes` and redeploying, not in the DNS tab. Deleting one
there breaks the Worker binding rather than freeing the hostname.

So there is no A record, no CNAME you author, and no origin IP anywhere in this
setup — which is also why the apex works at all. A bare `garagechallenge.lol`
cannot hold a CNAME under the DNS spec, and the usual CNAME-flattening
workaround is unnecessary when Cloudflare owns both ends of the record.

Two constraints worth knowing before you touch the DNS tab:

- A Custom Domain **cannot be created on a hostname that already has a CNAME
  record**. If you pre-create a `www` CNAME by hand, the deploy in section 5
  fails. Leave both hostnames empty.
- Custom Domains require an **exact hostname match** and do not support wildcard
  records. That is why `www` is listed as its own route rather than being
  assumed to follow the apex.

## 4. The records you do write: lock down email

Adding the zone creates no mail records, and this app sends and receives none.
An unprotected domain with no mail policy is worth spoofing, so publish the
records that say so. All four go in **DNS → Records**, DNS-only (no proxy —
these are not HTTP).

| Type | Name | Content | Priority |
| --- | --- | --- | --- |
| MX | `garagechallenge.lol` | `.` | 0 |
| TXT | `garagechallenge.lol` | `v=spf1 -all` | — |
| TXT | `_dmarc` | `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s` | — |
| TXT | `*._domainkey` | `v=DKIM1; p=` | — |

Read in order: the null MX says the domain accepts no mail at all; the SPF
record says no host is authorized to send as it; DMARC tells receivers to
reject anything that claims to be from it anyway, subdomains included; the
wildcard DKIM record revokes every possible signing key.

If `hello@garagechallenge.lol` is ever wanted, do **not** hand-write MX records
for it. Turn on Cloudflare **Email Routing**, which forwards to a real inbox for
free and writes its own MX and SPF records; then remove the null MX and relax
the SPF record to match what it tells you.

## 5. Deploy

From a machine with Cloudflare credentials:

```bash
npx wrangler login      # once
npm run worker:deploy   # build, then deploy
```

The first deploy after adding the routes prints a confirmation line per custom
domain, and that is when the two records in section 3 appear. Certificate
issuance takes a few minutes; until it finishes the domain answers with an SSL
handshake error rather than a 5xx, which is expected and resolves on its own.

## 6. Verify

```bash
dig +short NS garagechallenge.lol                                  # the two cloudflare NS
dig +short garagechallenge.lol                                     # proxied cloudflare IPs
curl -sI https://garagechallenge.lol | head -1                     # HTTP/2 200
curl -sI https://www.garagechallenge.lol | grep -i '^location'     # https://garagechallenge.lol/
curl -s https://garagechallenge.lol/ | grep -o 'og:title[^/]*'     # generic preview
dig +short TXT _dmarc.garagechallenge.lol                          # the DMARC policy
```

Then paste a finished garage link into any chat app and confirm the preview
reads *"Beat my $50,000 garage — …"* rather than the generic card. That
exercises the Worker, the assets, and the certificate in one shot.

---

## Decisions worth knowing

**`www` redirects to the apex, in the Worker.** Both hostnames are attached as
custom domains, so both reach the Worker; `apexRedirect` in `worker/index.ts`
301s anything under `www.` to the same URL without it, query string intact.

Cloudflare's own guidance for this is a Redirect Rule plus a placeholder
proxied record on the hostname being redirected from. That is the right answer
when the apex is the only custom domain, and the wrong one here: the canonical
`<link>` and `og:url` tags are built from the request origin, so the redirect
has to happen before any HTML is generated, and doing it in the Worker keeps
that guarantee next to the code that depends on it. It also keeps the DNS tab
free of a placeholder record pointing at a reserved address.

**The `workers.dev` URL is off** (`"workers_dev": false`, and `preview_urls`
with it). It is a third public origin serving the same app, and link previews
and search indexing are the things that suffer from having several.

**The Worker is named `garagebuilder`, and the domain is not.** The name has to
match the Worker already deployed in the account — renaming in `wrangler.jsonc`
does not rename a deployed Worker, it deploys a second one and leaves the domain
attached to the first. The mismatch with `garagechallenge.lol` is cosmetic and
invisible to visitors; it is not worth a migration.
