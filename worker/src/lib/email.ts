const FROM = 'alerts@dontgetflocked.com';
const TO = 'flockhopper@proton.me';

export interface SuccessReport {
  featureCount: number;
  previousCount: number | null;
  updatedAt: string;
  source: string;
  endpoint: string;
  r2Key: string;
  sizeBytes: number;
}

export interface FailureReport {
  fetcherName: string;
  error: string;
  retriesAttempted: number;
  maxRetries: number;
  lastUpdated: string | null;
  now: string;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function buildMime(subject: string, body: string): string {
  // Cloudflare's send_email binding (and RFC 5322) require a Message-ID and Date
  // header — without Message-ID the send fails with "invalid message-id" and the
  // alert never arrives. Message-ID must be globally unique; domain matches sender.
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@dontgetflocked.com>`;
  const date = new Date().toUTCString();

  return [
    `From: ${FROM}`,
    `To: ${TO}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');
}

export function buildSuccessMime(report: SuccessReport): string {
  const count = formatNumber(report.featureCount);
  let deltaStr = '';
  if (report.previousCount !== null) {
    const delta = report.featureCount - report.previousCount;
    const sign = delta >= 0 ? '+' : '';
    deltaStr = ` (${sign}${formatNumber(delta)})`;
  }

  const subject = `FlockHopper Data Updated: ${count} cameras${deltaStr}`;
  const body = [
    'FlockHopper Data Pipeline - Success',
    '',
    `Updated:    ${report.updatedAt}`,
    `Cameras:    ${count}${deltaStr ? ` (${deltaStr.trim().slice(1, -1)} since last update)` : ''}`,
    `Source:     ${report.source}`,
    `Endpoint:   ${report.endpoint}`,
    `R2 Key:     ${report.r2Key}`,
    `Size:       ${formatBytes(report.sizeBytes)}`,
    '',
    'All fetchers completed successfully.',
  ].join('\n');

  return buildMime(subject, body);
}

export interface BlockedReport {
  fetcherName: string;
  newCount: number;
  previousCount: number;
  deltaPct: number; // signed fraction, e.g. -0.4 means -40%
  limitPct: number; // fraction, e.g. 0.05 means ±5%
  now: string;
}

export function buildBlockedMime(report: BlockedReport): string {
  const sign = report.deltaPct >= 0 ? '+' : '';
  const deltaStr = `${sign}${(report.deltaPct * 100).toFixed(1)}%`;
  const limitStr = `±${(report.limitPct * 100).toFixed(1)}%`;

  const subject = `FlockHopper Data BLOCKED: count moved ${deltaStr} (R2 NOT updated)`;
  const body = [
    'FlockHopper Data Pipeline - UPDATE BLOCKED BY SAFETY GUARD',
    '',
    `Fetcher:        ${report.fetcherName}`,
    `New count:      ${formatNumber(report.newCount)}`,
    `Previous count: ${formatNumber(report.previousCount)}`,
    `Change:         ${deltaStr} (allowed ${limitStr})`,
    `Checked At:     ${report.now}`,
    '',
    'The fetch succeeded but the camera count changed more than the allowed',
    'threshold, so R2 was NOT overwritten and the site still serves the previous',
    'dataset. This usually means a partial Overpass failure — or a genuine large',
    'change in the network.',
    '',
    'If the new count is correct, re-run with force to accept it:',
    'POST https://data.dontgetflocked.com/trigger?force=true  (Authorization: Bearer <secret>)',
  ].join('\n');

  return buildMime(subject, body);
}

export function buildFailureMime(report: FailureReport): string {
  const subject = `FlockHopper Data FAILED: ${report.fetcherName} fetcher error`;
  const stale = report.lastUpdated ?? 'unknown';

  const body = [
    'FlockHopper Data Pipeline - FAILURE',
    '',
    `Fetcher:        ${report.fetcherName}`,
    `Error:          ${report.error}`,
    `Retries:        ${report.retriesAttempted}/${report.maxRetries} exhausted`,
    `Stale Since:    ${stale}`,
    `Checked At:     ${report.now}`,
    '',
    'Action required: Check Overpass API status or trigger manual refresh.',
    'POST https://data.dontgetflocked.com/trigger with Authorization: Bearer <secret>',
  ].join('\n');

  return buildMime(subject, body);
}
