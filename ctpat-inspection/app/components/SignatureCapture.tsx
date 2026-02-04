import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SignatureService, { StoredSignature } from '../services/SignatureService';

interface SignatureCaptureProps {
  onSignatureSaved: (signature: StoredSignature) => void;
  currentSignatureId?: string;
}

export default function SignatureCapture({ onSignatureSaved }: SignatureCaptureProps) {
  const [showModal, setShowModal] = useState(false);
  const [savedSignatures, setSavedSignatures] = useState<StoredSignature[]>([]);
  const [signatureInput, setSignatureInput] = useState('');

  const handleSaveTextSignature = async () => {
    if (!signatureInput.trim()) {
      Alert.alert('Error', 'Please enter your signature text');
      return;
    }

    try {
      // Create a simple text-based signature representation
      // Use btoa for web, Buffer for native
      let base64Data: string;
      if (typeof Buffer !== 'undefined') {
        base64Data = Buffer.from(signatureInput).toString('base64');
      } else {
        base64Data = btoa(signatureInput);
      }
      
      const savedSignature = await SignatureService.saveSignature(base64Data, 'drawn');
      onSignatureSaved(savedSignature);
      setSignatureInput('');
      setShowModal(false);
      Alert.alert('Success', 'Signature saved successfully');
    } catch (error) {
      console.error('Error saving signature:', error);
      Alert.alert('Error', 'Failed to save signature');
    }
  };

  const handleLoadSignatures = async () => {
    try {
      const signatures = await SignatureService.getAllSignatures();
      setSavedSignatures(signatures);
    } catch (error) {
      console.error('Error loading signatures:', error);
    }
  };

  const handleSelectSignature = async (signature: StoredSignature) => {
    try {
      const base64Data = await SignatureService.loadSignature(signature.id);
      if (base64Data) {
        const updatedSig: StoredSignature = { ...signature, base64Data };
        onSignatureSaved(updatedSig);
        setShowModal(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load signature');
    }
  };

  const handleDeleteSignature = (signatureId: string) => {
    Alert.alert(
      'Delete Signature',
      'Are you sure?',
      [
        { text: 'Cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await SignatureService.deleteSignature(signatureId);
              handleLoadSignatures();
              Alert.alert('Success', 'Signature deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete signature');
            }
          },
        },
      ]
    );
  };

  const handleUploadSignature = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 1],
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Data = result.assets[0].base64;
        const savedSignature = await SignatureService.saveSignature(base64Data, 'uploaded');
        onSignatureSaved(savedSignature);
        setShowModal(false);
        Alert.alert('Success', 'Signature uploaded successfully');
        handleLoadSignatures();
      }
    } catch (error) {
      console.error('Error uploading signature:', error);
      Alert.alert('Error', 'Failed to upload signature');
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.openButton}
        onPress={() => {
          setShowModal(true);
          handleLoadSignatures();
        }}
      >
        <Text style={styles.openButtonText}>✍️ Add Signature</Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Signature</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Signature Input */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Enter Your Signature</Text>
                <Text style={styles.sectionDescription}>
                  Type your name or initials (draw your signature on a paper and take a photo to use as signature image)
                </Text>
                <TextInput
                  style={styles.signatureInput}
                  placeholder="Type your signature here..."
                  value={signatureInput}
                  onChangeText={setSignatureInput}
                  multiline
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSaveTextSignature}
                >
                  <Text style={styles.buttonText}>Save Signature</Text>
                </TouchableOpacity>
              </View>

              {/* Upload Signature */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Upload Signature Image</Text>
                <Text style={styles.sectionDescription}>
                  Upload a photo of your handwritten signature
                </Text>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleUploadSignature}
                >
                  <Text style={styles.buttonText}>📸 Upload Image</Text>
                </TouchableOpacity>
              </View>

              {/* Saved Signatures */}
              {savedSignatures.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Saved Signatures ({savedSignatures.length})
                  </Text>
                  {savedSignatures.map((sig) => (
                    <View key={sig.id} style={styles.signatureCard}>
                      <View style={styles.signatureInfo}>
                        <Text style={styles.signatureLabel}>{sig.name}</Text>
                        <Text style={styles.signatureType}>Type: {sig.type}</Text>
                      </View>
                      <View style={styles.signatureActions}>
                        <TouchableOpacity
                          onPress={() => handleSelectSignature(sig)}
                          style={[styles.microButton, styles.useButton]}
                        >
                          <Text style={styles.microButtonText}>Use</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteSignature(sig.id)}
                          style={[styles.microButton, styles.deleteButton]}
                        >
                          <Text style={styles.microButtonText}>Del</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  openButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  openButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
    fontWeight: 'bold',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  drawingArea: {
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  drawingPlaceholder: {
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    flex: 1,
  },
  secondaryButton: {
    backgroundColor: '#FF9500',
    flex: 1,
  },
  uploadButton: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#999',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  signaturePreview: {
    marginRight: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  signatureImage: {
    width: 150,
    height: 80,
    borderRadius: 4,
    marginBottom: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#eee',
  },
  signatureLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  signatureActions: {
    flexDirection: 'row',
    gap: 5,
  },
  microButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  selectButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
  },
  microButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  signatureInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  signatureCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  signatureInfo: {
    marginBottom: 8,
  },
  signatureType: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  useButton: {
    backgroundColor: '#4CAF50',
  },
});
