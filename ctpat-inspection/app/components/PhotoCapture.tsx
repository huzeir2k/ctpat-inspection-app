import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import PhotoService, { PhotoCaptureMetadata, StoredPhoto } from '../services/PhotoService';

interface PhotoCaptureProps {
  photos: StoredPhoto[];
  onPhotosChanged: (photos: StoredPhoto[]) => void;
  /** Current inspection metadata to stamp onto newly captured photos */
  metadata: PhotoCaptureMetadata;
}

/**
 * Formats a photo's caption line: timestamp, freight bill number, and
 * load origin/destination (plus seal number / truck-trailer when present).
 */
function formatCaption(photo: StoredPhoto): string {
  const lines = [`📅 ${new Date(photo.takenAt).toLocaleString()}`];

  if (photo.freightBillNumber) lines.push(`FB#: ${photo.freightBillNumber}`);
  if (photo.sealNumber) lines.push(`Seal: ${photo.sealNumber}`);
  if (photo.loadOrigin || photo.loadDestination) {
    lines.push(`${photo.loadOrigin || '—'} → ${photo.loadDestination || '—'}`);
  }
  if (photo.truckNumber || photo.trailerNumber) {
    lines.push(`Truck/Trailer: ${photo.truckNumber || '—'} / ${photo.trailerNumber || '—'}`);
  }

  return lines.join('\n');
}

export default function PhotoCapture({ photos, onPhotosChanged, metadata }: PhotoCaptureProps) {
  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in Settings to take inspection photos.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets[0]?.base64) {
        return;
      }

      const savedPhoto = await PhotoService.savePhoto(result.assets[0].base64, metadata);
      onPhotosChanged([...photos, savedPhoto]);
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    Alert.alert('Delete Photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await PhotoService.deletePhoto(photoId);
            onPhotosChanged(photos.filter((p) => p.id !== photoId));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete photo');
          }
        },
      },
    ]);
  };

  return (
    <View>
      <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto}>
        <Text style={styles.captureButtonText}>📷 Take Photo</Text>
      </TouchableOpacity>

      {photos.length === 0 && (
        <Text style={styles.emptyText}>
          No photos yet. Photos will be stamped with the current timestamp, freight bill
          number, and load origin/destination.
        </Text>
      )}

      <ScrollView contentContainerStyle={styles.grid}>
        {photos.map((photo) => (
          <View key={photo.id} style={styles.photoCard}>
            <Image
              source={{ uri: `data:image/jpeg;base64,${photo.base64Data}` }}
              style={styles.photoImage}
            />
            <Text style={styles.caption}>{formatCaption(photo)}</Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeletePhoto(photo.id)}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  captureButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  captureButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyText: {
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 15,
  },
  grid: {
    gap: 12,
  },
  photoCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 10,
    marginBottom: 12,
  },
  photoImage: {
    width: '100%',
    height: 220,
    borderRadius: 6,
    backgroundColor: '#e5e5e5',
  },
  caption: {
    marginTop: 8,
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  deleteButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FF6B6B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
