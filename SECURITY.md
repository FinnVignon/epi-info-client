# Security Policy

## Supported Versions

Security fixes are prepared for the latest `1.0.x` release line. Upgrade to the newest patch before
reporting a problem that may already be fixed.

## Reporting A Vulnerability

Do not open a public issue with exploit details, client secrets, enrollment tokens, personal data,
or displayed content. Use the repository's private vulnerability reporting option under \*\*Security

> Advisories > Report a vulnerability\*\*. Include the affected version, hardware/OS, reproduction
> steps, expected security boundary, and impact. Use placeholder credentials and the smallest safe
> proof of concept.

If private vulnerability reporting is unavailable, contact the repository owner privately before
sharing technical details. Do not test against displays or servers you do not own or administer.

## Deployment Responsibilities

- Use HTTPS for the controller when traffic crosses an untrusted network.
- Remove the single-use enrollment token after the client enrolls.
- Protect the Docker data volume because it contains the client credential and cached content.
- Keep the local display bound to `127.0.0.1` unless remote access is explicitly required.
- Keep the host OS, Chromium, Docker Engine, and client image patched.
- Treat live web links as untrusted remote pages and test them before broad assignment.
