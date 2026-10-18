# Owner-supplied icons

Copy `examples/custom-icon.js` into the app's public source. Call
`parseCustomIcon(input)` and append the returned node; never insert input HTML.
Empty input returns null for a caller-provided default. Invalid markup throws
`INVALID_GROUP_ICON`; provide localized en/lt messages.

The browser DOMParser reconstructs static SVG shapes/groups only. Event handlers,
styles, links, images, foreignObject, use, animation and URL paints are rejected.
Source length, tree depth and node counts are bounded. Classes on SVG are discarded;
root styling uses `custom-group-svg`. Supply dimensions in app CSS. A missing viewBox
falls back to 0 0 16 16. Gradients, masks and external references are intentionally
outside this small static-icon format.

`<i class="bi bi-0-circle"></i>` becomes a fresh class-only node. Load a locally
hosted licensed Bootstrap Icons CSS/font set in the caller; the module fetches
nothing itself. Bootstrap Icons is independent of the Bootstrap UI framework.
Icons are decorative (`aria-hidden`); meaningful control labels belong on controls.
No global listeners or cleanup hooks. Persist only bounded owner-scoped text on the
server, and keep ownership validation and server request-size limits. Always parse
again on rendering even if input was checked when saving.
