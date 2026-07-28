export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatReduction(original: number, output: number): string {
  if (original <= 0) return '0%';
  const pct = ((original - output) / original) * 100;
  if (pct <= 0) return 'No change';
  return `−${pct.toFixed(0)}%`;
}

export function formatBitrate(bps?: number): string {
  if (!bps) return '—';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
}

export function formatDimensions(width?: number, height?: number): string {
  if (!width || !height) return '—';
  return `${width} × ${height}`;
}

export function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}
