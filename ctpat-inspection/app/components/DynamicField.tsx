import React from 'react';
import { StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import Text from './AppText';
import { describeSignature, toSignatureValue } from '../models/signatureValue';
import { FieldValue, FormField, SignatureValue } from '../models/InspectionForm';
import SignatureCapture from './SignatureCapture';

interface DynamicFieldProps {
  field: FormField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
}

/** Renders one sign-off field of a form definition, whatever its type. */
export default function DynamicField({ field, value, onChange }: DynamicFieldProps) {
  const label = field.required ? `${field.label} *` : field.label;

  switch (field.type) {
    case 'boolean':
      return (
        <View style={styles.switchRow}>
          <Text style={[styles.label, styles.switchLabel]}>{label}</Text>
          <Switch value={value === true} onValueChange={onChange} />
        </View>
      );

    case 'choice':
      return (
        <View style={styles.group}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.choices}>
            {field.options?.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.choice, value === option.value && styles.choiceSelected]}
                onPress={() => onChange(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: value === option.value }}
              >
                <Text chrome style={[styles.choiceText, value === option.value && styles.choiceTextSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );

    case 'signature': {
      const signature = typeof value === 'object' ? (value as SignatureValue) : null;
      return (
        <View style={styles.group}>
          <Text style={styles.label}>{label}</Text>
          {signature && <Text style={styles.signed}>✓ {describeSignature(signature)}</Text>}
          <SignatureCapture
            onSignatureSaved={(stored) => onChange(toSignatureValue(stored))}
          />
        </View>
      );
    }

    default:
      return (
        <View style={styles.group}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={typeof value === 'string' ? value : ''}
            onChangeText={onChange}
            maxLength={field.maxLength}
            placeholder={field.type === 'date' ? 'MM/DD/YYYY' : field.type === 'time' ? 'HH:mm' : undefined}
            placeholderTextColor="#999"
            autoCapitalize={field.key.endsWith('Name') ? 'words' : field.type === 'text' ? 'characters' : 'none'}
            autoCorrect={false}
          />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: { fontSize: 15, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 17,
    color: '#222',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  switchLabel: { flex: 1, marginBottom: 0, marginRight: 12 },
  choices: { flexDirection: 'row', flexWrap: 'wrap' },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  choiceSelected: { backgroundColor: '#007AFF' },
  choiceText: { fontSize: 15, color: '#007AFF', fontWeight: '600' },
  choiceTextSelected: { color: '#fff' },
  signed: { fontSize: 15, color: '#1B8A3A', marginBottom: 6 },
});
