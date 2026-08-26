import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './services/ApiService';
import AuthService from './services/AuthService';

const SETTINGS_STORAGE_KEY = 'ctpat_app_settings';

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing CTPAT Inspection App...');

        // Apply a user-configured backend URL override (Settings screen), if one was saved
        try {
          const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
          const backendUrl = savedSettings ? JSON.parse(savedSettings).backendUrl : null;
          if (backendUrl) {
            ApiService.setBaseUrl(backendUrl);
          }
        } catch (error) {
          console.warn('Could not load backend URL override:', error);
        }

        // Initialize authentication and get token
        const token = await AuthService.initialize();

        // Initialize API service with token
        ApiService.initialize(token);

        // Test backend connection
        const isHealthy = await ApiService.healthCheck();
        if (isHealthy) {
          console.log('✓ Backend connection healthy');
        } else {
          console.warn('⚠️  Backend may not be available - offline mode enabled');
        }

        setIsInitialized(true);
        console.log('✓ App initialized successfully');
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsInitialized(true); // Continue anyway
      }
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return <Stack />;
  }

  return <Stack />;
}
