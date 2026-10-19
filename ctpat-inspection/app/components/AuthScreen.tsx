import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';

export interface AuthNotice {
  kind: 'error' | 'info';
  text: string;
}

interface Props {
  title: string;
  subtitle?: string;
  /** Shown between the title and the form. */
  notice?: AuthNotice | null;
  children: React.ReactNode;
}

/** The frame shared by every signed-out screen: title, a message area, then the form. */
export default function AuthScreen({ title, subtitle, notice, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
    >
      <View style={styles.column}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {notice ? (
          <View
            style={[styles.notice, notice.kind === 'error' ? styles.errorNotice : styles.infoNotice]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text style={[styles.noticeText, notice.kind === 'error' ? styles.errorText : styles.infoText]}>
              {notice.text}
            </Text>
          </View>
        ) : null}

        {children}
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // flexGrow centres the form on tall screens; on short ones (keyboard open) it scrolls.
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  // A readable column on wide screens such as an unfolded foldable.
  column: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#666',
    marginTop: 8,
  },
  notice: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
  },
  errorNotice: { backgroundColor: '#fdecea', borderColor: '#f5c2c0' },
  infoNotice: { backgroundColor: '#e8f1fb', borderColor: '#b9d3f0' },
  noticeText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  errorText: { color: '#b3261e' },
  infoText: { color: '#0b4f99' },
});
