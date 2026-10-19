import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import AppHeader from "../components/AppHeader";
import Text from "../components/AppText";
import ChecklistSection from "../components/ChecklistSection";
import ContentWidth from "../components/ContentWidth";
import DynamicField from "../components/DynamicField";
import FormTypePicker from "../components/FormTypePicker";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import useScreenSize from "../components/useScreenSize";
import {
  FieldValue,
  FORMS,
  getFormById,
  getMissingItems,
  InspectionDraft,
  isFieldVisible,
  createEmptyDraft,
  reconcileDraft,
  toSubmission,
} from "../models/InspectionForm";
import { COLORS, MIN_TOUCH_TARGET, SPACING, WIDE_CONTENT_MAX_WIDTH } from "../models/theme";
import ApiService from "../services/ApiService";
import EmailService from "../services/EmailService";
import PdfService from "../services/PdfService";
import StorageService from "../services/StorageService";

type Tab = "checklist" | "signoff";

const newIdempotencyKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export default function InspectionView() {
  const { isExpanded } = useScreenSize();
  const [draft, setDraft] = useState<InspectionDraft | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("checklist");
  const [isBusy, setIsBusy] = useState(false);

  // One key per submission attempt, so a retry after a network error cannot create a duplicate.
  const idempotencyKey = useRef<string | null>(null);

  const form = draft ? getFormById(draft.formId) : undefined;

  const selectForm = useCallback(async (formId: string) => {
    const selected = getFormById(formId);
    if (!selected) return;
    const saved = await StorageService.loadDraft(formId);
    setDraft(saved ? reconcileDraft(selected, saved) : createEmptyDraft(selected));
    setActiveTab("checklist");
  }, []);

  const updateDraft = (change: (current: InspectionDraft) => InspectionDraft) => {
    idempotencyKey.current = null;
    setDraft((current) => (current ? change(current) : current));
  };

  // Keep the draft on the device so an interrupted inspection can be resumed.
  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => {
      StorageService.saveDraft(draft).catch((error) => console.error("Draft save failed:", error));
    }, 500);
    return () => clearTimeout(timer);
  }, [draft]);

  const toggleItem = (itemId: string) =>
    updateDraft((current) => ({
      ...current,
      checklist: { ...current.checklist, [itemId]: !current.checklist[itemId] },
    }));

  const setValue = (key: string, value: FieldValue) =>
    updateDraft((current) => ({ ...current, values: { ...current.values, [key]: value } }));

  const handlePreview = async () => {
    if (!draft || !form) return;
    setIsBusy(true);
    try {
      await PdfService.previewDraft(toSubmission(form, draft));
    } catch (error: any) {
      Alert.alert("Could not create preview", error.message || "Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const emailReport = async (inspectionId: string, summaryId: string, recipient: string) => {
    try {
      const response = await ApiService.sendInspectionEmail(inspectionId, recipient);
      if (!response.success) throw new Error(response.error?.message || "Email failed");
      return;
    } catch (error) {
      console.warn("Server email failed, trying the device mail app:", error);
    }

    try {
      const pdfPath = await PdfService.downloadInspectionPdf(inspectionId);
      if (!pdfPath || !form || !draft) return;
      await EmailService.sendInspectionReport(
        pdfPath,
        recipient,
        form.label,
        summaryId,
        String(draft.values.printName ?? "")
      );
    } catch (error) {
      console.warn("Device mail also failed:", error);
    }
  };

  const handleSubmit = async () => {
    if (!draft || !form) return;

    const missing = getMissingItems(form, draft);
    if (missing.length > 0) {
      Alert.alert("Missing Information", missing.map((item) => `• ${item}`).join("\n"));
      return;
    }

    setIsBusy(true);
    try {
      idempotencyKey.current ??= newIdempotencyKey();
      const response = await ApiService.createInspection(toSubmission(form, draft), idempotencyKey.current);
      if (!response.success) {
        throw new Error(response.error?.message || "The server rejected the inspection.");
      }

      const { inspectionId, summaryId } = response.data;
      const recipient = draft.recipientEmail.trim();
      if (recipient) await emailReport(inspectionId, summaryId, recipient);

      await StorageService.addToHistory({
        id: inspectionId,
        formId: form.id,
        summaryId,
        freightBillNumber: String(draft.values.freightBillNumber ?? ""),
        printName: String(draft.values.printName ?? ""),
        date: String(draft.values.date ?? ""),
        time: String(draft.values.time ?? ""),
        completedAt: new Date().toISOString(),
      });
      await StorageService.clearDraft(form.id);
      idempotencyKey.current = null;
      setDraft(createEmptyDraft(form));
      setActiveTab("checklist");

      Alert.alert("Inspection Submitted", `${form.label}\n${summaryId}`, [
        {
          text: "View PDF",
          onPress: () =>
            PdfService.openInspectionPdf(inspectionId).catch((error) =>
              Alert.alert("Could not open PDF", error.message)
            ),
        },
        { text: "OK" },
      ]);
    } catch (error: any) {
      Alert.alert("Submission failed", error.message || "Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const completedCount = form && draft ? form.checklist.filter((item) => draft.checklist[item.id]).length : 0;
  const sections = form
    ? Array.from(new Set(form.fields.map((field) => field.section)))
    : [];

  const checklistTitle = form ? `Checklist (${completedCount}/${form.checklist.length})` : "";

  const renderChecklist = () =>
    form && draft ? (
      <>
        <Text style={styles.formTitle}>{form.title}</Text>
        <ChecklistSection items={form.checklist} checked={draft.checklist} onToggle={toggleItem} />
      </>
    ) : null;

  const renderSignOff = () =>
    form && draft ? (
      <>
        {sections.map((section) => (
          <View key={section}>
            <Text style={styles.sectionTitle}>{section}</Text>
            {form.fields
              .filter((field) => field.section === section && isFieldVisible(field, draft.values))
              .map((field) => (
                <DynamicField
                  key={field.key}
                  field={field}
                  value={draft.values[field.key]}
                  onChange={(value) => setValue(field.key, value)}
                />
              ))}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Email Report (optional)</Text>
        <TextInput
          style={styles.input}
          value={draft.recipientEmail}
          onChangeText={(recipientEmail) => updateDraft((current) => ({ ...current, recipientEmail }))}
          placeholder="recipient@example.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity accessibilityRole="button" style={styles.previewButton} onPress={handlePreview} disabled={isBusy}>
          <Text chrome style={styles.previewButtonText}>Preview PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button"
          style={[styles.submitButton, isBusy && styles.disabled]}
          onPress={handleSubmit}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text chrome style={styles.submitButtonText}>Submit Inspection</Text>
          )}
        </TouchableOpacity>
      </>
    ) : null;

  const renderForm = () => {
    // A wide window (unfolded foldable) shows both halves at once instead of tabs.
    // The draft lives in this component, so resizing never loses what was typed.
    if (isExpanded) {
      return (
        <ContentWidth maxWidth={WIDE_CONTENT_MAX_WIDTH} style={styles.panes}>
          <View style={styles.pane}>
            <Text style={styles.paneTitle}>{checklistTitle}</Text>
            <KeyboardAwareScrollView style={styles.paneScroll} maxContentWidth={WIDE_CONTENT_MAX_WIDTH}>
              {renderChecklist()}
            </KeyboardAwareScrollView>
          </View>
          <View style={styles.pane}>
            <Text style={styles.paneTitle}>Sign Off</Text>
            <KeyboardAwareScrollView style={styles.paneScroll} maxContentWidth={WIDE_CONTENT_MAX_WIDTH}>
              {renderSignOff()}
            </KeyboardAwareScrollView>
          </View>
        </ContentWidth>
      );
    }

    return (
      <>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "checklist" && styles.activeTab]}
            onPress={() => setActiveTab("checklist")}
            accessibilityRole="tab"
          >
            <Text chrome style={[styles.tabText, activeTab === "checklist" && styles.activeTabText]}>
              {checklistTitle}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "signoff" && styles.activeTab]}
            onPress={() => setActiveTab("signoff")}
            accessibilityRole="tab"
          >
            <Text chrome style={[styles.tabText, activeTab === "signoff" && styles.activeTabText]}>Sign Off</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView style={styles.content}>
          {activeTab === "checklist" ? renderChecklist() : renderSignOff()}
        </KeyboardAwareScrollView>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader title="CTPAT Inspection" />

      <ContentWidth style={styles.pickerArea}>
        <FormTypePicker forms={FORMS} selectedFormId={draft?.formId ?? null} onSelect={selectForm} />
      </ContentWidth>

      {form && draft ? (
        renderForm()
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Choose the kind of inspection you need to complete.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  pickerArea: { padding: SPACING.lg },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  activeTab: { borderBottomColor: "#007AFF" },
  tabText: { fontSize: 17, color: "#666", fontWeight: "600" },
  activeTabText: { color: "#007AFF" },
  content: { flex: 1, padding: SPACING.lg },
  // Wide windows: checklist and sign-off side by side, each scrolling on its own.
  panes: { flex: 1, flexDirection: "row", gap: SPACING.lg, paddingHorizontal: SPACING.lg },
  pane: { flex: 1, minWidth: 0 },
  paneTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.primary, paddingVertical: SPACING.sm },
  paneScroll: { flex: 1 },
  formTitle: { fontSize: 14, color: "#666", marginBottom: 12 },
  sectionTitle: { fontSize: 22, fontWeight: "bold", color: "#333", marginVertical: 12 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 17,
    color: "#222",
  },
  previewButton: {
    marginTop: 24,
    minHeight: 52,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  previewButtonText: { color: "#007AFF", fontSize: 18, fontWeight: "600" },
  submitButton: {
    marginTop: 12,
    minHeight: 52,
    justifyContent: "center",
    backgroundColor: "#34C759",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  submitButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  disabled: { opacity: 0.6 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  emptyText: { fontSize: 17, color: "#777", textAlign: "center" },
});
