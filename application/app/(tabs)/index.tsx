import { useRouter } from 'expo-router';
import React from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function HomeScreen() {
  const router = useRouter();

  // useEffect(() => {
  //   // This only works on Android and only with certain builds.
  //   // We safe-load it here so it doesn't crash the whole app if missing.
  //   if (Platform.OS === 'android') {
  //     try {
  //       const NavigationBar = require('expo-navigation-bar');
  //       NavigationBar.setBehaviorAsync('overlay-swipe');
  //       NavigationBar.setVisibilityAsync('hidden');
  //     } catch (e) {
  //       // Just ignore if the module isn't available in Expo Go
  //     }
  //   }
  // }, []);

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" />

      <View style={styles.logoBox}>
        <View style={styles.book}>
          {/* Audio waveform bars inside the book */}
          <View style={[styles.bar, { height: 14 }]} />
          <View style={[styles.bar, { height: 22 }]} />
          <View style={[styles.bar, { height: 16 }]} />
          <View style={[styles.bar, { height: 26 }]} />
          <View style={[styles.bar, { height: 18 }]} />
          <View style={[styles.bar, { height: 12 }]} />
        </View>
        {/* Book spine line at the bottom */}
        <View style={styles.bookSpine} />
      </View>

      {/* ── Main Tagline ── */}
      <Text style={styles.taglineWhite}>Speak your mind.</Text>
      <Text style={styles.taglineGold}>Hear your thoughts.</Text>

      {/* ── Subtitle ── */}
      <Text style={styles.subtitle}>Your AI-powered voice journal.</Text>

      {/* ── Get Started Button ── */}
      <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={() => router.push('/login' as any)}>
        <Text style={styles.buttonText}>GET STARTED</Text>
      </TouchableOpacity>

      {/* ── Divider with text ── */}
      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>CRAFTED FOR INTROSPECTION</Text>
        <View style={styles.line} />
      </View>

      {/* ── Privacy note at the bottom ── */}
      <View style={styles.privacyRow}>
        <Text style={styles.privacyText}>🔒  YOUR THOUGHTS STAY PRIVATE. ALWAYS.</Text>
      </View>

    </View>
  );
}

// =============================================
// STYLES
// =============================================

const GOLD = '#d4a017';

const styles = StyleSheet.create({

  // Dark background, everything centered
  page: {
    flex: 1,
    backgroundColor: '#0f0f1c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },

  // ── Logo ──
  logoBox: {
    alignItems: 'center',
    marginBottom: 48,
  },

  book: {
    width: 80,
    height: 56,
    backgroundColor: '#2a2210',
    borderRadius: 6,
    borderWidth: 2.5,
    borderColor: GOLD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },

  bar: {
    width: 4,
    backgroundColor: GOLD,
    borderRadius: 2,
  },

  bookSpine: {
    width: 80,
    height: 5,
    backgroundColor: GOLD,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    opacity: 0.6,
  },

  // ── Tagline ──
  taglineWhite: {
    fontSize: 44,
    fontStyle: 'italic',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 54,
    fontWeight: '300',
  },

  taglineGold: {
    fontSize: 44,
    fontStyle: 'italic',
    color: GOLD,
    textAlign: 'center',
    lineHeight: 54,
    fontWeight: '300',
    marginBottom: 28,
  },

  // ── Subtitle ──
  subtitle: {
    fontSize: 15,
    color: '#99a0b0',
    textAlign: 'center',
    marginBottom: 52,
  },

  // ── Button ──
  button: {
    backgroundColor: GOLD,
    borderRadius: 50,
    paddingVertical: 20,
    paddingHorizontal: 64,
    marginBottom: 44,
    // Glow effect
    shadowColor: GOLD,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  buttonText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3,
  },

  // ── Divider ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 40,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },

  dividerText: {
    fontSize: 9,
    color: '#666',
    letterSpacing: 2.5,
  },

  // ── Privacy ──
  privacyRow: {
    position: 'absolute',
    bottom: 36,
  },

  privacyText: {
    fontSize: 10,
    color: '#555',
    letterSpacing: 1.5,
  },

});


// import { useRouter} from 'expo-router'
// import React from 'react'

// import {
//   StatusBar,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View
// } from 'react-native'


// export default function homeScreen() {
//   const router = useRouter();

//   return{
//     <View style={styles.page}>
//     <StatusBar barStyle="light-content"/>
//     <View style={styles.logobox}></View>
//     }
//   }

// }

// const styles = StyleSheet.create({
//   page:{
//     flex:1,
//     backgroundColor: '#0f0f1c',
//     alignItems: 'center',
// justifyContent: 'center',
// paddingHorizontal: 36
//   }
// })