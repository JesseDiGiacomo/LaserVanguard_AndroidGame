import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.batalha.espacial.retro',
  appName: 'Remix: Batalha Espacial Retro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
