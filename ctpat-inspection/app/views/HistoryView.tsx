import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import AppHeader from "../components/AppHeader";
import Text from "../components/AppText";
import ContentWidth from "../components/ContentWidth";
import ScreenScroll from "../components/ScreenScroll";
import useScreenSize from "../components/useScreenSize";
import { CONTENT_MAX_WIDTH, MIN_TOUCH_TARGET, SPACING, WIDE_CONTENT_MAX_WIDTH } from "../models/theme";
import { getFormById } from "../models/InspectionForm";
import ApiService from "../services/ApiService";
import PdfService from "../services/PdfService";
import StorageService, { HistoryEntry } from "../services/StorageService";

export default function HistoryView() {
  const { isExpanded } = useScreenSize();
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
      <AppHeader title="Inspection History" />

      <ContentWidth maxWidth={isExpanded ? WIDE_CONTENT_MAX_WIDTH : CONTENT_MAX_WIDTH} style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.totalInspections}</Text>
          <Text chrome style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.thisMonth}</Text>
          <Text chrome style={styles.statLabel}>This Month</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.thisWeek}</Text>
          <Text chrome style={styles.statLabel}>This Week</Text>
        </View>
      </ContentWidth>

      {!isOnline && (
        <Text style={styles.emptyText}>Offline: showing inspections saved on this device.</Text>
      )}

      <ScreenScroll
        style={styles.listContainer}
        maxContentWidth={isExpanded ? WIDE_CONTENT_MAX_WIDTH : CONTENT_MAX_WIDTH}
        contentContainerStyle={styles.listContent}
      >
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : inspections.length === 0 ? (
          <Text style={styles.emptyText}>No completed inspections yet</Text>
        ) : (
          // One column on phones, two when the window is wide (unfolded foldable).
          <View style={styles.cards}>
            {inspections.map((inspection) => (
              <View key={inspection.id} style={[styles.inspectionCard, isExpanded && styles.inspectionCardWide]}>
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
                  <TouchableOpacity accessibilityRole="button" style={styles.viewButton} onPress={() => handleViewPdf(inspection.id)}>
                    <Text chrome style={styles.deleteButtonText}>View PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button"
                    style={styles.deleteButton}
                    onPress={() => handleDeleteInspection(inspection.id)}
                  >
                    <Text chrome style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
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
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
  },
  cards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.lg,
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
    width: "100%",
    backgroundColor: "white",
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inspectionCardWide: {
    // Two columns: half the row, minus half of the gap between them.
    width: "48.5%",
    flexGrow: 1,
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
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#666",
  },
  // Long values (dates) wrap inside the row instead of pushing past the edge.
  value: {
    flexShrink: 1,
    fontSize: 13,
    color: "#333",
    textAlign: "right",
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    paddingHorizontal: 15,
    paddingBottom: 12,
    gap: 8,
  },
  viewButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#2196F3",
    borderRadius: 6,
  },
  deleteButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FF6B6B",
    borderRadius: 6,
  },
  deleteButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
});
