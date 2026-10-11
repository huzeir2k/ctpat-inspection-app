import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { getFormById } from "../models/InspectionForm";
import ApiService from "../services/ApiService";
import PdfService from "../services/PdfService";
import StorageService, { HistoryEntry } from "../services/StorageService";

export default function HistoryView() {
  const router = useRouter();
  const [inspections, setInspections] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalInspections: 0, thisMonth: 0, thisWeek: 0 });
  // False when the server could not be reached; the list then comes from this device.
  const [isOnline, setIsOnline] = useState(true);

  const loadFromServer = async () => {
    const response = await ApiService.getInspections({ page: 1, limit: 50 });
    if (!response.success) throw new Error(response.error?.message || "Could not load history");

    setInspections(
      response.data.inspections.map((item: any): HistoryEntry => ({
        id: item.inspectionId,
        formId: item.formId,
        summaryId: item.summaryId,
        freightBillNumber: item.freightBillNumber,
        printName: item.printName,
        date: item.date,
        time: item.time,
        completedAt: item.createdAt,
      }))
    );

    const statsResponse = await ApiService.getStatistics();
    if (statsResponse.success) {
      setStats({
        totalInspections: statsResponse.data.total,
        thisMonth: statsResponse.data.thisMonth,
        thisWeek: statsResponse.data.thisWeek,
      });
    }
  };

  const loadFromDevice = async () => {
    setInspections(await StorageService.getInspectionHistory());
    setStats(await StorageService.getInspectionStats());
  };

  const loadInspections = useCallback(async () => {
    setLoading(true);
    try {
      if (!ApiService.isAuthenticated()) throw new Error("Not signed in");
      await loadFromServer();
      setIsOnline(true);
    } catch (error) {
      console.warn("Server history unavailable, using this device's history:", error);
      setIsOnline(false);
      await loadFromDevice();
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInspections();
    }, [loadInspections])
  );

  const handleViewPdf = async (id: string) => {
    try {
      await PdfService.openInspectionPdf(id);
    } catch (error: any) {
      Alert.alert("Could not open PDF", error.message || "Please try again.");
    }
  };

  const handleDeleteInspection = (id: string) => {
    Alert.alert(
      "Delete Inspection",
      "This permanently deletes the inspection and its PDF. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await ApiService.deleteInspection(id);
              if (!response.success) throw new Error(response.error?.message || "Delete failed");
              await StorageService.deleteInspection(id);
              loadInspections();
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to delete inspection");
            }
          },
        },
      ]
    );
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

      {!isOnline && (
        <Text style={styles.emptyText}>Offline: showing inspections saved on this device.</Text>
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
                    {getFormById(inspection.formId)?.label ?? inspection.formId}
                  </Text>
                  <Text style={styles.cardSubtitle}>{inspection.summaryId}</Text>
                </View>
              </View>

              <View style={styles.cardContent}>
                {inspection.freightBillNumber ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.label}>Freight Bill:</Text>
                    <Text style={styles.value}>{inspection.freightBillNumber}</Text>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Date:</Text>
                  <Text style={styles.value}>{inspection.date}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Inspector:</Text>
                  <Text style={styles.value}>{inspection.printName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Submitted:</Text>
                  <Text style={styles.value}>{new Date(inspection.completedAt).toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.viewButton} onPress={() => handleViewPdf(inspection.id)}>
                  <Text style={styles.deleteButtonText}>View PDF</Text>
                </TouchableOpacity>
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
  viewButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#2196F3",
    borderRadius: 6,
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
