import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Pure-Node/TypeScript media analyzers. No system tools (e.g. ffmpeg) — all
 * parsing is done directly against container/frame structures in memory.
 */

export type MediaKind = "mp4" | "webm" | "mp3" | "wav";

/** A single representative keyframe slice from a video container. */
export interface KeyframeSample {
  /** 1-based sample/block number in the container. */
  index: number;
  /** Byte offset in the source file. */
  offset: number;
  /** Byte length. */
  size: number;
  /** Presentational timestamp in seconds. */
  timestampSeconds: number;
  /** Raw container bytes of the sample. */
  data: Buffer;
}

export interface ExtractedVideoKeyframes {
  kind: "mp4" | "webm";
  durationSeconds: number;
  width: number;
  height: number;
  sampleCount: number;
  codec?: string;
  keyframeSamples: KeyframeSample[];
}

export interface ExtractedAudioSpecs {
  kind: "mp3" | "wav";
  durationSeconds: number;
  sampleRate: number;
  bitrateKbps: number;
  channels: number;
  channelTopology: string;
  codec: string;
  byteSize: number;
}

export interface MediaAnalysisPayload {
  video?: ExtractedVideoKeyframes;
  audio?: ExtractedAudioSpecs;
}

// Keep requests sane: bounded keyframe count / bytes and a full-file audio cap.
const MAX_KEYFRAMES = 3;
const MAX_KEYFRAME_BYTES = 6 * 1024 * 1024;
const MAX_INLINE_AUDIO_BYTES = 15 * 1024 * 1024;
const MAX_AUDIO_SCAN_FRAMES = 4096;

function fourcc(buf: Buffer, pos: number): string {
  return buf.toString("latin1", pos, pos + 4);
}

/** Entry point that dispatches a media file to the right analyzer. */
export async function analyzeMediaFile(filePath: string): Promise<MediaAnalysisPayload> {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await readFile(filePath);
  if (ext === ".mp4") return { video: parseMp4(buffer) ?? undefined };
  if (ext === ".webm") return { video: parseWebm(buffer) ?? undefined };
  if (ext === ".mp3") return { audio: parseMp3(buffer) ?? undefined };
  if (ext === ".wav") return { audio: parseWav(buffer) ?? undefined };
  return {};
}

// ---------------------------------------------------------------------------
// MP4 (ISO-BMFF) parsing
// ---------------------------------------------------------------------------

interface Mp4Box {
  size: number;
  type: string;
  body: number;
  end: number;
}

function readBox(buf: Buffer, pos: number): Mp4Box | null {
  if (pos + 8 > buf.length) return null;
  let size = buf.readUInt32BE(pos);
  const type = fourcc(buf, pos + 4);
  let body = pos + 8;
  if (size === 1) {
    if (pos + 16 > buf.length) return null;
    size = Number(buf.readBigUInt64BE(pos + 8));
    body = pos + 16;
  } else if (size === 0) {
    size = buf.length - pos;
  }
  if (pos + size > buf.length) return null;
  return { size, type, body, end: pos + size };
}

function forEachBox(buf: Buffer, start: number, end: number, cb: (box: Mp4Box) => void): void {
  let pos = start;
  for (;;) {
    const box = readBox(buf, pos);
    if (!box || box.end > end) break;
    cb(box);
    pos = box.end;
  }
}

function findFirstBox(buf: Buffer, start: number, end: number, type: string): Mp4Box | null {
  let found: Mp4Box | null = null;
  forEachBox(buf, start, end, (b) => {
    if (!found && b.type === type) found = b;
  });
  return found;
}

function parseMvhdDuration(buf: Buffer, body: number): { timescale: number; duration: number } {
  const version = buf.readUInt8(body);
  if (version === 1) {
    return {
      timescale: buf.readUInt32BE(body + 20),
      duration: Number(buf.readBigUInt64BE(body + 24)),
    };
  }
  return {
    timescale: buf.readUInt32BE(body + 12),
    duration: buf.readUInt32BE(body + 16),
  };
}

