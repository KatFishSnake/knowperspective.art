# knowperspective.art

Interactive one-, two- and three-point perspective construction for artists.
Live at https://knowperspective.art

Every line on the sheet (horizon, station point, cone of vision, legs, vanishing points, the box) is derived from one pinhole projection, so the construction overlay and the drawing can never disagree. Move a slider and everything that depends on it moves too.

## Run locally

Static site, no build step.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Layout

- `index.html` the lab
- `about.html` what the tool is for
- `assets/lab.js` the model and the canvas renderer
- `assets/lab.css`, `assets/base.css` styles
- `vercel.json` clean URLs and headers

## Deploy

Hosted on Vercel; `main` deploys to production.
