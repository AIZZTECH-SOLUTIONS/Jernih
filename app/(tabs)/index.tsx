import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SymbolView } from 'expo-symbols';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';

import { ForwardGuide } from '@/components/ForwardGuide';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MetaRow } from '@/components/ui/MetaRow';
import { QualityBadge } from '@/components/ui/QualityBadge';
import { Screen } from '@/components/ui/Screen';
import { StepIndicator, StepLabel } from '@/components/ui/StepIndicator';
import { Theme, type FlowStep } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { analyzeMedia, analyzeOptimized, type MediaAnalysis } from '@/lib/analyzer';
import { getMediaInfo, optimizeImage, optimizeVideo, type MediaInfo } from '@/lib/encoder';
import {
  formatBytes,
  formatDimensions,
  formatDuration,
  formatReduction,
} from '@/lib/format';
import { pickMedia, saveToPhotos, shareToWhatsAppChat } from '@/lib/media';
import { recordJob, uploadProcessed } from '@/lib/supabase';

const HOW_IT_WORKS = [
  { icon: 'wand.and.stars', title: 'Optimize', detail: 'Tune it to stay sharp on Status' },
  { icon: 'bubble.left', title: 'Send to chat', detail: 'Share to yourself or a contact first' },
  { icon: 'arrowshape.turn.up.forward', title: 'Forward', detail: 'Forward the media to My Status' },
] as const;

