import { SubtitleSegment } from "./types";

/**
 * Formats seconds into SRT format: HH:MM:SS,mmm
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) {
    seconds = 0;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (num: number, size: number) => {
    let s = num.toString();
    while (s.length < size) s = "0" + s;
    return s;
  };

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
}

/**
 * Formats seconds into WebVTT format: HH:MM:SS.mmm
 */
export function formatVttTime(seconds: number): string {
  return formatTime(seconds).replace(",", ".");
}

/**
 * Parses time strings like "00:01:23,456", "1:23.4", or "83.4" into seconds
 */
export function parseTimeToSeconds(timeStr: string): number {
  const cleanStr = timeStr.trim().replace(",", ".");
  const parts = cleanStr.split(":");

  if (parts.length === 1) {
    // SS or SS.ms
    return parseFloat(parts[0]) || 0;
  } else if (parts.length === 2) {
    // MM:SS or MM:SS.ms
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  } else if (parts.length === 3) {
    // HH:MM:SS or HH:MM:SS.ms
    const hrs = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hrs * 3600 + mins * 60 + secs;
  }
  return 0;
}

/**
 * Formats subtitle segments into a compliant SRT file string
 */
export function segmentsToSrt(segments: SubtitleSegment[]): string {
  return segments
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((seg, index) => {
      const startStr = formatTime(seg.start);
      const endStr = formatTime(seg.end);
      return `${index + 1}\n${startStr} --> ${endStr}\n${seg.text}\n`;
    })
    .join("\n");
}

/**
 * Formats subtitle segments into a compliant WebVTT file string
 */
export function segmentsToVtt(segments: SubtitleSegment[]): string {
  const body = segments
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((seg, index) => {
      const startStr = formatVttTime(seg.start);
      const endStr = formatVttTime(seg.end);
      return `${index + 1}\n${startStr} --> ${endStr}\n${seg.text}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

/**
 * Formats subtitle segments into plain text
 */
export function segmentsToPlainText(segments: SubtitleSegment[]): string {
  return segments
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((seg) => seg.text.trim())
    .filter(Boolean)
    .join(" ");
}
