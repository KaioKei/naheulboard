/** Pictograms are either literal text (an emoji) or an SVG file in public/icons/. */

const ICONS_BASE_URL = `${import.meta.env.BASE_URL}icons/`;

/** Path relative to public/icons/, e.g. "armes/epee.svg". */
export function isIconFile(icon: string): boolean {
  return /\.svg$/i.test(icon);
}

export function iconFileUrl(icon: string): string {
  return ICONS_BASE_URL + icon;
}

/** Builds the pictogram content for a tile: an <img> for file-based icons, plain text otherwise. */
export function iconNode(icon: string): Node | string {
  if (!isIconFile(icon)) return icon;
  const img = document.createElement('img');
  img.src = iconFileUrl(icon);
  img.alt = '';
  img.className = 'tile__icon-img';
  return img;
}
