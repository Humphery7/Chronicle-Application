import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/auth-context';
import { ApiError, JournalSummary, journalsApi, Mood } from '@/lib/api';
import BottomNav from '@/components/chronicle/BottomNav';

const GOLD = '#d4a017';
const PAGE_BG = '#0f0f1c';
const CARD_BG = '#17172a';

const VIBES: { emoji: string; label: Mood }[] = [
  { emoji: '😌', label: 'Calm' },
  { emoji: '😞', label: 'Low' },
  { emoji: '😤', label: 'Frustrated' },
  { emoji: '😊', label: 'Happy' },
  { emoji: '😰', label: 'Anxious' },
];

const MOOD_TAG_COLOR: Record<Mood, string> = {
  Calm: '#3b2f7a',
  Low: '#3a3a52',
  Frustrated: '#5f2f2f',
  Happy: '#1e3a5f',
  Anxious: '#5f4a1e',
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getGreetingEmoji(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '☀';
  if (hour < 17) return '☀';
  return '☽';
}

function getUserName(user: any): string {
  if (user?.full_name) return user.full_name;
  if (user?.email) return user.email.split('@')[0];
  return 'Friend';
}

function formatEntryDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `TODAY, ${time}`.toUpperCase();
  if (isYesterday) return `YESTERDAY, ${time}`.toUpperCase();
  return date
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase() + `, ${time}`;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const [selectedVibe, setSelectedVibe] = useState<Mood>('Calm');
  const [entries, setEntries] = useState<JournalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const greeting = getGreeting();
  const emoji = getGreetingEmoji();
  const name = getUserName(user);

  const loadEntries = useCallback(async () => {
    try {
      setError(null);
      const data = await journalsApi.list();
      setEntries(data.slice(0, 3));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your journal entries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>

        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={styles.avatar}>
              {user?.picture ? (
                <Image source={{ uri: user.picture }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>👤</Text>
              )}
            </View>
            <Text style={styles.topBarGreeting}>{greeting}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/jornalHistory')}>
            <Text style={styles.searchIcon}>🔍</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroText}>{greeting},{'\n'}{name} <Text style={styles.heroMoon}>{emoji}</Text></Text>
          <Text style={styles.heroSub}>How are you feeling today?</Text>
        </View>

        <Text style={styles.sectionLabel}>CURRENT VIBE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.vibeScroll}
          contentContainerStyle={styles.vibeContent}
        >
          {VIBES.map((vibe) => {
            const isActive = selectedVibe === vibe.label;
            return (
              <TouchableOpacity
                key={vibe.label}
                style={[styles.vibePill, isActive && styles.vibePillActive]}
                onPress={() => setSelectedVibe(vibe.label)}
              >
                <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
                <Text style={[styles.vibeLabel, isActive && styles.vibeLabelActive]}>
                  {vibe.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.journalCard}>
          <Text style={styles.journalDate}>{selectedVibe.toUpperCase()} MOOD SELECTED</Text>
          <Text style={styles.journalTitle}>Today&apos;s Journal</Text>

          <TouchableOpacity
            style={styles.micButton}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/activeRecording', params: { mood: selectedVibe } })}
          >
            <Text style={styles.micIcon}>🎙</Text>
          </TouchableOpacity>

          <Text style={styles.recordText}>Tap to begin recording</Text>
        </View>

        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>Recent Entries</Text>
          <TouchableOpacity onPress={() => router.push('/jornalHistory')}>
            <Text style={styles.viewAll}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={GOLD} style={{ marginVertical: 24 }} />
        ) : error ? (
          <Text style={styles.emptyText}>{error}</Text>
        ) : entries.length === 0 ? (
          <Text style={styles.emptyText}>
            No entries yet — tap the mic above to record your first journal.
          </Text>
        ) : (
          entries.map((entry) => (
            <TouchableOpacity
              key={entry._id}
              style={styles.entryCard}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/aiReflection', params: { id: entry._id } })}
            >
               <View style={styles.entryRow}>
                <Text style={styles.entryDate}>{formatEntryDate(entry.created_at)}</Text>
                <View style={styles.entryRight}>
                  <View style={[styles.entryTag, { backgroundColor: MOOD_TAG_COLOR[entry.mood] }]}>
                    <View style={styles.tagDot} />
                    <Text style={styles.tagText}>{entry.mood.toUpperCase()}</Text>
                  </View>
                  {entry.status === 'processing' && <ActivityIndicator size="small" color={GOLD} />}
                </View>
              </View>
              <Text style={styles.entryQuote} numberOfLines={2}>
                {entry.status === 'failed' ? 'This entry could not be processed.' : `"${entry.preview}"`}
              </Text>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 100 }} />

      </ScrollView>

      <BottomNav active="HOME" />

    </SafeAreaView>
  );
}

// =============================================
// STYLES
// =============================================

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  page: {
    flex: 1,
    paddingHorizontal: 22,
  },

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },

  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a3d',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 18,
  },

  topBarGreeting: {
    color: '#cccccc',
    fontSize: 16,
    fontWeight: '500',
  },

  searchIcon: {
    fontSize: 20,
    color: GOLD,
  },

  // ── Hero ──
  hero: {
    marginBottom: 28,
  },

  heroText: {
    fontSize: 40,
    fontWeight: '300',
    color: '#ffffff',
    lineHeight: 50,
    marginBottom: 10,
  },

  heroMoon: {
    color: GOLD,
    fontSize: 28,
    fontStyle: 'normal',
  },

  heroSub: {
    fontSize: 15,
    color: '#888',
  },

  // ── Vibe Pills ──
  sectionLabel: {
    fontSize: 11,
    color: '#666',
    letterSpacing: 2,
    marginBottom: 10,
  },

  vibeScroll: {
    marginBottom: 28,
  },

  vibeContent: {
    gap: 10,
    paddingRight: 20,
  },

  vibePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e1e30',
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2a2a40',
  },

  vibePillActive: {
    backgroundColor: '#2e2800',
    borderColor: GOLD,
  },

  vibeEmoji: {
    fontSize: 16,
  },

  vibeLabel: {
    fontSize: 14,
    color: '#888',
  },

  vibeLabelActive: {
    color: GOLD,
    fontWeight: '600',
  },

  // ── Journal Card ──
  journalCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },

  journalDate: {
    fontSize: 11,
    color: GOLD,
    letterSpacing: 2,
    marginBottom: 8,
  },

  journalTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 32,
  },

  micButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    // Gold glow
    shadowColor: GOLD,
    shadowOpacity: 0.7,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },

  micIcon: {
    fontSize: 40,
  },

  recordText: {
    fontSize: 15,
    color: '#aaa',
  },

  // ── Recent Entries ──
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  recentTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },

  viewAll: {
    fontSize: 12,
    color: GOLD,
    letterSpacing: 1,
    fontWeight: '600',
  },

  emptyText: {
    color: '#777',
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 24,
    lineHeight: 20,
  },

  entryCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },

  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  entryDate: {
    fontSize: 11,
    color: '#666',
    letterSpacing: 0.5,
  },

  entryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  entryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 50,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },

  tagDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: GOLD,
  },

  tagText: {
    fontSize: 10,
    color: '#ccc',
    letterSpacing: 1,
    fontWeight: '600',
  },

  entryQuote: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#888',
  },

});
