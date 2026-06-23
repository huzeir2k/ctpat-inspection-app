import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    CheckBox,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import SignatureCapture from "../components/SignatureCapture";
import {
    DEFAULT_FORM_DATA,
    DEFAULT_INSPECTION_POINTS,
    InspectionForm,
    InspectionPoint,
} from "../models/InspectionChecklist";
import ApiService from "../services/ApiService";
import EmailService from "../services/EmailService";
import PdfService from "../services/PdfService";
import { StoredSignature } from "../services/SignatureService";
import StorageService from "../services/StorageService";

export default function InspectionView() {
  const router = useRouter();
  const [inspectionPoints, setInspectionPoints] = useState<InspectionPoint[]>(
    DEFAULT_INSPECTION_POINTS
  );
  const [formData, setFormData] = useState<InspectionForm>(DEFAULT_FORM_DATA);
  const [activeTab, setActiveTab] = useState<"checklist" | "signoff">(
    "checklist"
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifiedBySignature, setVerifiedBySignature] = useState<StoredSignature | null>(null);
  const [inspectorSignature, setInspectorSignature] = useState<StoredSignature | null>(null);

  // Load saved inspection on mount
  useEffect(() => {
    const loadSavedInspection = async () => {
      try {
        const saved = await StorageService.loadCurrentInspection();
        if (saved) {
          setInspectionPoints(saved.inspectionPoints);
          setFormData(saved.formData);
          console.log('Loaded saved inspection');
        }
      } catch (error) {
        console.error('Error loading saved inspection:', error);
      }
    };
    
    loadSavedInspection();
  }, []);

  // Auto-save inspection every 30 seconds
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      StorageService.saveCurrentInspection(inspectionPoints, formData).catch(
        (error) => console.error('Auto-save error:', error)
      );
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [inspectionPoints, formData]);

  const toggleChecklistItem = (id: number) => {
    setInspectionPoints(
      inspectionPoints.map((point) =>
        point.id === id ? { ...point, checked: !point.checked } : point
      )
    );
  };

  const handleFormChange = (field: keyof InspectionForm, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleCheckboxChange = (field: keyof InspectionForm) => {
    setFormData({
      ...formData,
      [field]: !formData[field as keyof typeof formData],
    });
  };

  const submitInspection = async () => {
    // Validate required fields
    const requiredFields = [
      "truckNumber",
      "trailerNumber",
      "sealNumber",
      "verifiedByName",
      "date",
      "time",
      "printName",
      "recipientEmail",
    ];
    const missingFields = requiredFields.filter((field) => !formData[field as keyof InspectionForm]);

    if (missingFields.length > 0) {
      Alert.alert(
        "Missing Information",
        `Please fill in: ${missingFields.join(", ")}`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate PDF from ctpatform.pdf template
      const pdfPath = await PdfService.generatePdfFromTemplate({
        inspectionPoints,
        formData,
        inspectorSignature,
        verifiedBySignature,
      });

      console.log('📄 PDF generated:', pdfPath);

      // Create inspection data payload
      const inspectionPayload = {
        truckNumber: formData.truckNumber,
        trailerNumber: formData.trailerNumber,
        sealNumber: formData.sealNumber,
        inspectionPoints,
        verifiedByName: formData.verifiedByName,
        verifiedBySignatureId: verifiedBySignature?.id,
        securityCheckboxChecked: formData.securityCheckboxChecked,
        agriculturalPestCheckboxChecked: formData.agriculturalPestCheckboxChecked,
        date: formData.date,
        time: formData.time,
        printName: formData.printName,
        inspectorSignatureId: inspectorSignature?.id,
        recipientEmail: formData.recipientEmail,
        notes: '',
      };

      // Submit to backend with PDF
      console.log('📤 Submitting inspection to backend...');
      const response = await ApiService.createInspection(inspectionPayload, pdfPath);

      if (!response.success) {
        throw new Error(response.error.message);
      }

      const inspectionId = response.data.inspectionId;
      console.log('✓ Inspection created:', inspectionId);

      // Try to send email via backend
      try {
        console.log('📧 Sending email via backend...');
        const emailResponse = await ApiService.sendInspectionEmail(
          inspectionId,
          formData.recipientEmail,
          {
            truckNumber: formData.truckNumber,
            trailerNumber: formData.trailerNumber,
            sealNumber: formData.sealNumber,
            date: formData.date,
            time: formData.time,
            printName: formData.printName,
            verifiedByName: formData.verifiedByName,
            securityCheckboxChecked: formData.securityCheckboxChecked,
            agriculturalPestCheckboxChecked: formData.agriculturalPestCheckboxChecked,
            notes: formData.notes || '',
          },
          inspectionPoints
        );
        if (emailResponse.success) {
          console.log('✓ Email sent via backend with PDF');
        } else {
          throw new Error('Backend email failed');
        }
      } catch (emailError) {
        console.warn('⚠️  Backend email failed, attempting native email:', emailError);
        // Fallback to native mail
        try {
          await EmailService.sendInspectionReport(
            pdfPath,
            formData.recipientEmail,
            formData.truckNumber,
            formData.printName
          );
          console.log('✓ Email sent via native mail');
        } catch (nativeEmailError) {
          console.warn('⚠️  Native email also failed:', nativeEmailError);
        }
      }

      // Archive inspection locally
      const localInspectionId = await StorageService.completeInspection(
        inspectionPoints,
        formData
      );
      console.log('✓ Inspection archived locally');

      Alert.alert(
        "✅ Success!",
        `Inspection submitted!\n\nID: ${inspectionId.substring(0, 8)}...\n\nPDF stored on backend and email sent.`,
        [
          {
            text: "Download PDF",
            onPress: async () => {
              try {
                // Generate and download PDF
                await PdfService.generatePdfFromTemplate({
                  inspectionPoints,
                  formData,
                  inspectorSignature,
                  verifiedBySignature,
                });
                Alert.alert("Success", "PDF downloaded successfully!");
              } catch (error) {
                Alert.alert("Error", "Failed to download PDF");
              }
            },
          },
          {
            text: "OK",
            onPress: () => {
              setInspectionPoints(DEFAULT_INSPECTION_POINTS);
              setFormData(DEFAULT_FORM_DATA);
              setActiveTab("checklist");
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Submission error:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to submit inspection. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeneratePdf = async () => {
    // Validate required fields
    const requiredFields = [
      "truckNumber",
      "trailerNumber",
      "sealNumber",
      "verifiedByName",
      "date",
      "time",
      "printName",
    ];
    const missingFields = requiredFields.filter((field) => !formData[field as keyof InspectionForm]);

    if (missingFields.length > 0) {
      Alert.alert(
        "Missing Information",
        `Please fill in required fields: ${missingFields.join(", ")}`
      );
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const pdfPath = await PdfService.generatePdfFromTemplate({
        inspectionPoints,
        formData,
        inspectorSignature,
        verifiedBySignature,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
      console.error("PDF generation error:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSaveAndSharePdf = async () => {
    // Validate required fields
    const requiredFields = [
      "truckNumber",
      "trailerNumber",
      "sealNumber",
      "verifiedByName",
      "date",
      "time",
      "printName",
    ];
    const missingFields = requiredFields.filter((field) => !formData[field as keyof InspectionForm]);

    if (missingFields.length > 0) {
      Alert.alert(
        "Missing Information",
        `Please fill in required fields: ${missingFields.join(", ")}`
      );
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const pdfPath = await PdfService.generatePdfFromTemplate({
        inspectionPoints,
        formData,
        inspectorSignature,
        verifiedBySignature,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
      console.error("PDF generation error:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const completedPoints = inspectionPoints.filter((p) => p.checked).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CTPAT Inspection</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "checklist" && styles.activeTab]}
          onPress={() => setActiveTab("checklist")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "checklist" && styles.activeTabText,
            ]}
          >
            Checklist ({completedPoints}/18)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "signoff" && styles.activeTab]}
          onPress={() => setActiveTab("signoff")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "signoff" && styles.activeTabText,
            ]}
          >
            Sign Off
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Checklist Tab */}
        {activeTab === "checklist" && (
          <View>
            <Text style={styles.sectionTitle}>Inspection Checklist</Text>
            {inspectionPoints.map((point) => (
              <TouchableOpacity
                key={point.id}
                style={styles.checklistItem}
                onPress={() => toggleChecklistItem(point.id)}
              >
                <View style={styles.checkboxContainer}>
                  <View
                    style={[
                      styles.checkbox,
                      point.checked && styles.checkboxChecked,
                    ]}
                  >
                    {point.checked && (
                      <Text style={styles.checkmarkText}>✓</Text>
                    )}
                  </View>
                </View>
                <View style={styles.checklistTextContainer}>
                  <Text style={styles.checklistTitle}>{point.title}</Text>
                  <Text style={styles.checklistDescription}>
                    {point.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Sign Off Tab */}
        {activeTab === "signoff" && (
          <View>
            <Text style={styles.sectionTitle}>Inspection Sign Off</Text>

            {/* Truck/Trailer Information */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Vehicle Information</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Truck Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter truck number"
                  value={formData.truckNumber}
                  onChangeText={(text) =>
                    handleFormChange("truckNumber", text)
                  }
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Trailer Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter trailer number"
                  value={formData.trailerNumber}
                  onChangeText={(text) =>
                    handleFormChange("trailerNumber", text)
                  }
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Seal Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter seal number"
                  value={formData.sealNumber}
                  onChangeText={(text) => handleFormChange("sealNumber", text)}
                />
              </View>
            </View>

            {/* Seal Verification */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Seal Verification</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Verified By (Name) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter name"
                  value={formData.verifiedByName}
                  onChangeText={(text) =>
                    handleFormChange("verifiedByName", text)
                  }
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Verified By (Signature)</Text>
                {verifiedBySignature && (
                  <View style={styles.signaturePreview}>
                    <Image
                      source={{ uri: `data:image/png;base64,${verifiedBySignature.base64Data}` }}
                      style={styles.signatureImage}
                    />
                    <TouchableOpacity
                      style={styles.removeSignatureButton}
                      onPress={() => setVerifiedBySignature(null)}
                    >
                      <Text style={styles.removeSignatureText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!verifiedBySignature && (
                  <SignatureCapture
                    onSignatureSaved={(sig) => setVerifiedBySignature(sig)}
                    currentSignatureId={verifiedBySignature?.id}
                  />
                )}
              </View>
            </View>

            {/* Checkboxes */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Compliance Checks</Text>

              <View style={styles.checkboxFormItem}>
                <CheckBox
                  value={formData.securityCheckboxChecked}
                  onValueChange={() =>
                    handleCheckboxChange("securityCheckboxChecked")
                  }
                />
                <Text style={styles.checkboxLabel}>Security Check</Text>
              </View>

              <View style={styles.checkboxFormItem}>
                <CheckBox
                  value={formData.agriculturalPestCheckboxChecked}
                  onValueChange={() =>
                    handleCheckboxChange("agriculturalPestCheckboxChecked")
                  }
                />
                <Text style={styles.checkboxLabel}>
                  Agricultural/Pest Check
                </Text>
              </View>
            </View>

            {/* Date & Time */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Date & Time</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="MM/DD/YYYY"
                  value={formData.date}
                  onChangeText={(text) => handleFormChange("date", text)}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Time *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM AM/PM"
                  value={formData.time}
                  onChangeText={(text) => handleFormChange("time", text)}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Send Report To</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Recipient Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter email address"
                  value={formData.recipientEmail}
                  onChangeText={(text) => handleFormChange("recipientEmail", text)}
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Sign Off */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Inspector Sign Off</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Print Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  value={formData.printName}
                  onChangeText={(text) => handleFormChange("printName", text)}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Signature</Text>
                {inspectorSignature && (
                  <View style={styles.signaturePreview}>
                    <Image
                      source={{ uri: `data:image/png;base64,${inspectorSignature.base64Data}` }}
                      style={styles.signatureImage}
                    />
                    <TouchableOpacity
                      style={styles.removeSignatureButton}
                      onPress={() => setInspectorSignature(null)}
                    >
                      <Text style={styles.removeSignatureText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!inspectorSignature && (
                  <SignatureCapture
                    onSignatureSaved={(sig) => setInspectorSignature(sig)}
                    currentSignatureId={inspectorSignature?.id}
                  />
                )}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.printButton]}
                onPress={handleGeneratePdf}
                disabled={isGeneratingPdf}
              >
                <Text style={styles.actionButtonText}>
                  {isGeneratingPdf ? "Generating..." : "Print PDF"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.shareButton]}
                onPress={handleSaveAndSharePdf}
                disabled={isGeneratingPdf}
              >
                <Text style={styles.actionButtonText}>
                  {isGeneratingPdf ? "Processing..." : "Save & Share"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={submitInspection}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? "Submitting..." : "Submit Inspection"}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </View>
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
    backgroundColor: "#007AFF",
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    flex: 1,
    paddingVertical: 20,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#007AFF",
  },
  tabText: {
    fontSize: 18,
    color: "#666",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#007AFF",
  },
  content: {
    flex: 1,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  checklistItem: {
    backgroundColor: "#fff",
    marginBottom: 16,
    padding: 20,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  checkboxContainer: {
    marginRight: 15,
    marginTop: 2,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#007AFF",
  },
  checkmarkText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  checklistTextContainer: {
    flex: 1,
  },
  checklistTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  checklistDescription: {
    fontSize: 15,
    color: "#666",
  },
  formSection: {
    backgroundColor: "#fff",
    marginBottom: 20,
    padding: 20,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  formSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#333",
    minHeight: 52,
  },
  signatureInput: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingVertical: 12,
  },
  checkboxFormItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#333",
    marginLeft: 14,
    fontWeight: "500",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 15,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  printButton: {
    backgroundColor: "#FF9500",
  },
  shareButton: {
    backgroundColor: "#34C759",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  submitButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  submitButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  signaturePreview: {
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  signatureImage: {
    width: "100%",
    height: 100,
    borderRadius: 6,
    marginBottom: 10,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#eee",
  },
  removeSignatureButton: {
    backgroundColor: "#FF6B6B",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
  },
  removeSignatureText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
});
