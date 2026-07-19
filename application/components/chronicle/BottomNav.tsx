import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const GOLD = '#d4a017';

export type NavTab = 'HOME' | 'HISTORY' | 'INSIGHTS' | 'SETTINGS';

const TABS: { icon: string; label: NavTab; route: string | null }[] = [
  { icon: '⊞', label: 'HOME', route: '/dashboard' },
  { icon: '⟳', label: 'HISTORY', route: '/jornalHistory' },
  { icon: '↗', label: 'INSIGHTS', route: null },
  { icon: '⚙', label: 'SETTINGS', route: '/settings' },
];

export default function BottomNav({ active }: { active?: NavTab }) {
  const router = useRouter();

  return (
    <View style={styles.bottomNav}>
      {TABS.map((tab) => {
        const isActive = active === tab.label;
        return (
          <TouchableOpacity
            key={tab.label}
            style={styles.navItem}
            onPress={() => {
              if (isActive) return;
              if (!tab.route) {
                Alert.alert('Coming soon', 'Mood insights and trends are on the way.');
                return;
              }
              router.push(tab.route as any);
            }}
          >
            <Text style={[styles.navIcon, isActive && styles.navIconActive]}>{tab.icon}</Text>
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#13132a',
    borderTopWidth: 1,
    borderTopColor: '#22223a',
    paddingVertical: 12,
    paddingBottom: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navIcon: {
    fontSize: 20,
    color: '#666',
  },
  navIconActive: {
    color: GOLD,
  },
  navLabel: {
    fontSize: 9,
    color: '#555',
    letterSpacing: 1,
  },
  navLabelActive: {
    color: GOLD,
    fontWeight: '600',
  },
});
