import { useFocusEffect, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenScroll from "../components/ScreenScroll";
import Text from "../components/AppText";
import ApiService from "../services/ApiService";
import StorageService from "../services/StorageService";

export default function HomeView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({
    totalInspections: 0,
    thisMonth: 0,
    thisWeek: 0,
  });
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'offline'>('checking');

  useFocusEffect(
    React.useCallback(() => {
      loadStats();
    }, [])
  );

  const loadStats = async () => {
    try {
      setBackendStatus('checking');
      
      // Try backend first
      if (ApiService.isAuthenticated()) {
        try {
          const response = await ApiService.getStatistics();
          if (response.success) {
            setStats({
              totalInspections: response.data.total,
              thisMonth: response.data.thisMonth,
              thisWeek: response.data.thisWeek,
            });
            setBackendStatus('connected');
            console.log('✓ Loaded statistics from backend');
            return;
          }
        } catch (error) {
          console.warn('⚠️  Backend stats fetch failed, using local data');
        }
      }

      // Fallback to local storage
      setBackendStatus('offline');
      const localStats = await StorageService.getInspectionStats();
      setStats(localStats);
      console.log('✓ Loaded statistics from local storage');
    } catch (error) {
      console.error('Error loading stats:', error);
      setBackendStatus('offline');
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenScroll style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
          <Text style={styles.title}>CTPAT Inspection and Signoff App</Text>

          {/* Backend Status Indicator */}
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusDot,
                backendStatus === 'connected' ? styles.connectedDot :
                backendStatus === 'offline' ? styles.offlineDot :
                styles.checkingDot
              ]}
            />
            <Text style={styles.statusText}>
              {backendStatus === 'connected' ? '✓ Backend Connected' :
               backendStatus === 'offline' ? '⚠ Offline Mode' :
               '⏳ Checking...'}
            </Text>
          </View>

          {/* Statistics Dashboard */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalInspections}</Text>
              <Text chrome style={styles.statLabel}>Total Inspections</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.thisMonth}</Text>
              <Text chrome style={styles.statLabel}>This Month</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.thisWeek}</Text>
              <Text chrome style={styles.statLabel}>This Week</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity accessibilityRole="button"
              style={styles.button}
              onPress={() => router.push("./inspection")}
            >
              <Text chrome style={styles.buttonText}>Start Inspection</Text>
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="button"
              style={styles.button}
              onPress={() => router.push("./history")}
            >
              <Text chrome style={styles.buttonText}>View Inspection History</Text>
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="button"
              style={styles.button}
              onPress={() => router.push("./settings")}
            >
              <Text chrome style={styles.buttonText}>Settings</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.authorLabel}>app created by Huzeir Kurpejovic.</Text>
        </View>
      </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  scroll: { flex: 1 },
  // Fills the window, so the buttons sit at the bottom on tall screens; scrolls on short ones.
  scrollContent: { flexGrow: 1 },
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  connectedDot: {
    backgroundColor: '#4CAF50',
  },
  offlineDot: {
    backgroundColor: '#FF9800',
  },
  checkingDot: {
    backgroundColor: '#2196F3',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  buttonContainer: {
    width: "100%",
    gap: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    minHeight: 56,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  authorLabel: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
  },
});