function parseTrackDimensions(buf: Buffer, body: number): { width: number; height: number } {
  const version = buf.readUInt8(body);
  const offset = version === 1 ? 88 : 76;
  return {
    width: buf.readUInt32BE(body + offset) >> 16,
    height: buf.readUInt32BE(body + offset + 4) >> 16,
  };
}

interface StblTables {
  stss: number[];
  stsz: number[];
  stco: number[];
  stsc: Array<{ firstChunk: number; samplesPerChunk: number }>;
}

const EMPTY_TABLES = (): StblTables => ({ stss: [], stsz: [], stco: [], stsc: [] });

function combineTables(a: StblTables, b: StblTables): StblTables {
  return {
    stss: [...a.stss, ...b.stss],
    stsz: [...a.stsz, ...b.stsz],
    stco: [...a.stco, ...b.stco],
    stsc: [...a.stsc, ...b.stsc],
  };
}

function composeTrackTables(existing: StblTables | undefined, frag: StblTables): StblTables {
  return existing ? combineTables(existing, frag) : frag;
}

/** Decodes a single leaf table box (stss/stsz/stco/co64/stsc) into tables. */
function parseLeafTable(buf: Buffer, leaf: Mp4Box): StblTables {
  const t = EMPTY_TABLES();
  const count = buf.readUInt32BE(leaf.body + 4);
  if (leaf.type === "stss") {
    for (let i = 0; i < count; i++) t.stss.push(buf.readUInt32BE(leaf.body + 8 + i * 4));
  } else if (leaf.type === "stsz") {
    const uniform = buf.readUInt32BE(leaf.body + 4);
    const n = buf.readUInt32BE(leaf.body + 8);
    if (uniform === 0) {
      for (let i = 0; i < n; i++) t.stsz.push(buf.readUInt32BE(leaf.body + 12 + i * 4));
    } else {
      t.stsz = new Array<number>(n).fill(uniform);
    }
  } else if (leaf.type === "stco") {
    for (let i = 0; i < count; i++) t.stco.push(buf.readUInt32BE(leaf.body + 8 + i * 4));
  } else if (leaf.type === "co64") {
    for (let i = 0; i < count; i++) t.stco.push(Number(buf.readBigUInt64BE(leaf.body + 8 + i * 8)));
  } else if (leaf.type === "stsc") {
    for (let i = 0; i < count; i++) {
      t.stsc.push({
        firstChunk: buf.readUInt32BE(leaf.body + 8 + i * 12),
        samplesPerChunk: buf.readUInt32BE(leaf.body + 8 + i * 12 + 4),
      });
    }
  }
  return t;
}

function samplesPerChunkAt(stsc: Array<{ firstChunk: number; samplesPerChunk: number }>, chunkNo: number): number {
  let spc = 0;
  for (const entry of stsc) {
    if (entry.firstChunk <= chunkNo) spc = entry.samplesPerChunk;
    else break;
  }
  return spc;
}

/** Resolves the byte range for a 1-based sample via chunk/size tables. */
function sampleLocation(
  tables: StblTables,
  sampleNo: number,
): { startByte: number; byteLength: number } | null {
  if (sampleNo < 1 || sampleNo > tables.stsz.length || tables.stco.length === 0) return null;

  let remaining = sampleNo;
  let chunkNo = 0;
  let indexInChunk = 0;
  for (let c = 1; c <= tables.stco.length; c++) {
    const spc = samplesPerChunkAt(tables.stsc, c);
    if (spc <= 0) return null;
    if (remaining <= spc) {
      chunkNo = c;
      indexInChunk = remaining - 1;
      break;
    }
    remaining -= spc;
  }
  if (chunkNo === 0) return null;

  const firstSampleOfChunk = sampleNo - indexInChunk;
  let offset = tables.stco[chunkNo - 1];
  for (let i = 0; i < indexInChunk; i++) offset += tables.stsz[firstSampleOfChunk - 1 + i] ?? 0;
  const byteLength = tables.stsz[sampleNo - 1] ?? 0;
  if (byteLength <= 0) return null;
  return { startByte: offset, byteLength };
}

