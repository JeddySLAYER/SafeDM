/**
 * SafeDM brand assets — single import surface for UI + Expo config paths.
 *
 * | Asset | Use |
 * |-------|-----|
 * | icon-mark | Square transparent mark (headers, adaptive source) |
 * | full | Mark + wordmark (Welcome / in-app splash) |
 * | text | Wordmark alone (Auth) |
 *
 * Expo launcher: `../icon.png` (white bg) + `../adaptive-icon.png` (transparent).
 */

export const brandImages = {
  // icon-ui: tighter padding so headers don't look tiny
  icon: require("./brand/icon-ui.png"),
  full: require("./brand/full-logo.png"),
  text: require("./brand/text-logo.png"),
};

/** Aspect ratios (width / height). Icon is square after padding. */
export const brandAspect = {
  icon: 1,
  full: 1380 / 352,
  text: 898 / 186,
};
