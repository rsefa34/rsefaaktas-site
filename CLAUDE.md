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

## Page structure (first draft, 2026-10-02)
- public/index.html is a single page: opening (name + "Camera Operator & AI Commercial Director"), the statement
  "One eye, two cameras: one real, one artificial." shown with one real 16:9 frame and one AI 9:16 frame,
  "On set" (camera projects), "In AI" (9:16 cards), clients, about, contact.
- Sefa chose the title line for the opening over a manifesto; the statement lives in the second section.
- public/assets/css/site.css holds the tokens (smoke, well, bone, ash, tungsten, tally). Typeface: Albert Sans.
- MOTION POLICY (current, set 2026-10-07 from Sefa's feedback; it replaces the first draft's "opening only" rule):
  Sefa wants fluid After-Effects / iOS-like transitions and rounded corners (token --r), no flat empty backdrops.
  Motion that exists: opening sequence, the two frames opening once, the film rails drifting, rail cards turning slightly (mouse devices only),
  the logo drift, card-to-player growth and the 3D turn between films. Motion answers an action or drifts slowly;
  do NOT add scroll-triggered fade/slide reveals per section. If more is asked, weigh it against the "calm, unhurried" brief.
- No illustrations, stick figures or emotes in empty areas or on frame edges: Sefa proposed it, then withdrew it as a bad idea (2026-10-07).
- prefers-reduced-motion is supported everywhere: no opening animation, no card turn, logos become a static wrapped row,
  the player opens/steps/closes without animation, previews do not autoplay. Keep this working when adding motion.
- iPhone Safari safeguards (reasoned, not verified on a device — no WebKit in the test environment):
  one <video> element is reused for the whole player session (sound may only start inside the tap);
  a cached blob that fails falls back to the direct URL; :hover rules that pause/scale are inside @media (hover: hover);
  Safari has no navigator.connection, so phones without it are treated as metered (stream only, no background download).
- "In AI" is two horizontal rails that drift on their own like the logo strip (asked by Sefa 2026-10-07): the cards are
  cloned in site.js so the row never ends; it is still a native scroller (swipe, wheel, arrows), and rests under the
  pointer or a finger, while a dialog is open and off screen. No scroll-snap while drifting. Reduced motion: no clones,
  no drift, plain row with arrows. Cards turn slightly in 3D as they travel (mouse devices):
  "Selected films" (7) and "More films" (14). Do not put all films in one grid again; he found 17 at once too long.
- Rail card text: title on ONE line (the four named Tabloplus films show "Tabloplus" as title and the film name as the
  description; the full name stays in data-title for the player), then a two-line slot for the description so all
  cards in a rail end level. Descriptions are deliberately larger/brighter than a caption so similar posters can be told apart.
- Player: the clicked card grows into the film (FLIP), the page blurs behind it and the film's poster, blurred,
  lights the backdrop. Prev/next (buttons, arrow keys, swipe) turn between films with a 3D slide:
  the outgoing film (or photo) leaves as a canvas still (`ghostOf` / `turn` in site.js) while the next one arrives at the same time.
- Player/viewer arrows are translucent glass and always sit to the left and right of the film or photo (also on phones;
  Sefa rejected arrows underneath). No loading spinner: Sefa asked for one, then withdrew it.
- Photos: every `main figure img` opens in a full-screen viewer (dialog #viewer) built like the film player:
  grows from its place, blurred backdrop lit by the photo, prev/next by buttons, arrow keys or swipe, shrinks back on close.
- Client logos: "On set for" is a static row; "AI commercials for" is a slow endless drift that pauses on hover/touch.
  Logo heights come from each file's aspect ratio (inline --h) so marks weigh the same; no fixed-width boxes.
- Top bar has a blurred solid surface. About has an availability line. Phone strips show a partial next frame.
- AI cards use silent 6-second previews in public/assets/video (480x854, small).
- Full films (1080x1920 H.264, ~4-12 MB, with sound) are on Cloudflare R2, bucket `rsefaaktas-media`,
  public URL https://pub-76ee4d9ab6aa4a3988c80d9618f887d1.r2.dev/<name>.mp4 (same names as the previews).
  The base URL is the MEDIA constant at the top of public/assets/js/site.js.
- Sefa's rule: do NOT wait for a click to download. After the page has loaded, the selected films are fetched in the
  background (two at a time); "More films" join when their rail is approached, and on desktops (mouse, >= 4 GB memory)
  they follow automatically once the selected ones are in. The same moment also preloads the card previews and the
  lazy photos (`warmPage`), so scrolling and hovering never wait. On mobile data / data-saver only the
  start is buffered. Needs a CORS policy on the bucket (GET from the site origins); without it the player streams.
- No real camera footage exists for the site; Sefa decided to leave the camera side as photographs.
- Photos with faces/landmarks were graded from the original pixels (the AI editor redrew them); see git log.
- Still to add: kitchen shoot and bridge photos (camera-assistant era; the bridge photo shows a colleague, caption it "on set"),
  21 films are encoded.
  Not on the site: Bipaketçi (Veo watermark), ZIO (unconfirmed), Clerie (720p only), 3 large Tabloplus files and TBA (never copied over).

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
