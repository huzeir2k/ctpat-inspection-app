import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import ErrorHandlerService from '../services/ErrorHandlerService';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: {
    message: string;
    userMessage: string;
    code?: string;
  } | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const formattedError = ErrorHandlerService.formatError(error);
    this.setState({ errorInfo: formattedError });
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>⚠️</Text>
          </View>
          
          <Text style={styles.title}>Oops! Something went wrong</Text>
          
          <Text style={styles.message}>
            {this.state.errorInfo?.userMessage || 'An unexpected error occurred. Please try again.'}
          </Text>

          {__DEV__ && this.state.errorInfo?.code && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugLabel}>Error Code: {this.state.errorInfo.code}</Text>
              <Text style={styles.debugMessage}>{this.state.error?.message}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={this.resetError}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
    maxWidth: '90%',
  },
  debugInfo: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff9800',
    marginBottom: 4,
  },
  debugMessage: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
    minWidth: 200,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