function parseStsdCodec(buf: Buffer, body: number): { codec?: string; width?: number; height?: number } {
  const count = buf.readUInt32BE(body + 4);
  let offset = body + 8;
  let codec: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  for (let i = 0; i < count; i++) {
    if (offset + 8 > buf.length) break;
    const size = buf.readUInt32BE(offset);
    if (size < 8 || offset + size > buf.length) break;
    codec = codec ?? fourcc(buf, offset + 4);
    if (offset + 36 <= buf.length) {
      const w = buf.readUInt16BE(offset + 32);
      const h = buf.readUInt16BE(offset + 34);
      if (w > 0 && h > 0) {
        width = w;
        height = h;
      }
    }
    offset += size;
  }
  return { codec, width, height };
}

interface Mp4Track {
  width: number;
  height: number;
  hasVideo: boolean;
  timescale: number;
  duration: number;
  tables?: StblTables;
  codec?: string;
}

export function parseMp4(buf: Buffer): ExtractedVideoKeyframes | null {
  const moov = findFirstBox(buf, 0, buf.length, "moov");
  if (!moov) return null;

  let movieTimescale = 0;
  let movieDuration = 0;
  const tracks: Mp4Track[] = [];

  forEachBox(buf, moov.body, moov.end, (moovChild) => {
    if (moovChild.type === "mvhd") {
      const d = parseMvhdDuration(buf, moovChild.body);
      movieTimescale = d.timescale;
      movieDuration = d.duration;
      return;
    }
    if (moovChild.type !== "trak") return;

    const track: Mp4Track = {
      width: 0,
      height: 0,
      hasVideo: false,
      timescale: movieTimescale,
      duration: movieDuration,
    };

    forEachBox(buf, moovChild.body, moovChild.end, (trakChild) => {
      if (trakChild.type === "tkhd") {
        const dims = parseTrackDimensions(buf, trakChild.body);
        track.width = dims.width;
        track.height = dims.height;
        track.hasVideo = dims.width > 0 && dims.height > 0;
      } else if (trakChild.type === "mdia") {
        forEachBox(buf, trakChild.body, trakChild.end, (mdiaChild) => {
          if (mdiaChild.type === "mdhd") {
            const d = parseMvhdDuration(buf, mdiaChild.body);
            track.timescale = d.timescale;
            track.duration = d.duration;
          } else if (mdiaChild.type === "minf") {
            forEachBox(buf, mdiaChild.body, mdiaChild.end, (minfChild) => {
              if (minfChild.type !== "stbl") return;
              forEachBox(buf, minfChild.body, minfChild.end, (stblChild) => {
                if (stblChild.type === "stsd") {
                  const meta = parseStsdCodec(buf, stblChild.body);
                  track.codec = meta.codec;
                  if (track.width === 0 && meta.width) {
                    track.width = meta.width;
                    track.height = meta.height ?? 0;
                    track.hasVideo = track.height > 0;
                  }
                } else if (
                  stblChild.type === "stss" ||
                  stblChild.type === "stsz" ||
                  stblChild.type === "stco" ||
                  stblChild.type === "co64" ||
                  stblChild.type === "stsc"
                ) {
                  const frag = parseLeafTable(buf, stblChild);
                  track.tables = composeTrackTables(track.tables, frag);
                }
              });
            });
          }
        });
      }
    });
    tracks.push(track);
  });

  if (tracks.length === 0) return null;
  const video =
    tracks.find((t) => t.hasVideo && t.tables && t.tables.stss.length > 0) ??
    tracks.find((t) => t.hasVideo && t.tables) ??
    tracks.find((t) => t.tables) ??
    tracks[0];

  const durationSeconds = video.timescale > 0 ? video.duration / video.timescale : 0;
  const sampleCount = video.tables?.stsz.length ?? 0;

  const keyframeSamples: KeyframeSample[] = [];
  let totalBytes = 0;
  if (video.tables) {
    for (const sampleNo of video.tables.stss) {
      if (keyframeSamples.length >= MAX_KEYFRAMES) break;
      const loc = sampleLocation(video.tables, sampleNo);
      if (!loc || loc.startByte + loc.byteLength > buf.length) continue;
      if (totalBytes + loc.byteLength > MAX_KEYFRAME_BYTES) continue;
      keyframeSamples.push({
        index: sampleNo,
        offset: loc.startByte,
        size: loc.byteLength,
        timestampSeconds:
          durationSeconds > 0 && video.tables.stss.length > 0
            ? (sampleNo / video.tables.stss.length) * durationSeconds
            : 0,
        data: Buffer.from(buf.subarray(loc.startByte, loc.startByte + loc.byteLength)),
      });
      totalBytes += loc.byteLength;
    }
  }

  return {
    kind: "mp4",
    durationSeconds,
    width: video.width || 0,
    height: video.height || 0,
    sampleCount,
    codec: video.codec,
    keyframeSamples,
  };
}

