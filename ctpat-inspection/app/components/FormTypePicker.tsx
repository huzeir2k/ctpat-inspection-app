import React, { useState } from 'react';
import { FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import Text from './AppText';
import { FormDefinition } from '../models/InspectionForm';

interface FormTypePickerProps {
  forms: FormDefinition[];
  selectedFormId: string | null;
  onSelect: (formId: string) => void;
}

/** Dropdown for choosing which CTPAT inspection form to fill in. */
export default function FormTypePicker({ forms, selectedFormId, onSelect }: FormTypePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = forms.find((form) => form.id === selectedFormId);

  return (
    <>
      <Text style={styles.label}>Inspection Type</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choose inspection type"
      >
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : 'Select an inspection form...'}
        </Text>
        <Text chrome style={styles.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.sheet}>
            <Text chrome style={styles.sheetTitle}>Choose Inspection Type</Text>
            <FlatList
              data={forms}
              keyExtractor={(form) => form.id}
              renderItem={({ item }) => (
                <TouchableOpacity accessibilityRole="button"
                  style={[styles.option, item.id === selectedFormId && styles.optionSelected]}
                  onPress={() => {
                    setOpen(false);
                    onSelect(item.id);
                  }}
                >
                  <Text style={styles.optionLabel}>{item.label}</Text>
                  <Text style={styles.optionCount}>{item.checklist.length} checklist items</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6 },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    minHeight: 52,
    padding: 14,
  },
  // flex: 1 lets a long form name wrap instead of pushing the arrow off the edge.
  value: { flex: 1, fontSize: 18, fontWeight: '600', color: '#222', marginRight: 8 },
  placeholder: { flex: 1, fontSize: 18, color: '#999', marginRight: 8 },
  arrow: { fontSize: 18, color: '#007AFF' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  // A centred dialog, never wider than a phone's width, even on an unfolded foldable.
  sheet: { backgroundColor: '#fff', borderRadius: 14, padding: 16, maxHeight: '80%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#222' },
  option: { minHeight: 52, justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 10, borderRadius: 8 },
  optionSelected: { backgroundColor: '#E6F0FF' },
  optionLabel: { fontSize: 18, fontWeight: '600', color: '#222' },
  optionCount: { fontSize: 13, color: '#777', marginTop: 2 },
});
