export interface SoftwareProject {
  slug: string;
  name: string;
  version: string;
  description: string;
  longDescription: string;
  tags: string[];
  platform: string;
  license: string;
  githubUrl: string;
  releasesUrl: string;
  screenshotUrl?: string;
  releaseDate: string;
}

export const inHouseSoftware: SoftwareProject[] = [
  {
    slug: 'mouse-pointer-settings',
    name: 'Mouse Pointer Settings',
    version: '1.0.0',
    description:
      'Windows system-tray app for customizing mouse cursor themes — pick presets or design your own by shape, color, and size.',
    longDescription:
      'Mouse Pointer Settings lives quietly in your Windows taskbar. Click it to open a compact popup where you can choose from six built-in presets or fully customize your cursor: pick a shape (arrow, star, circle, diamond, hand, and more), set any color, and scale the size from 24 px to 256 px. Changes apply instantly — no restart required. Fully offline, no accounts, no telemetry.',
    tags: ['Windows', 'Electron', 'Open Source', 'System Tray'],
    platform: 'Windows 10 / 11',
    license: 'MIT',
    githubUrl: 'https://github.com/hashthor/mouse-pointer-settings',
    releasesUrl: 'https://github.com/hashthor/mouse-pointer-settings/releases',
    screenshotUrl: undefined,
    releaseDate: '2026-06-25',
  },
];
