import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
    useAudioPlayer,
    useAudioRecorder,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    RecordingPresets,
} from 'expo-audio';
import { ApiError, Journal, Message, aiApi, journalsApi, mediaUrl } from '@/lib/api';

const GOLD = '#d4a017';
const PAGE_BG = '#0f0f1c';
const CARD_BG = '#1d1d33';
const TEXT_MUTED = '#7e7e96';

function timelineLabel(iso?: string): string {
    const date = iso ? new Date(iso) : new Date();
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
}

export default function ReflectingTogetherScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [journal, setJournal] = useState<Journal | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [inputText, setInputText] = useState('');
    const [speakingId, setSpeakingId] = useState<string | null>(null);
    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [transcribing, setTranscribing] = useState(false);

    const scrollRef = useRef<ScrollView>(null);
    const player = useAudioPlayer(null);
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

    const load = useCallback(async () => {
        if (!id) return;
        try {
            const [journalData, messagesData] = await Promise.all([
                journalsApi.get(id),
                journalsApi.listMessages(id),
            ]);
            setJournal(journalData);
            setMessages(messagesData);
        } catch (e) {
            Alert.alert('Error', e instanceof ApiError ? e.message : 'Could not load this conversation.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        // Keep the latest message in view.
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }, [messages.length]);

    const handleSendMessage = async (text: string) => {
        const content = text.trim();
        if (!content || !id || sending) return;

        setInputText('');
        setSending(true);

        // Optimistic bubble for the user's message.
        const tempId = `temp_${Date.now()}`;
        const optimistic: Message = {
            _id: tempId,
            role: 'user',
            content,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);

        try {
            const turn = await journalsApi.sendMessage(id, content);
            setMessages((prev) => [
                ...prev.filter((m) => m._id !== tempId),
                turn.user_message,
                turn.assistant_message,
            ]);
        } catch (e) {
            setMessages((prev) => prev.filter((m) => m._id !== tempId));
            setInputText(content);
            Alert.alert('Message not sent', e instanceof ApiError ? e.message : 'Please try again.');
        } finally {
            setSending(false);
        }
    };

    const handleListen = async (message: Message) => {
        if (speakingId) return;
        setSpeakingId(message._id);
        try {
            const { audio_url } = await aiApi.textToSpeech(message.content);
            const uri = mediaUrl(audio_url);
            if (uri) {
                player.replace({ uri });
                player.play();
            }
        } catch (e) {
            Alert.alert('Playback unavailable', e instanceof ApiError ? e.message : 'Please try again.');
        } finally {
            setSpeakingId(null);
        }
    };

    const handleMicPress = async () => {
        if (!isRecordingVoice) {
            try {
                const { granted } = await requestRecordingPermissionsAsync();
                if (!granted) {
                    Alert.alert('Permission needed', 'Microphone access is required to record.');
                    return;
                }
                await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
                await recorder.prepareToRecordAsync();
                recorder.record();
                setIsRecordingVoice(true);
            } catch {
                Alert.alert('Recording error', 'Could not access the microphone.');
            }
            return;
        }

        setIsRecordingVoice(false);
        setTranscribing(true);
        try {
            await recorder.stop();
            const uri = recorder.uri;
            if (uri) {
                const { text } = await aiApi.transcribe(uri);
                setInputText((prev) => (prev ? `${prev} ${text}` : text));
            }
        } catch (e) {
            Alert.alert('Transcription failed', e instanceof ApiError ? e.message : 'Please try again.');
        } finally {
            setTranscribing(false);
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

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardViewport}
            >

                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Text style={styles.backArrow}>←</Text>
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Reflecting together</Text>
                        <Text style={styles.headerSubtitle} numberOfLines={1}>
                            {journal?.title || 'ACTIVE SESSION'}
                        </Text>
                    </View>

                    <View style={styles.liveInsightsIndicator}>
                        <View style={styles.greenPulseDot} />
                        <Text style={styles.liveInsightsText}>LIVE</Text>
                    </View>
                </View>

                <ScrollView
                    ref={scrollRef}
                    style={styles.messageCanvas}
                    contentContainerStyle={styles.canvasContentPadding}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.timelineMarker}>{timelineLabel(journal?.created_at)}</Text>

                    {messages.map((msg) => {
                        if (msg.role === 'assistant') {
                            return (
                                <View key={msg._id} style={styles.aiMessageWrapper}>
                                    <Text style={styles.senderLabel}>⚜ CHRONICLE</Text>
                                    <View style={styles.aiBubble}>
                                        <Text style={styles.aiText}>{msg.content}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.speakerButton}
                                        onPress={() => handleListen(msg)}
                                        disabled={speakingId === msg._id}
                                    >
                                        {speakingId === msg._id ? (
                                            <ActivityIndicator size="small" color={TEXT_MUTED} />
                                        ) : (
                                            <Text style={styles.speakerIcon}>🔊</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            );
                        }
                        return (
                            <View key={msg._id} style={styles.userMessageWrapper}>
                                <View style={styles.userBubble}>
                                    <Text style={styles.userText}>{msg.content}</Text>
                                </View>
                            </View>
                        );
                    })}

                    {sending && (
                        <View style={styles.aiMessageWrapper}>
                            <Text style={styles.senderLabel}>⚜ CHRONICLE</Text>
                            <View style={[styles.aiBubble, styles.typingBubble]}>
                                <ActivityIndicator size="small" color={TEXT_MUTED} />
                            </View>
                        </View>
                    )}
                </ScrollView>

                <View style={styles.footerContainer}>
                    <Text style={styles.disclaimerText}>
                        THIS IS A SAFE SPACE. CHRONICLE IS NOT A THERAPIST.
                    </Text>

                    <View style={styles.inputRow}>
                        <TouchableOpacity style={styles.micInputButton} onPress={handleMicPress}>
                            {transcribing ? (
                                <ActivityIndicator size="small" color={GOLD} />
                            ) : (
                                <Text style={[styles.micInputIcon, isRecordingVoice && styles.micInputIconActive]}>
                                    🎙
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TextInput
                            style={styles.textInputField}
                            placeholder={isRecordingVoice ? 'Listening…' : 'Type a message...'}
                            placeholderTextColor="#55556d"
                            value={inputText}
                            onChangeText={setInputText}
                            onSubmitEditing={() => handleSendMessage(inputText)}
                            editable={!isRecordingVoice}
                        />

                        <TouchableOpacity
                            style={styles.sendButton}
                            onPress={() => handleSendMessage(inputText)}
                            disabled={sending || !inputText.trim()}
                        >
                            <Text style={styles.sendIcon}>➤</Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </KeyboardAvoidingView>
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
    },
    keyboardViewport: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: '#16162a',
    },
    backButton: {
        padding: 4,
    },
    backArrow: {
        color: '#ffffff',
        fontSize: 22,
    },
    headerCenter: {
        flex: 1,
        marginLeft: 16,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontFamily: 'serif',
        fontStyle: 'italic',
    },
    headerSubtitle: {
        color: TEXT_MUTED,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        marginTop: 2,
    },
    liveInsightsIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(212, 160, 23, 0.08)',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 12,
        gap: 6,
    },
    greenPulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ffcc00',
    },
    liveInsightsText: {
        color: '#e2b33c',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    messageCanvas: {
        flex: 1,
        paddingHorizontal: 16,
    },
    canvasContentPadding: {
        paddingBottom: 32,
    },
    timelineMarker: {
        color: TEXT_MUTED,
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        letterSpacing: 1.5,
        marginVertical: 24,
    },
    aiMessageWrapper: {
        alignItems: 'flex-start',
        marginBottom: 24,
        width: '85%',
    },
    senderLabel: {
        color: GOLD,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginBottom: 8,
        marginLeft: 4,
    },
    aiBubble: {
        backgroundColor: CARD_BG,
        borderRadius: 24,
        borderBottomLeftRadius: 4,
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: '#252542',
    },
    typingBubble: {
        paddingVertical: 14,
        alignItems: 'flex-start',
    },
    aiText: {
        color: '#cbcbe0',
        fontSize: 15,
        fontFamily: 'serif',
        fontStyle: 'italic',
        lineHeight: 24,
    },
    speakerButton: {
        marginTop: 8,
        marginLeft: 8,
        padding: 4,
    },
    speakerIcon: {
        fontSize: 13,
        color: TEXT_MUTED,
    },
    userMessageWrapper: {
        alignItems: 'flex-end',
        marginBottom: 24,
        width: '100%',
    },
    userBubble: {
        backgroundColor: '#261f3d',
        borderRadius: 24,
        borderBottomRightRadius: 4,
        paddingVertical: 18,
        paddingHorizontal: 20,
        maxWidth: '85%',
    },
    userText: {
        color: '#bfa7f2',
        fontSize: 15,
        lineHeight: 24,
    },
    footerContainer: {
        paddingHorizontal: 16,
        paddingBottom: Platform.OS === 'ios' ? 10 : 20,
        backgroundColor: PAGE_BG,
    },
    disclaimerText: {
        color: '#3d3d52',
        fontSize: 9,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 1,
        marginBottom: 14,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111122',
        borderRadius: 28,
        borderWidth: 1,
        borderColor: '#1d1d36',
        paddingHorizontal: 8,
        height: 56,
    },
    micInputButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    micInputIcon: {
        fontSize: 18,
        color: GOLD,
    },
    micInputIconActive: {
        color: '#ff5757',
    },
    textInputField: {
        flex: 1,
        color: '#ffffff',
        fontSize: 15,
        paddingHorizontal: 8,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: GOLD,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendIcon: {
        fontSize: 16,
        color: '#000000',
        marginLeft: -2,
    },
});
