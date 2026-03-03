import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo) {
    // Error captured silently
  }

  handleRecover = () => {
    this.setState({ hasError: false });
    router.replace('/(tabs)/home');
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0F0F2D', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>
            Something went wrong
          </Text>
          <Text style={{ color: '#8888AA', fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 20 }}>
            The app encountered an unexpected error. Tap below to return to the home screen.
          </Text>
          <TouchableOpacity
            onPress={this.handleRecover}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#7C3AED',
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>Return Home</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
