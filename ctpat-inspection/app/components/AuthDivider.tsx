import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './AppText';

/** A thin line with a word in the middle, e.g. "or sign up with email". */
export default function AuthDivider({ label }: { label: string }) {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  line: { flex: 1, height: 1, backgroundColor: '#d0d0d0' },
  label: { marginHorizontal: 12, color: '#777', fontSize: 13 },
});
