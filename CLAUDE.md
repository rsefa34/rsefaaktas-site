# rsefaaktas.com — project notes

Personal portfolio of Recep Sefa Aktaş (camera operator at İdealist Yapım + founder of Yapay Zeka Reklamlarım).
The site is being rebuilt from scratch in this repo, step by step with Sefa. Talk to him in Turkish; site copy is in English.

## Audience and positioning
- Audience: employers, agencies, production companies (not end clients; client-facing Turkish site is yapayzekareklamlarim.com, separate project).
- Positioning: "both sides of the camera" — real on-set documentary/camera work + AI commercial direction.
- Showreel should open with real footage, then AI work.
- Keep consistent with LinkedIn and the CV (assets/cv/): titles, dates, project names.

## Stack decisions
- Plain static HTML/CSS/JS, no build step (keeps it editable by hand).
- Hosting: Cloudflare Pages connected to this repo (auto-deploy on push to main).
- Videos: NOT committed to the repo. Full videos go to Cloudflare R2 (public bucket); only small posters/thumbnails live in assets/img.
  Cloudflare Pages has a 25 MiB per-file limit.
- Domain rsefaaktas.com is registered at GoDaddy; DNS will move to Cloudflare at launch. Old site stays live until then.

## Content rules
- Camera/documentary material involving public figures or unreleased projects needs approval before publishing — ask Sefa.
- Do not claim numbers that are not confirmed by Sefa (the old site said "50+ commercials" — unverified).
- Contact email: rsefaaktas@gmail.com.
