import type { MediaInfo } from './encoder';
import { WHATSAPP_LIMITS } from './whatsapp';

export type AnalysisIssue = {
  code: string;
  severity: 'warning' | 'critical';
  message: string;
};

export type MediaAnalysis = {
  score: number;
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  issues: AnalysisIssue[];
  needsOptimization: boolean;
  estimatedOutputBytes?: number;
};

function estimateVideoBitrate(sizeBytes: number, durationSec: number): number {
  if (durationSec <= 0) return 0;
  return Math.round((sizeBytes * 8) / durationSec);
}

export function analyzeMedia(info: MediaInfo): MediaAnalysis {
  const issues: AnalysisIssue[] = [];

  if (info.mediaType === 'video') {
    const bitrate = estimateVideoBitrate(info.sizeBytes, info.duration ?? 0);
    const longest = Math.max(info.width ?? 0, info.height ?? 0);

    if ((info.duration ?? 0) > WHATSAPP_LIMITS.maxVideoDurationSec) {
      issues.push({
        code: 'duration_critical',
        severity: 'critical',
        message: `Video exceeds ${WHATSAPP_LIMITS.maxVideoDurationSec}s WhatsApp limit.`,
      });
    } else if ((info.duration ?? 0) > WHATSAPP_LIMITS.recommendedVideoDurationSec) {
      issues.push({
        code: 'duration_warning',
        severity: 'warning',
        message: `Over ${WHATSAPP_LIMITS.recommendedVideoDurationSec}s — quality may drop on Status.`,
      });
    }

    if (bitrate > WHATSAPP_LIMITS.maxVideoBitrate) {
      issues.push({
        code: 'bitrate_high',
        severity: 'critical',
        message: 'Very heavy file — needs optimizing to stay sharp.',
      });
    } else if (bitrate > WHATSAPP_LIMITS.targetVideoBitrate * 1.15) {
      issues.push({
        code: 'bitrate_warning',
        severity: 'warning',
        message: 'Slightly heavy — optimizing recommended.',
      });
    }

    if (longest > WHATSAPP_LIMITS.maxVideoDimension) {
      issues.push({
        code: 'resolution_high',
        severity: 'warning',
        message: `Resolution ${info.width}×${info.height} is larger than needed.`,
      });
    }

    if (info.sizeBytes > WHATSAPP_LIMITS.maxVideoSizeBytes) {
      issues.push({
        code: 'size_critical',
        severity: 'critical',
        message: 'Video exceeds the WhatsApp media-message limit.',
      });
    }

  } else {
    const longest = Math.max(info.width ?? 0, info.height ?? 0);
    if (longest > WHATSAPP_LIMITS.maxImageEdge * 1.2) {
      issues.push({
        code: 'image_large',
        severity: 'warning',
        message: `Image ${info.width}×${info.height} is larger than needed for Status.`,
      });
    }
    if (info.sizeBytes > 5 * 1024 * 1024) {
      issues.push({
        code: 'image_size',
        severity: 'warning',
        message: 'Large photo — optimizing recommended.',
      });
    }
  }

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  let score = 100 - criticalCount * 35 - warningCount * 15;
  score = Math.max(0, Math.min(100, score));

  const label =
    score >= 85 ? 'Excellent' : score >= 65 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';

  const needsOptimization =
    criticalCount > 0 ||
    warningCount > 0 ||
    (info.mediaType === 'video' &&
      estimateVideoBitrate(info.sizeBytes, info.duration ?? 0) >
        WHATSAPP_LIMITS.targetVideoBitrate);

  const estimatedOutputBytes =
    info.mediaType === 'video' && info.duration
      ? Math.round(
          Math.min(
            info.sizeBytes,
            WHATSAPP_LIMITS.targetVideoSizeBytes,
          ),
        )
      : Math.round(info.sizeBytes * 0.4);

  return {
    score,
    label,
    issues,
    needsOptimization,
    estimatedOutputBytes,
  };
}

export function analyzeOptimized(info: MediaInfo): MediaAnalysis {
  const base = analyzeMedia(info);
  return {
    ...base,
    score: Math.max(base.score, 90),
    label: base.issues.length === 0 ? 'Excellent' : base.label,
    needsOptimization: false,
  };
}