// ---------------------------------------------------------------------------
// WebM / EBML parsing
// ---------------------------------------------------------------------------

const EBML_IDS = {
  segment: 0x18538067,
  info: 0x1549a966,
  timecodeScale: 0x2ad7b1,
  duration: 0x4489,
  tracks: 0x1654ae6b,
  trackEntry: 0xae,
  trackType: 0x83,
  codecId: 0x86,
  video: 0xe0,
  pixelWidth: 0xb0,
  pixelHeight: 0xba,
  cluster: 0x1f43b675,
  timecode: 0xe7,
  simpleBlock: 0xa3,
} as const;

function readVintLength(buf: Buffer, pos: number): number {
  const first = buf[pos];
  for (let i = 0; i < 8; i++) {
    if (first & (0x80 >> i)) return i + 1;
  }
  return 1;
}

function readEbmlId(buf: Buffer, pos: number): { id: number; size: number } {
  const len = readVintLength(buf, pos);
  let id = 0;
  for (let i = 0; i < len; i++) id = id * 256 + buf[pos + i];
  return { id, size: len };
}

function readEbmlSize(buf: Buffer, pos: number): { value: number; size: number } {
  const len = readVintLength(buf, pos);
  let value = buf[pos] & ((1 << (8 - len)) - 1);
  for (let i = 1; i < len; i++) value = value * 256 + buf[pos + i];
  return { value, size: len };
}

interface EbmlElement {
  id: number;
  dataOffset: number;
  size: number;
  end: number;
}

function readElement(buf: Buffer, pos: number): EbmlElement | null {
  if (pos >= buf.length) return null;
  const id = readEbmlId(buf, pos);
  const s = readEbmlSize(buf, pos + id.size);
  const dataOffset = pos + id.size + s.size;
  if (id.size <= 0 || s.size <= 0) return null;
  if (dataOffset + s.value > buf.length) return null;
  return { id: id.id, dataOffset, size: s.value, end: dataOffset + s.value };
}

function readUInt(buf: Buffer, pos: number, end: number): number {
  const len = end - pos;
  if (len <= 0) return 0;
  if (len <= 6) return buf.readUIntBE(pos, len);
  return Number(buf.readBigUInt64BE(pos) >> BigInt(8 * (8 - len)));
}

function readFloat(buf: Buffer, pos: number, end: number): number {
  const len = end - pos;
  if (len === 4) return buf.readFloatBE(pos);
  if (len === 8) return buf.readDoubleBE(pos);
  return Number(readUInt(buf, pos, end));
}

