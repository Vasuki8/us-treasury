# Local Stitch typography

The application hosts its typefaces locally under the existing self-only CSP. Production builds content-hash the font files and rewrite stylesheet references.

- Inter variable, Google Fonts: https://github.com/google/fonts/tree/main/ofl/inter (SIL OFL, included).
- JetBrains Mono Regular/Medium: https://github.com/JetBrains/JetBrainsMono/tree/master/fonts/webfonts (SIL OFL, included).
- Material Symbols Outlined: https://fonts.google.com/icons (Apache 2.0; license from https://github.com/google/material-design-icons).

No runtime requests to Google Fonts or other font CDNs are needed.
