import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import ApiService from './services/ApiService';
import AuthService from './services/AuthService';

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing CTPAT Inspection App...');

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
