// site.webmanifest: the name, colours and icons browsers use when the site is pinned or added to a home screen.
import { ICON_FILES } from './chrome.mjs';

export function webManifest() {
  return JSON.stringify({
    name: 'open-audiovisual',
    short_name: 'OAV',
    description: 'A web-native, zero-build framework for audiovisual performance.',
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'browser',
    background_color: '#0b0b0c',
    theme_color: '#0b0b0c',
    icons: [
      { src: '/' + ICON_FILES.png192, sizes: '192x192', type: 'image/png' },
      { src: '/' + ICON_FILES.png512, sizes: '512x512', type: 'image/png' },
      { src: '/' + ICON_FILES.svg, sizes: 'any', type: 'image/svg+xml' },
    ],
  }, null, 2) + '\n';
}
