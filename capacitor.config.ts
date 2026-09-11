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
      backgroundColor: '#006b3f',
    },
    LocalNotifications: {
      iconColor: '#006b3f',
    },
  },
};

export default config;
