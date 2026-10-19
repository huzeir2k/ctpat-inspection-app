import React, { forwardRef } from 'react';
import { StyleSheet, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import Text from './AppText';

interface Props extends TextInputProps {
  label: string;
  /** Small text button at the right of the input, e.g. "Show" for passwords. */
  action?: { label: string; onPress: () => void };
}

/** A labelled text input in the style shared by all signed-out screens. */
const AuthField = forwardRef<TextInput, Props>(({ label, action, style, ...inputProps }, ref) => (
  <View style={styles.group}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputRow}>
      <TextInput
        ref={ref}
        style={[styles.input, action && styles.inputWithAction, style]}
        accessibilityLabel={label}
        {...inputProps}
      />
      {action ? (
        <TouchableOpacity style={styles.action} onPress={action.onPress} accessibilityRole="button">
          <Text chrome style={styles.actionText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  </View>
));
AuthField.displayName = 'AuthField';

export default AuthField;

const styles = StyleSheet.create({
  group: { marginTop: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  inputRow: { justifyContent: 'center' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputWithAction: { paddingRight: 72 },
  action: { position: 'absolute', right: 0, top: 0, bottom: 0, paddingHorizontal: 14, justifyContent: 'center' },
  actionText: { color: '#0066cc', fontSize: 14, fontWeight: '600' },
});