export default function HomeScreen() {
  const { user } = useAuth();
  const { videoPreset, codec, cloudBackup } = useSettings();

  const [step, setStep] = useState<FlowStep>('pick');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [original, setOriginal] = useState<MediaInfo | null>(null);
  const [output, setOutput] = useState<MediaInfo | null>(null);
  const [outputUri, setOutputUri] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MediaAnalysis | null>(null);
  const [outputAnalysis, setOutputAnalysis] = useState<MediaAnalysis | null>(null);
  const [skippedEncode, setSkippedEncode] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const previewUri = outputUri ?? original?.uri ?? null;
  const isVideo = (output ?? original)?.mediaType === 'video';

  const player = useVideoPlayer(isVideo && previewUri ? previewUri : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const handlePick = useCallback(async () => {
    setError(null);
    setOutput(null);
    setOutputUri(null);
    setOutputAnalysis(null);
    setSkippedEncode(false);

    try {
      const picked = await pickMedia();
      if (!picked) return;

      const info = await getMediaInfo(picked.uri, picked.mediaType);
      const result = analyzeMedia(info);

      setOriginal(info);
      setAnalysis(result);
      setStep('review');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pick media.');
    }
  }, []);

  const handleOptimize = useCallback(async () => {
    if (!original) return;

    setStep('optimize');
    setProgress(0);
    setError(null);

    try {
      const result =
        original.mediaType === 'video'
          ? await optimizeVideo(original.uri, videoPreset, codec, setProgress)
          : await optimizeImage(original.uri);

      setOutputUri(result.uri);
      setOutput(result.info);
      setSkippedEncode(result.skipped);
      setOutputAnalysis(analyzeOptimized(result.info));
      setStep('share');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (user && cloudBackup) {
        const jobId = randomUUID();
        try {
          const outputPath = await uploadProcessed(user.id, jobId, result.uri, original.mediaType);
          await recordJob({
            user_id: user.id,
            media_type: original.mediaType,
            original_bytes: original.sizeBytes,
            output_bytes: result.info.sizeBytes,
            preset: original.mediaType === 'video' ? videoPreset : 'photo',
            codec: original.mediaType === 'video' ? codec : 'jpeg',
            output_path: outputPath,
          });
        } catch {
          // Cloud backup is optional.
        }
      }
    } catch (err) {
      setStep('review');
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [original, videoPreset, codec, user, cloudBackup]);

  const handleShareToChat = useCallback(async () => {
    if (!outputUri || !original) return;
    setBusyAction('share');
    try {
      await shareToWhatsAppChat(outputUri, original.mediaType);
      setStep('forward');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      Alert.alert('Share failed', err instanceof Error ? err.message : 'Could not open share sheet.');
    } finally {
      setBusyAction(null);
    }
  }, [outputUri, original]);

  const handleSave = useCallback(async () => {
    if (!outputUri || !original) return;
    setBusyAction('save');
    try {
      await saveToPhotos(outputUri, original.mediaType);
      Alert.alert('Saved', 'Optimized file saved to your photo library.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusyAction(null);
    }
  }, [outputUri, original]);

  const handleComplete = useCallback(async () => {
    setStep('done');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleReset = useCallback(() => {
    setStep('pick');
    setOriginal(null);
    setOutput(null);
    setOutputUri(null);
    setAnalysis(null);
    setOutputAnalysis(null);
    setSkippedEncode(false);
    setProgress(0);
    setError(null);
  }, []);

  const issueList = useMemo(() => analysis?.issues ?? [], [analysis]);

  const showProgressHeader = step !== 'pick' && step !== 'done';

  return (
    <Screen>
      {step === 'pick' ? (
        <View style={styles.landing}>
          <View style={styles.landingHeader}>
            <Text style={styles.brand}>Jernih</Text>
            <Text style={styles.brandSub}>Keep your WhatsApp status sharp.</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.dropZone, pressed && styles.dropZonePressed]}
            onPress={handlePick}>
            <View style={styles.dropIcon}>
              <SymbolView
                name={{ ios: 'photo.on.rectangle.angled', android: 'add_photo_alternate', web: 'add_photo_alternate' }}
                size={32}
                tintColor={Theme.colors.white}
              />
            </View>
            <Text style={styles.dropTitle}>Select photo or video</Text>
            <Text style={styles.dropHint}>Tap to choose from your library</Text>
          </Pressable>

          <Card style={styles.stepsCard}>
            {HOW_IT_WORKS.map((item, i) => (
              <View key={item.title}>
                <View style={styles.stepItem}>
                  <View style={styles.stepIndex}>
                    <Text style={styles.stepIndexText}>{i + 1}</Text>
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepTitle}>{item.title}</Text>
                    <Text style={styles.stepDetail}>{item.detail}</Text>
                  </View>
                  <SymbolView
                    name={{ ios: item.icon, android: 'circle', web: 'circle' }}
                    size={18}
                    tintColor={Theme.colors.textTertiary}
                  />
                </View>
                {i < HOW_IT_WORKS.length - 1 && <View style={styles.stepDivider} />}
              </View>
            ))}
          </Card>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : (
        <>
          {showProgressHeader && (
            <View style={styles.flowHeader}>
              <StepIndicator current={step} />
              <StepLabel current={step} />
            </View>
          )}

          {original && step !== 'done' && (
            <Card style={styles.previewCard}>
              {isVideo && previewUri ? (
                <VideoView style={styles.preview} player={player} contentFit="cover" nativeControls={false} />
              ) : previewUri ? (
                <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
              ) : null}
            </Card>
          )}

          {step === 'review' && original && analysis && (
            <View style={styles.section}>
              <QualityBadge score={analysis.score} label={analysis.label} />

              <Card style={styles.statsCard}>
                <MetaRow label="Size" value={formatBytes(original.sizeBytes)} />
                <View style={styles.divider} />
                <MetaRow label="Dimensions" value={formatDimensions(original.width, original.height)} />
                {original.mediaType === 'video' && (
                  <>
                    <View style={styles.divider} />
                    <MetaRow label="Duration" value={formatDuration(original.duration)} />
                  </>
                )}
                {analysis.estimatedOutputBytes && (
                  <>
                    <View style={styles.divider} />
                    <MetaRow
                      label="Estimated output"
                      value={formatBytes(analysis.estimatedOutputBytes)}
                      highlight
                    />
                  </>
                )}
              </Card>

              {issueList.length > 0 && (
                <Card style={styles.issuesCard}>
                  <Text style={styles.sectionLabel}>Issues detected</Text>
                  {issueList.map((issue) => (
                    <View key={issue.code} style={styles.issueRow}>
                      <View
                        style={[styles.issueDot, issue.severity === 'critical' && styles.issueCritical]}
                      />
                      <Text style={styles.issueText}>{issue.message}</Text>
                    </View>
                  ))}
                </Card>
              )}

              <View style={styles.actions}>
                <Button
                  label={analysis.needsOptimization ? 'Optimize for Status' : 'Prepare for Status'}
                  onPress={handleOptimize}
                />
                <Button label="Choose different file" variant="ghost" onPress={handleReset} />
              </View>
            </View>
          )}

          {step === 'optimize' && (
            <View style={styles.progressWrap}>
              <ActivityIndicator color={Theme.colors.white} size="large" />
              <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
              <Text style={styles.progressLabel}>Optimizing</Text>
            </View>
          )}

          {step === 'share' && original && output && outputAnalysis && (
            <View style={styles.section}>
              <QualityBadge score={outputAnalysis.score} label={outputAnalysis.label} />

              {skippedEncode && (
                <Text style={styles.skipNote}>Already great quality — ready to share.</Text>
              )}

              <Card style={styles.statsCard}>
                <MetaRow
                  label="Before"
                  value={`${formatBytes(original.sizeBytes)} · ${formatDimensions(original.width, original.height)}`}
                />
                <View style={styles.divider} />
                <MetaRow
                  label="After"
                  value={`${formatBytes(output.sizeBytes)} · ${formatDimensions(output.width, output.height)}`}
                  highlight
                />
                <View style={styles.divider} />
                <MetaRow label="Saved" value={formatReduction(original.sizeBytes, output.sizeBytes)} highlight />
              </Card>

              <Card style={styles.noticeCard}>
                <SymbolView
                  name={{ ios: 'exclamationmark.circle', android: 'info', web: 'info' }}
                  size={18}
                  tintColor={Theme.colors.white}
                />
                <Text style={styles.noticeText}>
                  Don&apos;t post to Status directly. Send to a chat first — you&apos;ll Forward it next.
                </Text>
              </Card>

              <View style={styles.actions}>
                <Button
                  label="Send to WhatsApp Chat"
                  onPress={handleShareToChat}
                  loading={busyAction === 'share'}
                />
                <Button
                  label="Save to Photos"
                  variant="secondary"
                  onPress={handleSave}
                  loading={busyAction === 'save'}
                />
              </View>
            </View>
          )}

          {step === 'forward' && (
            <View style={styles.section}>
              <ForwardGuide />
              <View style={styles.actions}>
                <Button label="I've posted to Status" onPress={handleComplete} />
                <Button
                  label="Re-share to chat"
                  variant="secondary"
                  onPress={handleShareToChat}
                  loading={busyAction === 'share'}
                />
              </View>
            </View>
          )}

          {step === 'done' && (
            <View style={styles.doneWrap}>
              <View style={styles.doneIcon}>
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={36}
                  tintColor={Theme.colors.black}
                />
              </View>
              <Text style={styles.doneTitle}>All done</Text>
              <Text style={styles.doneText}>
                Shared via the Forward method so your status stays sharp.
              </Text>
              <Button label="Optimize another" onPress={handleReset} style={styles.doneButton} />
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Landing
  landing: {
    gap: Theme.spacing.xl,
    paddingTop: Theme.spacing.md,
  },
  landingHeader: {
    gap: Theme.spacing.xs,
  },
  brand: {
    ...Theme.typography.largeTitle,
    color: Theme.colors.white,
  },
  brandSub: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
  },
  dropZone: {
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.borderLight,
    borderRadius: Theme.radius.xl,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xxl,
  },
  dropZonePressed: {
    backgroundColor: Theme.colors.surfaceElevated,
  },
  dropIcon: {
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.radius.full,
    height: 72,
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
    width: 72,
  },
  dropTitle: {
    ...Theme.typography.title3,
    color: Theme.colors.white,
  },
  dropHint: {
    ...Theme.typography.subhead,
    color: Theme.colors.textTertiary,
  },
  stepsCard: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xs,
  },
  stepItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  stepIndex: {
    alignItems: 'center',
    borderColor: Theme.colors.borderLight,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepIndexText: {
    ...Theme.typography.footnote,
    color: Theme.colors.white,
    fontWeight: '600',
  },
  stepBody: {
    flex: 1,
    gap: 1,
  },
  stepTitle: {
    ...Theme.typography.callout,
    color: Theme.colors.white,
    fontWeight: '600',
  },
  stepDetail: {
    ...Theme.typography.footnote,
    color: Theme.colors.textSecondary,
  },
  stepDivider: {
    backgroundColor: Theme.colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 28 + Theme.spacing.md,
  },

  // Flow
  flowHeader: {
    marginBottom: Theme.spacing.lg,
  },
  section: {
    gap: Theme.spacing.lg,
  },
  actions: {
    gap: Theme.spacing.sm,
  },
  previewCard: {
    alignSelf: 'center',
    marginBottom: Theme.spacing.lg,
    width: '70%',
  },
  preview: {
    aspectRatio: 9 / 16,
    backgroundColor: Theme.colors.black,
    width: '100%',
  },
  statsCard: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xs,
  },
  divider: {
    backgroundColor: Theme.colors.border,
    height: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  issuesCard: {
    gap: Theme.spacing.md,
    padding: Theme.spacing.lg,
  },
  issueRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  issueDot: {
    backgroundColor: Theme.colors.textSecondary,
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    width: 6,
  },
  issueCritical: {
    backgroundColor: Theme.colors.white,
  },
  issueText: {
    ...Theme.typography.subhead,
    color: Theme.colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  noticeCard: {
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceElevated,
    flexDirection: 'row',
    gap: Theme.spacing.md,
    padding: Theme.spacing.lg,
  },
  noticeText: {
    ...Theme.typography.subhead,
    color: Theme.colors.white,
    flex: 1,
    lineHeight: 20,
  },

  // Progress
  progressWrap: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xxl,
  },
  progressPercent: {
    ...Theme.typography.largeTitle,
    color: Theme.colors.white,
    marginTop: Theme.spacing.md,
  },
  progressLabel: {
    ...Theme.typography.subhead,
    color: Theme.colors.textSecondary,
  },
  skipNote: {
    ...Theme.typography.footnote,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },

  // Done
  doneWrap: {
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingTop: Theme.spacing.xxl,
  },
  doneIcon: {
    alignItems: 'center',
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radius.full,
    height: 72,
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
    width: 72,
  },
  doneTitle: {
    ...Theme.typography.title1,
    color: Theme.colors.white,
  },
  doneText: {
    ...Theme.typography.subhead,
    color: Theme.colors.textSecondary,
    lineHeight: 21,
    paddingHorizontal: Theme.spacing.lg,
    textAlign: 'center',
  },
  doneButton: {
    alignSelf: 'stretch',
    marginTop: Theme.spacing.lg,
  },

  error: {
    ...Theme.typography.footnote,
    color: Theme.colors.danger,
    marginTop: Theme.spacing.md,
    textAlign: 'center',
  },
});
