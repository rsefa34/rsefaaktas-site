# rsefaaktas.com — project notes

Personal portfolio of Recep Sefa Aktaş (camera operator at İdealist Yapım + founder of Yapay Zeka Reklamlarım).
The site is being rebuilt from scratch in this repo, step by step with Sefa. Talk to him in Turkish; site copy is in English.

## Audience and positioning
- Audience: employers, agencies, production companies (not end clients; client-facing Turkish site is yapayzekareklamlarim.com, separate project).
- Positioning: "both sides of the camera" — real on-set documentary/camera work + AI commercial direction.
- Showreel should open with real footage, then AI work.
- Keep consistent with LinkedIn and the CV (public/assets/cv/): titles, dates, project names.

## Design direction (decided by Sefa, 2026-09-28)
- Dark & cinematic: charcoal / smoky dark-grey background, not pure black. Video pixels should "glow" like a cinema screen.
- Opening: calm and minimal. Only his name + a short manifesto line in a clean, calm typeface. NO full-screen autoplay video on load.
  The showreel/videos come in with a smooth After-Effects-like transition (fade-in / ease-out) or on slight scroll.
- Reference: worthitdocs.com (sparse, unhurried, text-first editorial structure; project cards with title, client, duration),
  but with more fluid motion-graphic touches than the reference.

## Stack decisions
- Plain static HTML/CSS/JS, no build step (keeps it editable by hand).
- Hosting: Cloudflare Workers static assets (wrangler.jsonc, serves ./public), Git-connected: auto-deploy on push to main.
- Only files inside public/ are published. Notes (README, CLAUDE.md) stay outside it.
- Videos: NOT committed to the repo. Full videos go to Cloudflare R2 (public bucket); only small posters/thumbnails live in public/assets/img.
  Cloudflare static assets have a 25 MiB per-file limit.
- Domain rsefaaktas.com is registered at GoDaddy; DNS will move to Cloudflare at launch. Old site stays live until then.

## Content rules
- Camera/documentary material involving public figures or unreleased projects needs approval before publishing — ask Sefa.
- Do not claim numbers that are not confirmed by Sefa (the old site said "50+ commercials" — unverified).
- Contact email: rsefaaktas@gmail.com.