export function parseWebm(buf: Buffer): ExtractedVideoKeyframes | null {
  let segment: EbmlElement | null = null;
  let pos = 0;
  while (pos < buf.length) {
    const el = readElement(buf, pos);
    if (!el) break;
    if (el.id === EBML_IDS.segment) {
      segment = el;
      break;
    }
    pos = el.end;
  }
  if (!segment) return null;

  let timecodeScale = 1_000_000;
  let durationSeconds = 0;
  let width = 0;
  let height = 0;
  let codec: string | undefined;
  const keyframeSamples: KeyframeSample[] = [];
  let totalBytes = 0;

  const scanChildren = (
    dataOffset: number,
    end: number,
    callback: (el: EbmlElement) => void,
  ): void => {
    let p = dataOffset;
    while (p < end) {
      const el = readElement(buf, p);
      if (!el || el.end > end) break;
      callback(el);
      p = el.end;
    }
  };

  scanChildren(segment.dataOffset, segment.end, (top) => {
    if (top.id === EBML_IDS.info) {
      scanChildren(top.dataOffset, top.end, (info) => {
        if (info.id === EBML_IDS.timecodeScale) timecodeScale = readUInt(buf, info.dataOffset, info.end);
        else if (info.id === EBML_IDS.duration) durationSeconds = readFloat(buf, info.dataOffset, info.end);
      });
    } else if (top.id === EBML_IDS.tracks) {
      scanChildren(top.dataOffset, top.end, (entry) => {
        if (entry.id !== EBML_IDS.trackEntry) return;
        let trackType = 0;
        let entryWidth = 0;
        let entryHeight = 0;
        let entryCodec: string | undefined;
        scanChildren(entry.dataOffset, entry.end, (child) => {
          if (child.id === EBML_IDS.trackType) trackType = readUInt(buf, child.dataOffset, child.end);
          else if (child.id === EBML_IDS.codecId) entryCodec = buf.toString("utf8", child.dataOffset, child.end);
          else if (child.id === EBML_IDS.video) {
            scanChildren(child.dataOffset, child.end, (vc) => {
              if (vc.id === EBML_IDS.pixelWidth) entryWidth = readUInt(buf, vc.dataOffset, vc.end);
              else if (vc.id === EBML_IDS.pixelHeight) entryHeight = readUInt(buf, vc.dataOffset, vc.end);
            });
          }
        });
        if (trackType === 1 && entryWidth > 0) {
          width = entryWidth;
          height = entryHeight;
          codec = entryCodec;
        }
      });
    } else if (top.id === EBML_IDS.cluster) {
      let clusterTimecode = 0;
      scanChildren(top.dataOffset, top.end, (clusterChild) => {
        if (clusterChild.id === EBML_IDS.timecode) {
          clusterTimecode = readUInt(buf, clusterChild.dataOffset, clusterChild.end);
        } else if (clusterChild.id === EBML_IDS.simpleBlock) {
          // Block header: VINT track no, int16 timestamp, flags; S = keyframe.
          const trackNo = readEbmlSize(buf, clusterChild.dataOffset);
          const relTime = buf.readInt16BE(clusterChild.dataOffset + trackNo.size);
          const flags = buf[clusterChild.dataOffset + trackNo.size + 2];
          const isKeyframe = (flags & 0x80) !== 0;
          const blockDataStart = clusterChild.dataOffset + trackNo.size + 3;
          if (!isKeyframe) return;
          if (keyframeSamples.length >= MAX_KEYFRAMES) return;
          const byteLength = clusterChild.end - blockDataStart;
          if (byteLength <= 0) return;
          if (totalBytes + byteLength > MAX_KEYFRAME_BYTES) return;
          const timestampSeconds =
            ((clusterTimecode + relTime) * timecodeScale) / 1_000_000_000;
          keyframeSamples.push({
            index: keyframeSamples.length + 1,
            offset: blockDataStart,
            size: byteLength,
            timestampSeconds,
            data: Buffer.from(buf.subarray(blockDataStart, clusterChild.end)),
          });
          totalBytes += byteLength;
        }
      });
    }
  });

  if (width === 0 && height === 0 && keyframeSamples.length === 0) return null;

  // Synthetic total duration from cluster timeline when Info has none.
  if (durationSeconds === 0 && keyframeSamples.length > 0) {
    const last = keyframeSamples[keyframeSamples.length - 1];
    durationSeconds = last.timestampSeconds + 1;
  }

  return {
    kind: "webm",
    durationSeconds,
    width,
    height,
    sampleCount: keyframeSamples.length,
    codec,
    keyframeSamples,
  };
}

