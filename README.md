# GrokSync

Your work context follows you.

GrokSync is a **self-hosted, private board** that connects the machines you actually work on: desktop, laptop, phone, and coding agents. Sit down anywhere and see what you (or your agents) were just doing somewhere else.

This repository is the **open idea plus a working board**. Self-host it. There is no public hosted account. The public intro lives at [groksync.jonbailey.xyz](https://groksync.jonbailey.xyz/).

## Why

Laptops, phones, and agent CLIs do not share a brain. You pick up the phone and cannot see which project the desktop agent claimed. You open a laptop and cannot see the last note you stamped on the phone.

GrokSync is the missing layer: **devices + live sessions + work claims + leftover pickup + a short journal**, behind a password.

It is not analytics. It is not a social feed. It is not a vendor cloud that reads your disk.

## This tree

- Password gate (30-day cookie). Password stays in a host secret, never in the JS bundle.
- Continue packet: last project, note, next, optional encrypted notes.
- Device stamps: PC, Mac, Phone, Agent.
- Snapshot API: agents POST a redacted board (Bearer token).
- Cloudflare Pages + KV. One KV key: `board`.
- Paths in snapshots are slugs (`~/project`), never absolute home directories.
- Public intro site under `site/` (repo CTA only).

## Not in this repo

- Any personal operator URL or live private instance
- Secrets, tokens, mailboxes, machine paths

## Quick start

1. Create a Cloudflare Pages project and a KV namespace. Put the KV id in `wrangler.toml`.
2. Set secrets (do not commit them):

```text
GROKSYNC_GATE_PASSWORD
GROKSYNC_WRITE_TOKEN
```

3. Deploy:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

or:

```bash
npx wrangler pages deploy dist --project-name groksync
```

4. Put optional local state under `~/.groksync/` (see `scripts/example_state/`) and publish:

```bash
export GROKSYNC_URL="https://YOUR_DOMAIN"
export GROKSYNC_WRITE_TOKEN="..."
python3 scripts/publish_board.py
```

Open the site, unlock, tap the device you are on.

## Privacy

- Self-host. The operator owns the KV and the password.
- Board JSON must stay redacted: project slugs, short notes, no secrets.
- `robots.txt` disallows all crawlers. `_headers` send `noindex`.
- Do not publish a public demo that contains real work.

## License

MIT. Fonts under `public/fonts/fontshare/` keep their ITF Free Font License files.

## Upgrade

The public landing and Continue card are in [`UPGRADE.md`](UPGRADE.md). Board APIs stay the v1 continue / now / handoff / encrypt surface.
