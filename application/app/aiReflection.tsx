import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { ApiError, Journal, aiApi, journalsApi, mediaUrl } from '@/lib/api';
import BottomNav from '@/components/chronicle/BottomNav';

const GOLD = '#d4a017';
const PAGE_BG = '#0f0f1c';

function formatEntryDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    .toUpperCase();
}

/** Renders a reflection paragraph, bolding the highlight word if it appears in it. */
function ReflectionParagraph({ text, highlight }: { text: string; highlight?: string | null }) {
  if (!highlight) {
    return <Text style={styles.aiBodyText}>{text}</Text>;
  }
  const idx = text.toLowerCase().indexOf(highlight.toLowerCase());
  if (idx === -1) {
    return <Text style={styles.aiBodyText}>{text}</Text>;
  }
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + highlight.length);
  const after = text.slice(idx + highlight.length);
  return (
    <Text style={styles.aiBodyText}>
      {before}
      <Text style={styles.aiHighlightText}>{match}</Text>
      {after}
    </Text>
  );
}

export default function EntryReflectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const player = useAudioPlayer(null);

  const loadJournal = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await journalsApi.get(id);
      setJournal(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load this entry.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadJournal();
  }, [loadJournal]);

  const handleListen = async () => {
    if (!journal?.reflection) return;
    setSpeaking(true);
    try {
      const text = [journal.reflection.title, ...journal.reflection.body].join('. ');
      const { audio_url } = await aiApi.textToSpeech(text);
      const uri = mediaUrl(audio_url);
      if (uri) {
        player.replace({ uri });
        player.play();
      }
    } catch (e) {
      Alert.alert('Playback unavailable', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setSpeaking(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !journal) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{error || 'Entry not found.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadJournal}>
            <Text style={styles.retryButtonText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const reflection = journal.reflection;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── ZONE 1: THE HEADER LINE ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.avatar} onPress={() => router.back()}>
              <Text style={styles.avatarIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {journal.title || 'Your Journal Entry'}
            </Text>
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.headerDate}>{formatEntryDate(journal.created_at)}</Text>
          </View>
        </View>

        {/* ── ZONE 2: USER QUOTE BOX ── */}
        <View style={styles.quoteWrapper}>
          <View style={styles.quoteBadge}>
            <Text style={styles.quoteBadgeText}>❝</Text>
          </View>
          <View style={styles.quoteCard}>
            <Text style={styles.quoteText}>&ldquo;{journal.transcript}&rdquo;</Text>
          </View>
        </View>

        {/* ── SECTION DIVIDER ── */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>CHRONICLE&apos;S REFLECTION  ✦</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── ZONE 3: AI REFLECTION CARD ── */}
        {journal.status === 'failed' || !reflection ? (
          <View style={styles.aiCard}>
            <Text style={styles.aiCardTitle}>Reflection unavailable</Text>
            <Text style={styles.aiBodyText}>
              Chronicle couldn&apos;t generate a reflection for this entry. Your recording and
              transcript are still saved.
            </Text>
          </View>
        ) : (
          <View style={styles.aiCard}>
            <Text style={styles.aiCardTitle}>{reflection.title}</Text>

            {reflection.body.map((paragraph, i) => (
              <ReflectionParagraph key={i} text={paragraph} highlight={reflection.highlight_word} />
            ))}

            <View style={styles.audioActionRow}>
              <TouchableOpacity
                style={styles.listenButton}
                activeOpacity={0.8}
                onPress={handleListen}
                disabled={speaking}
              >
                {speaking ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Text style={styles.listenIcon}>🔊</Text>
                    <Text style={styles.listenText}>LISTEN TO RESPONSE</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── ZONE 4: BOTTOM CONTROLS ── */}
        <View style={styles.bottomActionRow}>
          <TouchableOpacity
            style={styles.saveButton}
            activeOpacity={0.8}
            onPress={() => router.replace('/dashboard')}
          >
            <Text style={styles.saveButtonText}>Done</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshButton} activeOpacity={0.8} onPress={loadJournal}>
            <Text style={styles.refreshIcon}>⟳</Text>
          </TouchableOpacity>
        </View>

        {/* Continue Conversation Text Link */}
        <TouchableOpacity
          style={styles.continueLink}
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: '/aiLiveConversation', params: { id: journal._id } })}
        >
          <Text style={styles.continueLinkText}>CONTINUE CONVERSATION  →</Text>
        </TouchableOpacity>

        {/* Extra cushion space at the end of scroll area */}
        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ── GLOBAL BOTTOM NAVIGATION BAR ── */}
      <View style={styles.bottomNavWrapper}>
        <BottomNav />
      </View>

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
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  errorText: {
    color: '#c8c8d8',
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: GOLD,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#000',
    fontWeight: '700',
    letterSpacing: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
  },

  // Zone 1: Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 16,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222235',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    fontSize: 18,
    color: '#fff',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'serif',
    lineHeight: 24,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerDate: {
    color: '#777785',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },

  // Zone 2: Quote Box Styles
  quoteWrapper: {
    marginTop: 16,
    marginBottom: 24,
    position: 'relative',
  },
  quoteCard: {
    backgroundColor: '#131326',
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: '#1e1e36',
  },
  quoteText: {
    color: '#a0a0b5',
    fontSize: 15,
    fontStyle: 'italic',
    fontFamily: 'serif',
    lineHeight: 26,
  },
  quoteBadge: {
    position: 'absolute',
    top: -14,
    left: -6,
    zIndex: 10,
    backgroundColor: '#22223a',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteBadgeText: {
    color: '#b592ff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Divider Styles
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#222235',
  },
  dividerText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },

  // Zone 3: AI Reflection Card Styles
  aiCard: {
    backgroundColor: '#151523',
    borderRadius: 32,
    padding: 26,
    borderWidth: 1,
    borderColor: '#26263c',
    marginBottom: 28,
  },
  aiCardTitle: {
    color: GOLD,
    fontSize: 22,
    fontWeight: '600',
    fontFamily: 'serif',
    marginBottom: 22,
    lineHeight: 28,
  },
  aiBodyText: {
    color: '#b8b8cc',
    fontSize: 15,
    lineHeight: 25,
    marginBottom: 16,
  },
  aiHighlightText: {
    color: GOLD,
    fontWeight: '700',
  },
  audioActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 14,
  },
  listenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffcc00',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
    minWidth: 60,
    justifyContent: 'center',
  },
  listenIcon: {
    fontSize: 14,
    color: '#000',
  },
  listenText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Zone 4: Bottom Interaction Button Styles
  bottomActionRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#ffcc00',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  refreshButton: {
    width: 60,
    backgroundColor: '#17172b',
    borderWidth: 1,
    borderColor: '#26263c',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    color: '#fff',
    fontSize: 20,
  },
  continueLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  continueLinkText: {
    color: '#6c6c80',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
