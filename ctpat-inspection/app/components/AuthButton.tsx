import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import Text from './AppText';

interface Props {
  title: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  /** "primary" is the filled main action, "secondary" an outlined one, "link" a quiet text button. */
  variant?: 'primary' | 'secondary' | 'link';
}

export default function AuthButton({ title, onPress, isLoading = false, disabled = false, variant = 'primary' }: Props) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || isLoading;
  const containerStyle = isPrimary ? styles.primary : variant === 'secondary' ? styles.secondary : styles.link;

  return (
    <TouchableOpacity
      style={[containerStyle, isDisabled && styles.disabled]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
    >
      {isLoading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : '#0066cc'} />
      ) : (
        <Text chrome style={isPrimary ? styles.primaryText : styles.linkText}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#0066cc',
    borderRadius: 8,
    minHeight: 48,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  linkText: { color: '#0066cc', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
