import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.silvajesse.batalhaespacial',
  appName: 'Remix: Batalha Espacial Retro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
