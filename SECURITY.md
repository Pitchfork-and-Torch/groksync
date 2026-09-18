# Security

- Do not commit `GROKSYNC_GATE_PASSWORD` or `GROKSYNC_WRITE_TOKEN`.
- Board payloads must not include secrets, mailboxes, or absolute home paths.
- The password gate is a shared-secret cookie, not multi-user IAM. Treat the URL as private.
- If a token leaks, rotate the Pages secret and republish.
