import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import AuthButton from './components/AuthButton';
import Text from './components/AppText';

// If this screen is the one the sign-in browser returned to (web), pass the result back to the app.
WebBrowser.maybeCompleteAuthSession();

/**
 * Where Google sign-in returns to (ctpatinspection://auth-callback). The sign-in itself is
 * finished by SupabaseAuthService; this screen only exists so the return address is a real
 * route instead of a "not found" page. Once the session is saved the layout replaces it.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0066cc" />
      <Text style={styles.text}>Finishing sign-in…</Text>
      <AuthButton title="Back to sign in" variant="link" onPress={() => router.replace('/login')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', padding: 24 },
  text: { marginTop: 16, fontSize: 16, color: '#333' },
});
