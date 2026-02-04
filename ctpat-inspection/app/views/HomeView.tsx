import { useFocusEffect, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ApiService from "../services/ApiService";
import StorageService from "../services/StorageService";

export default function HomeView() {
  const router = useRouter();
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
    <View style={styles.container}>
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
          <Text style={styles.statLabel}>Total Inspections</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.thisMonth}</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.thisWeek}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("./inspection")}
        >
          <Text style={styles.buttonText}>Inspect Truck and Trailer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("./history")}
        >
          <Text style={styles.buttonText}>View Inspection History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("./settings")}
        >
          <Text style={styles.buttonText}>Settings</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.authorLabel}>app created by Huzeir Kurpejovic.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 60,
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
    marginBottom: 40,
  },
});
