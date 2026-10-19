import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Text from './AppText';
import { ChecklistItem } from '../models/InspectionForm';

interface ChecklistSectionProps {
  items: ChecklistItem[];
  checked: Record<string, boolean>;
  onToggle: (itemId: string) => void;
}

/** The list of inspection points, each ticked once the inspector has checked it. */
export default function ChecklistSection({ items, checked, onToggle }: ChecklistSectionProps) {
  return (
    <View>
      {items.map((item, index) => {
        const isChecked = checked[item.id] === true;
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.item, isChecked && styles.itemChecked]}
            onPress={() => onToggle(item.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isChecked }}
          >
            <View style={[styles.box, isChecked && styles.boxChecked]}>
              {isChecked && <Text style={styles.tick}>✓</Text>}
            </View>
            <View style={styles.text}>
              <Text style={styles.label}>
                {index + 1}. {item.label}
              </Text>
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    minHeight: 56,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  itemChecked: { borderColor: '#34C759', backgroundColor: '#F2FBF5' },
  box: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  boxChecked: { backgroundColor: '#34C759', borderColor: '#34C759' },
  tick: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  text: { flex: 1 },
  label: { fontSize: 17, fontWeight: '600', color: '#222' },
  description: { fontSize: 14, color: '#666', marginTop: 2 },
});
