import { useFocusEffect, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import ApiService from "../services/ApiService";
import StorageService, { SavedInspection } from "../services/StorageService";

export default function HistoryView() {
  const router = useRouter();
  const [inspections, setInspections] = useState<SavedInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalInspections: 0, thisMonth: 0, thisWeek: 0 });
  const [useBackend, setUseBackend] = useState(true);

  // Load inspections when view comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadInspections();
    }, [])
  );

  const loadInspections = async () => {
    try {
      setLoading(true);
      
      // Try to load from backend first
      if (useBackend && ApiService.isAuthenticated()) {
        try {
          console.log('📡 Loading from backend...');
          const response = await ApiService.getInspections({
            page: 1,
            limit: 50,
            sortOrder: 'desc',
          });

          if (response.success) {
            // Convert backend format to local format
            const backendInspections = response.data.inspections.map((item: any) => ({
              id: item.inspectionId,
              inspectionPoints: item.inspectionPoints,
              formData: {
                truckNumber: item.truckNumber,
                trailerNumber: item.trailerNumber,
                sealNumber: item.sealNumber,
                verifiedByName: item.verifiedByName,
                verifiedBySignature: '',
                securityCheckboxChecked: item.securityCheckboxChecked,
                agriculturalPestCheckboxChecked: item.agriculturalPestCheckboxChecked,
                date: item.date,
                time: item.time,
                printName: item.printName,
                signature: '',
                recipientEmail: item.recipientEmail,
              },
              completedAt: item.completedAt,
              status: item.status,
            }));

            setInspections(backendInspections);
            console.log(`✓ Loaded ${backendInspections.length} inspections from backend`);
          } else {
            throw new Error(response.error.message);
          }

          // Get stats from backend
          const statsResponse = await ApiService.getStatistics();
          if (statsResponse.success) {
            setStats({
              totalInspections: statsResponse.data.total,
              thisMonth: statsResponse.data.thisMonth,
              thisWeek: statsResponse.data.thisWeek,
            });
          }
        } catch (backendError) {
          console.warn('⚠️  Backend load failed, falling back to local storage:', backendError);
          setUseBackend(false);
          await loadLocalInspections();
        }
      } else {
        await loadLocalInspections();
      }
    } catch (error) {
      console.error("Error loading inspections:", error);
      Alert.alert("Error", "Failed to load inspection history");
    } finally {
      setLoading(false);
    }
  };

  const loadLocalInspections = async () => {
    const history = await StorageService.getInspectionHistory();
    const inspectionStats = await StorageService.getInspectionStats();
    setInspections(history.reverse()); // Show newest first
    setStats(inspectionStats);
    console.log('✓ Loaded from local storage');
  };

  const handleDeleteInspection = (id: string) => {
    Alert.alert(
      "Delete Inspection",
      "Are you sure you want to delete this inspection?",
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Delete",
          onPress: async () => {
            try {
              if (useBackend) {
                await ApiService.deleteInspection(id);
              } else {
                await StorageService.deleteInspection(id);
              }
              loadInspections();
              Alert.alert("Success", "Inspection deleted");
            } catch (error) {
              Alert.alert("Error", "Failed to delete inspection");
            }
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    try {
      const json = useBackend 
        ? JSON.stringify(inspections, null, 2)
        : await StorageService.exportHistory();
      Alert.alert(
        "Export Complete",
        "Inspection history exported:\n\n" + json.substring(0, 200) + "..."
      );
    } catch (error) {
      Alert.alert("Error", "Failed to export history");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getCompletionPercentage = (inspection: SavedInspection) => {
    const completed = inspection.inspectionPoints.filter((p) => p.checked).length;
    const total = inspection.inspectionPoints.length;
    return Math.round((completed / total) * 100);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Inspection History</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.totalInspections}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.thisMonth}</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.thisWeek}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>

      {inspections.length > 0 && (
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Text style={styles.exportButtonText}>📊 Export History</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.listContainer}>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : inspections.length === 0 ? (
          <Text style={styles.emptyText}>No completed inspections yet</Text>
        ) : (
          inspections.map((inspection) => (
            <View key={inspection.id} style={styles.inspectionCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>
                    Truck: {inspection.formData.truckNumber}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    Trailer: {inspection.formData.trailerNumber}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.completionBadge,
                    { backgroundColor: getCompletionPercentage(inspection) === 100 ? "#4CAF50" : "#FFC107" },
                  ]}
                >
                  {getCompletionPercentage(inspection)}%
                </Text>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Date:</Text>
                  <Text style={styles.value}>{inspection.formData.date}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Inspector:</Text>
                  <Text style={styles.value}>{inspection.formData.printName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Completed:</Text>
                  <Text style={styles.value}>
                    {formatDate(inspection.completedAt || inspection.savedAt)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteInspection(inspection.id)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: "#2196F3",
  },
  backButton: {
    fontSize: 16,
    color: "white",
    fontWeight: "bold",
  },
  spacer: {
    width: 50,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 15,
    paddingVertical: 15,
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2196F3",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
  },
  exportButton: {
    marginHorizontal: 15,
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    alignItems: "center",
  },
  exportButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  loadingText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#999",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
    color: "#999",
  },
  inspectionCard: {
    backgroundColor: "white",
    borderRadius: 10,
    marginBottom: 15,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: "#f9f9f9",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  completionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    color: "white",
    fontWeight: "bold",
    overflow: "hidden",
  },
  cardContent: {
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
  },
  value: {
    fontSize: 12,
    color: "#333",
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 15,
    paddingBottom: 12,
    gap: 8,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FF6B6B",
    borderRadius: 6,
  },
  deleteButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
});
