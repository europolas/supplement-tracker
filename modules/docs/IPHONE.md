# Preserve the verified iPhone fixes

These behaviors come from the user-tested original demo (example-v1, version 8).
They are deliberate regression constraints, not CSS to simplify without device checks.

- html/body/main use the shared --app-height. main owns vertical scrolling, reaches
  the bottom, and keeps the outer page from becoming a second scrolling surface.
- Standalone normal viewing uses screen dimensions. During editable-field focus,
  visualViewport height/offset accommodates the keyboard. Recompute after viewport
  resize and orientation changes; cleanup listeners if the shell is unmounted.
- viewport-fit=cover and black-translucent status bar allow content under system
  areas. Safe-area padding keeps controls reachable, not a blank shortened viewport.
- Top/bottom overlays do not intercept touches. Bottom backdrop blur uses a gradual
  mask with a transparent background; opaque overlay backgrounds create a hard line.
- Hide scrollbar chrome while preserving functional scrolling. Zoom/selection locks
  are configurable; inputs and textareas must remain editable/selectable.

Do not restore a fixed-height/fixed-body layout that previously cut off the bottom.
Do not remove the blur mask or paint an opaque blur rectangle. Compare both edges
while scrolling, not just the page at its initial position.

Desktop tests verify bounding boxes, CSS and browser behavior. Before a layout
release, also inspect a real installed iPhone PWA: keyboard open/closed, rotation,
text focus, long content under both blur edges, account forms and safe-area buttons.