// ---------------------------------------------------------------------------
// MP3 parsing
// ---------------------------------------------------------------------------

// [version][layer] -> kbps table indexed by header bitrate index (1..14).
const MPEG_BITRATES_Kbps: Record<string, number[]> = {
  "1:1": [32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  "1:2": [32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  "1:3": [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "2:1": [32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  "2:2": [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  "2:3": [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};

const MPEG_SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG1
  2: [22050, 24000, 16000], // MPEG2
  0: [11025, 12000, 8000], // MPEG2.5
};

const MPEG_SAMPLES_PER_FRAME: Record<string, number> = {
  "1:1": 384,
  "1:2": 1152,
  "1:3": 1152,
  "2:1": 384,
  "2:2": 1152,
  "2:3": 576,
};

const CHANNEL_TOPOLOGIES = ["stereo", "joint stereo", "dual channel", "mono"] as const;

function mpegFrameSize(version: number, layer: number, bitrateKbps: number, sampleRate: number, padding: number): number {
  const bitrate = bitrateKbps * 1000;
  if (layer === 1) return Math.floor((12 * bitrate) / sampleRate + padding) * 4;
  if (layer === 2) return Math.floor((144 * bitrate) / sampleRate + padding);
  // layer 3
  const coeff = version === 3 ? 144 : 72;
  return Math.floor((coeff * bitrate) / sampleRate + padding);
}

function skipId3v2(buf: Buffer): number {
  if (buf.length >= 10 && buf.toString("latin1", 0, 3) === "ID3") {
    let sz = 0;
    for (let i = 0; i < 4; i++) sz = (sz << 7) | (buf[6 + i] & 0x7f);
    return 10 + sz;
  }
  return 0;
}

export function parseMp3(buf: Buffer): ExtractedAudioSpecs | null {
  const start = skipId3v2(buf);
  let pos = start;
  let frameCount = 0;
  let bitrateSum = 0;
  let sampleRate = 0;
  let samplesPerFrame = 0;
  let channels = 0;
  let topology = "";

  while (pos + 4 <= buf.length && frameCount < MAX_AUDIO_SCAN_FRAMES) {
    if (buf[pos] !== 0xff || (buf[pos + 1] & 0xe0) !== 0xe0) {
      if (frameCount > 0) break;
      pos++;
      continue;
    }

    const b1 = buf[pos + 1];
    const b2 = buf[pos + 2];
    const b3 = buf[pos + 3];

    const versionBits = (b1 >> 3) & 0x03; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    const layerBits = (b1 >> 1) & 0x03; // 1=L3, 2=L2, 3=L1
    if (versionBits === 1) {
      pos++;
      continue;
    }
    const layer = layerBits === 3 ? 1 : layerBits === 2 ? 2 : 3;
    const bitrateIndex = (b2 >> 4) & 0x0f;
    const sampleRateIndex = (b2 >> 2) & 0x03;
    const padding = (b2 >> 1) & 0x01;
    const channelMode = (b3 >> 6) & 0x03;

    const sr = MPEG_SAMPLE_RATES[versionBits]?.[sampleRateIndex] ?? 0;
    const tableKey = `${versionBits === 3 ? 1 : 2}:${layer}`;
    const bitrateKbps = MPEG_BITRATES_Kbps[tableKey]?.[bitrateIndex - 1] ?? 0;
    if (sr === 0 || bitrateKbps === 0) {
      pos++;
      continue;
    }

    const frameLen = mpegFrameSize(versionBits, layer, bitrateKbps, sr, padding);
    if (frameLen < 4 || pos + frameLen > buf.length) {
      pos++;
      continue;
    }

    if (frameCount === 0) {
      sampleRate = sr;
      samplesPerFrame = MPEG_SAMPLES_PER_FRAME[tableKey] ?? 0;
      channels = channelMode === 3 ? 1 : 2;
      topology = CHANNEL_TOPOLOGIES[channelMode] ?? "unknown";
    }

    frameCount++;
    bitrateSum += bitrateKbps;
    pos += frameLen;
  }

  if (frameCount === 0 || sampleRate === 0) return null;

  return {
    kind: "mp3",
    durationSeconds: (frameCount * samplesPerFrame) / sampleRate,
    sampleRate,
    bitrateKbps: Math.round(bitrateSum / frameCount),
    channels,
    channelTopology: topology,
    codec: "mpeg-audio-layer-3",
    byteSize: buf.length,
  };
}

// ---------------------------------------------------------------------------
// WAV (RIFF) parsing
// ---------------------------------------------------------------------------

function wavTopology(mask: number | null, channels: number): string {
  if (mask === 0x1) return "mono";
  if (mask === 0x3) return "stereo";
  if (channels === 1) return "mono";
  if (channels === 2) return "stereo";
  if (channels === 6) return "5.1";
  if (channels === 8) return "7.1";
  return `${channels} channels`;
}

export function parseWav(buf: Buffer): ExtractedAudioSpecs | null {
  if (buf.length < 12 || fourcc(buf, 0) !== "RIFF" || fourcc(buf, 8) !== "WAVE") return null;

  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let byteRate = 0;
  let channelMask: number | null = null;
  let dataSize = 0;

  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = fourcc(buf, pos);
    const size = buf.readUInt32LE(pos + 4);
    const dataStart = pos + 8;
    if (id === "fmt ") {
      if (size < 16) break;
      audioFormat = buf.readUInt16LE(dataStart);
      channels = buf.readUInt16LE(dataStart + 2);
      sampleRate = buf.readUInt32LE(dataStart + 4);
      byteRate = buf.readUInt32LE(dataStart + 8);
      if (size >= 40) channelMask = buf.readUInt32LE(dataStart + 20);
    } else if (id === "data") {
      dataSize = size;
      break;
    }
    pos = dataStart + size + (size % 2 === 1 ? 1 : 0); // chunk padding
  }

  if (channels === 0 || sampleRate === 0 || byteRate === 0) return null;

  const codec =
    audioFormat === 1
      ? "pcm"
      : audioFormat === 3
        ? "float"
        : audioFormat === 0xfffe
          ? "extensible"
          : `format-${audioFormat}`;

  return {
    kind: "wav",
    durationSeconds: byteRate > 0 ? dataSize / byteRate : 0,
    sampleRate,
    bitrateKbps: Math.round((byteRate * 8) / 1000),
    channels,
    channelTopology: wavTopology(channelMask, channels),
    codec,
    byteSize: buf.length,
  };
}

// ---------------------------------------------------------------------------
// Convenience helpers for the provider ingestion path.
// ---------------------------------------------------------------------------

const VIDEO_EXTS = new Set([".mp4", ".webm"]);

/** Full-file inline audio is capped so Gemini requests stay within limits. */
export const MAX_INLINE_AUDIO_BYTES_CAP = MAX_INLINE_AUDIO_BYTES;

export function shouldExtractVideo(ext: string): boolean {
  return VIDEO_EXTS.has(ext);
}