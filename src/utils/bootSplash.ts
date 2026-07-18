/**
 * Removes the static boot splash defined in index.html (the delayed-reveal
 * DeFlock logo shown only on slow connections). Call once real UI is on
 * screen: MapPage mount, NotFound mount, or an ErrorBoundary catch.
 *
 * Fades out from whatever opacity the splash currently has; if the reveal
 * delay hasn't elapsed yet (fast connections) it is still invisible and the
 * removal is imperceptible.
 */
export function removeBootSplash(): void {
  const el = document.getElementById('boot-splash');
  if (!el) return;
  el.style.transition = 'opacity 250ms ease-out';
  // Force a style flush so the transition sees the pre-change opacity.
  void el.offsetWidth;
  el.style.animation = 'none';
  el.style.opacity = '0';
  window.setTimeout(() => el.remove(), 300);
}
