const DESKTOP_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
];

export function pickUserAgent() {
  return DESKTOP_UAS[Math.floor(Math.random() * DESKTOP_UAS.length)];
}

export function randomViewport() {
  const widths = [1366, 1440, 1536, 1600, 1920];
  const heights = [768, 900, 960, 1050, 1080];
  const i = Math.floor(Math.random() * widths.length);
  const j = Math.floor(Math.random() * heights.length);
  return { width: widths[i], height: heights[j] };
}

