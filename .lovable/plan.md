# Fix blank white circles when flipping cards

## What I checked

- All 10 product images are still present and served correctly: each returns HTTP 200 with full file size, both on the dev preview and on the published site.
- Flipping all 20 cards in an automated browser run showed every image loading successfully (no failed requests, no 404s), so nothing is broken in the image data or the card markup itself.

So the images are not missing — they are arriving late. The card faces use `loading="lazy"`, and the face is hidden behind the card back until you flip it. The browser therefore only starts downloading a product photo at the moment the card is flipped. The photos are large (up to 1.1 MB each, 1824–1920 px wide, about 6.6 MB in total), so on a kiosk or a slower connection the flipped card shows its plain white face for a second or more before the photo appears. On a fast sandbox connection this is invisible, which is why my run looked fine.

This behaviour would have become more noticeable as bigger product photos and heavier logo assets were added to the app.

## Proposed fix

1. Stop lazy-loading card faces. Remove `loading="lazy"` from the card image and mark it `decoding="sync"` so the browser fetches it as part of the board.
2. Preload the whole deck at round start. When a board is built, warm every product image (a hidden preload pass) before the timer starts, so a flip never waits on the network.
3. Show a graceful fallback instead of a blank circle. If an image ever genuinely fails, render the product name/category on the white face via an `onError` handler, so a card is never empty.
4. Reduce image weight. Re-encode the ten product photos to roughly 800 px on the long edge (they are displayed at ~120 px), cutting the deck from about 6.6 MB to a few hundred KB. This is the change that removes the delay entirely on kiosk hardware.

## Verification

- Reload the board with network throttling enabled and confirm no card shows a white circle after flipping.
- Confirm all 10 pairs still match correctly and the existing Playwright tests pass.

## Note

If you are still seeing blank circles after this and they never fill in (rather than filling in after a delay), tell me which device/URL you see it on — that would point at a caching or offline issue on the kiosk rather than load timing.
