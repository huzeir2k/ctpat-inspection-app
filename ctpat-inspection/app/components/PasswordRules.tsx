import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import { PASSWORD_RULES } from '../models/passwordRules';

/** Live checklist under a password field: each rule turns green as it is met. */
export default function PasswordRules({ password }: { password: string }) {
  return (
    <View style={styles.list} accessibilityLabel="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.isMet(password);
        return (
          <Text key={rule.id} style={[styles.rule, met ? styles.met : styles.unmet]}>
            {met ? '✓' : '○'} {rule.label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 10 },
  rule: { fontSize: 13, marginTop: 3 },
  met: { color: '#1e7d32' },
  unmet: { color: '#666' },
});
