import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KaryaSync',
    short_name: 'KaryaSync',
    description: 'The Operating System for your Career',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a', // Slate-950 (Dark Mode BG)
    theme_color: '#4f46e5', // Indigo-600 (Brand Color)
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
