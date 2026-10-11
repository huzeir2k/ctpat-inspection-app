import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './services/ApiService';
import SupabaseAuthService from './services/SupabaseAuthService';

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

        // Require a real signed-in Supabase session before talking to the backend
        const session = await SupabaseAuthService.getSession();
        if (session) {
          ApiService.initialize(session.access_token);

          const isHealthy = await ApiService.healthCheck();
          if (isHealthy) {
            console.log('✓ Backend connection healthy');
          } else {
            console.warn('⚠️  Backend may not be available - offline mode enabled');
          }
        } else {
          router.replace('/login');
        }

        setIsInitialized(true);
        console.log('✓ App initialized successfully');
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsInitialized(true); // Continue anyway
      }
    };

    initializeApp();

    // Keep ApiService's token in sync with sign-in/sign-out/token-refresh events
    const unsubscribe = SupabaseAuthService.onAuthStateChange((session) => {
      if (session) {
        ApiService.initialize(session.access_token);
      } else {
        ApiService.setToken('');
        router.replace('/login');
      }
    });

    return unsubscribe;
  }, []);

  if (!isInitialized) {
    return <Stack />;
  }

  return <Stack />;
}
