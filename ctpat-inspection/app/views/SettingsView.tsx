import { useFocusEffect } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, TextInput, TouchableOpacity, View } from "react-native";
import Text from "../components/AppText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppHeader from "../components/AppHeader";
import { MIN_TOUCH_TARGET } from "../models/theme";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import ApiService from "../services/ApiService";
import SupabaseAuthService from "../services/SupabaseAuthService";

interface SettingsData {
  appVersion: string;
  autoSave: boolean;
  notificationsEnabled: boolean;
  ctpatReceiverEmail: string;
  companyName: string;
  inspectorName: string;
  backendUrl?: string;
}

const DEFAULT_SETTINGS: SettingsData = {
  appVersion: "1.0.0",
  autoSave: true,
  notificationsEnabled: true,
  ctpatReceiverEmail: "",
  companyName: "",
  inspectorName: "",
  backendUrl: "",
};

const SETTINGS_STORAGE_KEY = "ctpat_app_settings";

export default function SettingsView() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'healthy' | 'offline'>('offline');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Load settings from AsyncStorage on mount
  useFocusEffect(
    React.useCallback(() => {
      loadSettings();
      loadAuthInfo();
      checkBackendStatus();
    }, [])
  );

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const loadAuthInfo = async () => {
    try {
      const session = await SupabaseAuthService.getSession();
      setUserEmail(session?.user?.email ?? null);
    } catch (error) {
      console.error("Error loading auth info:", error);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", onPress: () => {} },
      {
        text: "Sign Out",
        onPress: async () => {
          // The root layout shows the login screen as soon as the session ends.
          await SupabaseAuthService.signOut();
        },
      },
    ]);
  };

  const checkBackendStatus = async () => {
    try {
      const isHealthy = await ApiService.healthCheck();
      setBackendStatus(isHealthy ? 'healthy' : 'offline');
    } catch (error) {
      setBackendStatus('offline');
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      Alert.alert("Success", "Settings saved successfully!");
      setEditingEmail(false);
    } catch (error) {
      Alert.alert("Error", "Failed to save settings. Please try again.");
      console.error("Error saving settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingChange = (key: keyof SettingsData, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleSaveBackendUrl = async () => {
    const url = settings.backendUrl?.trim();
    if (!url) {
      Alert.alert("Error", "Please enter a backend URL");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      Alert.alert("Error", "URL must start with http:// or https://");
      return;
    }

    try {
      ApiService.setBaseUrl(url);
      const updated = { ...settings, backendUrl: url };
      setSettings(updated);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      await checkBackendStatus();
      Alert.alert("Success", "Backend URL updated");
    } catch (error) {
      Alert.alert("Error", "Failed to save backend URL");
    }
  };

  const handleResetBackendUrl = async () => {
    try {
      const defaultUrl = ApiService.getDefaultBaseUrl();
      ApiService.setBaseUrl(defaultUrl);
      const updated = { ...settings, backendUrl: "" };
      setSettings(updated);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      await checkBackendStatus();
      Alert.alert("Success", `Backend URL reset to default (${defaultUrl})`);
    } catch (error) {
      Alert.alert("Error", "Failed to reset backend URL");
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSaveEmail = () => {
    if (!settings.ctpatReceiverEmail) {
      Alert.alert("Error", "Please enter an email address");
      return;
    }

    if (!validateEmail(settings.ctpatReceiverEmail)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    saveSettings();
  };

  const handleClearAppData = () => {
    Alert.alert(
      "Clear All Data",
      "This will delete all app data, inspections, and settings. This cannot be undone.",
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Clear",
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              await SupabaseAuthService.signOut();
              Alert.alert("Success", "App data cleared. Please restart the app.");
            } catch (error) {
              Alert.alert("Error", "Failed to clear app data");
            }
          },
        },
      ]
    );
  };

  const handleExportLogs = async () => {
    try {
      const logs = await ApiService.exportLogs();
      const logsText = JSON.stringify(logs, null, 2);
      Alert.alert(
        "Logs Exported",
        logsText.substring(0, 500) + "\n...(see console for full logs)"
      );
      console.log("📋 EXPORTED LOGS:", logs);
    } catch (error) {
      Alert.alert("Error", "Failed to export logs");
    }
  };

  const handleViewRequestStats = async () => {
    try {
      const stats = await ApiService.getRequestStats();
      Alert.alert(
        "Request Statistics",
        `Total Requests: ${stats.total}\nSuccessful: ${stats.successful}\nFailed: ${stats.failed}\nAvg Duration: ${stats.avgDuration}ms`
      );
    } catch (error) {
      Alert.alert("Error", "Failed to get request stats");
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Settings" />

      <KeyboardAwareScrollView style={styles.content}>
        {/* Backend Connection Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backend Connection</Text>

          <View style={styles.statusSection}>
            <View
              style={[
                styles.statusDot,
                backendStatus === 'healthy' ? styles.healthyDot : styles.offlineDot
              ]}
            />
            <View style={styles.statusInfo}>
              <Text style={styles.statusText}>
                {backendStatus === 'healthy' ? '✓ Connected' : '⚠ Offline'}
              </Text>
              <Text style={styles.statusSubtext}>
                {backendStatus === 'healthy' ? 'Backend is running' : 'Running in offline mode'}
              </Text>
            </View>
          </View>

          {userEmail && (
            <View style={styles.userSection}>
              <Text style={styles.userLabel}>Signed in as</Text>
              <Text style={styles.userEmail}>{userEmail}</Text>
              <TouchableOpacity accessibilityRole="button" style={styles.signOutButton} onPress={handleSignOut}>
                <Text chrome style={styles.signOutButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity accessibilityRole="button"
            style={styles.testButton}
            onPress={checkBackendStatus}
          >
            <Text chrome style={styles.testButtonText}>Check Connection</Text>
          </TouchableOpacity>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Backend URL</Text>
            <TextInput
              style={styles.input}
              placeholder={ApiService.getBaseUrl()}
              value={settings.backendUrl}
              onChangeText={(text) => handleSettingChange("backendUrl", text)}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.formButtonContainer}>
            <TouchableOpacity accessibilityRole="button"
              style={styles.saveButton}
              onPress={handleSaveBackendUrl}
            >
              <Text chrome style={styles.saveButtonText}>Save Backend URL</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
              style={styles.cancelButton}
              onPress={handleResetBackendUrl}
            >
              <Text chrome style={styles.cancelButtonText}>Reset to Default</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* General Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Settings</Text>

          {/* App Version */}
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>App Version</Text>
              <Text style={styles.settingValue}>{settings.appVersion}</Text>
            </View>
          </View>

          {/* Auto Save Toggle */}
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Auto Save Inspections</Text>
              <Text style={styles.settingDescription}>
                Automatically save inspection data
              </Text>
            </View>
            <Switch
              value={settings.autoSave}
              onValueChange={(value) => handleSettingChange("autoSave", value)}
              trackColor={{ false: "#d0d0d0", true: "#81c784" }}
              thumbColor={settings.autoSave ? "#4caf50" : "#888"}
            />
          </View>

          {/* Notifications Toggle */}
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Enable Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive inspection reminders and alerts
              </Text>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(value) =>
                handleSettingChange("notificationsEnabled", value)
              }
              trackColor={{ false: "#d0d0d0", true: "#81c784" }}
              thumbColor={settings.notificationsEnabled ? "#4caf50" : "#888"}
            />
          </View>
        </View>

        {/* CTPAT Email Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CTPAT Recipient Email</Text>

          {editingEmail ? (
            <View style={styles.formSection}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>CTPAT Receiver Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="example@ctpat.gov"
                  value={settings.ctpatReceiverEmail}
                  onChangeText={(text) =>
                    handleSettingChange("ctpatReceiverEmail", text)
                  }
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formButtonContainer}>
                <TouchableOpacity accessibilityRole="button"
                  style={styles.saveButton}
                  onPress={handleSaveEmail}
                  disabled={isSaving}
                >
                  <Text chrome style={styles.saveButtonText}>
                    {isSaving ? "Saving..." : "Save Email"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button"
                  style={styles.cancelButton}
                  onPress={() => setEditingEmail(false)}
                >
                  <Text chrome style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.emailDisplay}>
                {settings.ctpatReceiverEmail ? (
                  <>
                    <Text style={styles.emailLabel}>Current Email:</Text>
                    <Text style={styles.emailValue}>
                      {settings.ctpatReceiverEmail}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.noEmailText}>No email configured</Text>
                )}
              </View>
              <TouchableOpacity accessibilityRole="button"
                style={styles.editButton}
                onPress={() => setEditingEmail(true)}
              >
                <Text chrome style={styles.editButtonText}>
                  {settings.ctpatReceiverEmail ? "Edit Email" : "Add Email"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Inspector Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inspector Information</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Inspector Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={settings.inspectorName}
              onChangeText={(text) =>
                handleSettingChange("inspectorName", text)
              }
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Company Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter company name"
              value={settings.companyName}
              onChangeText={(text) => handleSettingChange("companyName", text)}
            />
          </View>

          <TouchableOpacity accessibilityRole="button" style={styles.saveSettingsButton} onPress={saveSettings}>
            <Text chrome style={styles.saveSettingsButtonText}>
              {isSaving ? "Saving..." : "Save Inspector Information"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Debugging Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debugging Tools</Text>

          <TouchableOpacity accessibilityRole="button"
            style={styles.debugButton}
            onPress={handleViewRequestStats}
          >
            <Text chrome style={styles.debugButtonText}>📊 View Request Stats</Text>
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button"
            style={styles.debugButton}
            onPress={handleExportLogs}
          >
            <Text chrome style={styles.debugButtonText}>📋 Export Request Logs</Text>
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button"
            style={[styles.debugButton, styles.clearButton]}
            onPress={() => ApiService.clearLogs()}
          >
            <Text chrome style={[styles.debugButtonText, styles.clearButtonText]}>
              🗑️ Clear Request Logs
            </Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <TouchableOpacity accessibilityRole="button"
            style={styles.dangerButton}
            onPress={handleClearAppData}
          >
            <Text chrome style={styles.dangerButtonText}>⚠️ Clear All App Data</Text>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutText}>
              CTPAT Inspection and Signoff App
            </Text>
            <Text style={styles.aboutSubtext}>Version {settings.appVersion}</Text>
          </View>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutText}>
              This app helps streamline the CTPAT inspection process for trucks
              and trailers.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    backgroundColor: "#fff",
    marginBottom: 20,
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  healthyDot: {
    backgroundColor: '#4CAF50',
  },
  offlineDot: {
    backgroundColor: '#FF9800',
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusSubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  userSection: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  signOutButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#ffe5e5',
  },
  signOutButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cc3333',
  },
  testButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    marginHorizontal: 15,
    marginVertical: 12,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 14,
    color: "#666",
  },
  settingDescription: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
  },
  formSection: {
    padding: 15,
    backgroundColor: "#f9f9f9",
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
  },
  formButtonContainer: {
    flexDirection: "row",
    gap: 10,
  },
  saveButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    flex: 1,
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  cancelButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    flex: 1,
    backgroundColor: "#ddd",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  emailDisplay: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: "#f9f9f9",
  },
  emailLabel: {
    fontSize: 13,
    color: "#999",
    marginBottom: 6,
    fontWeight: "500",
  },
  emailValue: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  noEmailText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
  },
  editButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  saveSettingsButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  saveSettingsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  debugButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    marginHorizontal: 15,
    marginVertical: 8,
    backgroundColor: '#5C6BC0',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  debugButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  clearButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    backgroundColor: '#9C27B0',
  },
  clearButtonText: {
    color: '#fff',
  },
  dangerButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    marginHorizontal: 15,
    marginVertical: 10,
    backgroundColor: '#F44336',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  aboutItem: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  aboutText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  aboutSubtext: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
  },
});
