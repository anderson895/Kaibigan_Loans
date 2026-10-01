/**
 * Public image paths (served from /public). Masters live in /assets/images — regenerate the WebP files
 * from there instead of editing these directly. App icons are src/app/icon.png and apple-icon.png.
 */
export const IMAGES = {
  heroDashboard: { src: "/images/landing/hero-dashboard.webp", width: 1400, height: 742 },
  loginCoins: { src: "/images/login/coins.webp", width: 720, height: 689 },
} as const;
