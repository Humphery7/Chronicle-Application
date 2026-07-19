import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// =============================================
// EXPLORE SCREEN  (app/(tabs)/explore.tsx)
// This is the second tab. Build it out later.
// =============================================

export default function ExploreScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Explore 🔍</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0f0f1c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
  },
});