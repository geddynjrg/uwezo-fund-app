import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ke.go.uwezo.fundapp',
  appName: 'Uwezo Fund',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#b72a9f',
    },
    LocalNotifications: {
      iconColor: '#b72a9f',
    },
  },
};

export default config;
