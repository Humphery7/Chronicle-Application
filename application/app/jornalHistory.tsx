import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ApiError, JournalSummary, Mood, journalsApi } from '@/lib/api';
import BottomNav from '@/components/chronicle/BottomNav';

const GOLD = '#d4a017';
const PAGE_BG = '#0f0f1c';
const CARD_BG = '#131326';
const INPUT_BG = '#16162a';
const MUTED_TEXT = '#6c6c80';

const MOOD_COLOR: Record<Mood, string> = {
    Calm: '#a29bfe',
    Happy: '#e2b33c',
    Frustrated: '#ff7675',
    Anxious: '#81ecec',
    Low: '#74b9ff',
};

type FilterId = 'all' | 'this_week' | Mood;

function formatCardDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'long' });
}

function formatDuration(seconds: number): string {
    const total = Math.round(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export default function JournalHistoryScreen() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterId>('all');
    const [entries, setEntries] = useState<JournalSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadEntries = useCallback(async () => {
        try {
            setError(null);
            const data = await journalsApi.list();
            setEntries(data);
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Could not load your journal history.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadEntries();
        }, [loadEntries])
    );

    const moodsPresent = useMemo(
        () => Array.from(new Set(entries.map((e) => e.mood))),
        [entries]
    );

    const categories: { id: FilterId; label: string }[] = [
        { id: 'all', label: 'ALL' },
        { id: 'this_week', label: 'THIS WEEK' },
        ...moodsPresent.map((m) => ({ id: m as FilterId, label: m.toUpperCase() })),
    ];

    const filteredEntries = useMemo(() => {
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return entries.filter((entry) => {
            if (activeFilter === 'this_week' && new Date(entry.created_at).getTime() < oneWeekAgo) {
                return false;
            }
            if (activeFilter !== 'all' && activeFilter !== 'this_week' && entry.mood !== activeFilter) {
                return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                const haystack = `${entry.title ?? ''} ${entry.preview}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [entries, activeFilter, searchQuery]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" />

            {/* ── HEADER ── */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarIcon}>👤</Text>
                    </View>
                    <Text style={styles.headerGreeting}>Your Journal</Text>
                </View>
            </View>

            {/* ── SEARCH INPUT CONTROL BAR ── */}
            <View style={styles.searchBarContainer}>
                <View style={styles.inputWrapper}>
                    <Text style={styles.lensSymbol}>🔍</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Search your reflections"
                        placeholderTextColor="#4e4e64"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
                <TouchableOpacity
                    style={styles.micQuickButton}
                    activeOpacity={0.8}
                    onPress={() => router.push({ pathname: '/activeRecording', params: { mood: 'Calm' } })}
                >
                    <Text style={styles.micQuickIcon}>🎙</Text>
                </TouchableOpacity>
            </View>

            {/* ── FILTER CHIPS ROW ── */}
            <View style={styles.filterRowOuter}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterScrollPadding}
                >
                    {categories.map((cat) => (
                        <TouchableOpacity
                            key={cat.id}
                            style={[styles.filterChip, activeFilter === cat.id && styles.filterChipActive]}
                            onPress={() => setActiveFilter(cat.id)}
                            activeOpacity={0.7}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    activeFilter === cat.id && styles.filterChipTextActive,
                                ]}
                            >
                                {cat.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* ── ENTRIES SCROLL CANVAS ── */}
            {loading ? (
                <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
            ) : error ? (
                <Text style={styles.emptyText}>{error}</Text>
            ) : (
                <ScrollView
                    style={styles.cardCanvas}
                    contentContainerStyle={styles.canvasPaddingBottom}
                    showsVerticalScrollIndicator={false}
                >
                    {filteredEntries.length === 0 ? (
                        <Text style={styles.emptyText}>
                            {entries.length === 0
                                ? 'No journal entries yet. Tap the mic to record your first one.'
                                : 'No entries match your search or filter.'}
                        </Text>
                    ) : (
                        filteredEntries.map((entry) => {
                            const color = MOOD_COLOR[entry.mood] ?? GOLD;
                            return (
                                <TouchableOpacity
                                    key={entry._id}
                                    style={styles.entryCard}
                                    onPress={() => router.push({ pathname: '/aiReflection', params: { id: entry._id } })}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardDateText}>{formatCardDate(entry.created_at)}</Text>
                                        <View style={[styles.emotionBadge, { backgroundColor: `${color}15` }]}>
                                            <View style={[styles.badgeDot, { backgroundColor: color }]} />
                                            <Text style={[styles.badgeText, { color }]}>{entry.mood.toUpperCase()}</Text>
                                        </View>
                                    </View>

                                    <Text style={styles.previewText} numberOfLines={2}>
                                        {entry.status === 'processing'
                                            ? 'Still processing this entry…'
                                            : entry.status === 'failed'
                                            ? 'This entry could not be processed.'
                                            : entry.preview}
                                    </Text>

                                    <View style={styles.cardFooter}>
                                        <View>
                                            <Text style={styles.metaLabel}>DURATION</Text>
                                            <Text style={styles.metaValue}>{formatDuration(entry.duration_seconds)}</Text>
                                        </View>

                                        <View style={styles.playButtonCircle}>
                                            <Text style={styles.playIconSymbol}>▶</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>
            )}

            {/* ── FLOATING ACTION BUTTON (FAB) ── */}
            <TouchableOpacity
                style={styles.floatingActionButton}
                onPress={() => router.push({ pathname: '/activeRecording', params: { mood: 'Calm' } })}
                activeOpacity={0.85}
            >
                <Text style={styles.fabPlusSymbol}>+</Text>
            </TouchableOpacity>

            <BottomNav active="HISTORY" />

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

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 12,
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#222235',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarIcon: {
        fontSize: 16,
    },
    headerGreeting: {
        color: '#ffffff',
        fontSize: 20,
        fontFamily: 'serif',
    },

    // Search Bar
    searchBarContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
        alignItems: 'center',
        marginBottom: 20,
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: INPUT_BG,
        height: 48,
        borderRadius: 24,
        paddingHorizontal: 16,
        gap: 10,
        borderWidth: 1,
        borderColor: '#1d1d36',
    },
    lensSymbol: {
        fontSize: 14,
        color: '#4e4e64',
    },
    textInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 14,
    },
    micQuickButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#ffcc00',
        alignItems: 'center',
        justifyContent: 'center',
    },
    micQuickIcon: {
        fontSize: 18,
        color: '#000000',
    },

    // Filter Row
    filterRowOuter: {
        marginBottom: 20,
        height: 36,
    },
    filterScrollPadding: {
        paddingHorizontal: 20,
        gap: 10,
    },
    filterChip: {
        backgroundColor: '#1d1d33',
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 18,
        justifyContent: 'center',
        marginRight: 10,
    },
    filterChipActive: {
        backgroundColor: '#6c5ce7',
    },
    filterChipText: {
        color: '#8e8ea8',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    filterChipTextActive: {
        color: '#ffffff',
    },

    // Card List Canvas
    cardCanvas: {
        flex: 1,
        paddingHorizontal: 20,
    },
    canvasPaddingBottom: {
        paddingBottom: 140,
    },
    emptyText: {
        color: '#777',
        fontSize: 13,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 32,
        paddingHorizontal: 30,
        lineHeight: 20,
    },
    entryCard: {
        backgroundColor: CARD_BG,
        borderRadius: 28,
        padding: 22,
        borderWidth: 1,
        borderColor: '#1e1e38',
        marginBottom: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    cardDateText: {
        color: '#ffffff',
        fontSize: 18,
        fontFamily: 'serif',
        fontStyle: 'italic',
    },
    emotionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
        gap: 6,
    },
    badgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    previewText: {
        color: '#9ba0b8',
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 20,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    metaLabel: {
        color: MUTED_TEXT,
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 2,
    },
    metaValue: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    playButtonCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#22223a',
        borderWidth: 1,
        borderColor: '#313152',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playIconSymbol: {
        color: GOLD,
        fontSize: 14,
        marginLeft: 2,
    },

    // Floating Action Button (FAB)
    floatingActionButton: {
        position: 'absolute',
        bottom: 90,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#ffcc00',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    fabPlusSymbol: {
        color: '#000000',
        fontSize: 28,
        fontWeight: '300',
        marginTop: -2,
    },
});
