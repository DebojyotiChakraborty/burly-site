# Burly site

Landing page for Burly, the workout log app. Static HTML, CSS and vanilla JavaScript: no build step.

- `index.html` is the page.
- `styles.css` holds every token and rule; `main.js` drives the hero and the scroll story.
- `fonts/` ships Geist Mono and Geist Serif (SIL OFL, see `fonts/LICENSE.txt`).
- `media/screens/{dark,light}/` are simulator captures of the app, one set per theme; the page
  swaps them with the theme toggle. `tool/capture/README.md` explains how to re-shoot them.

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 4321
```
