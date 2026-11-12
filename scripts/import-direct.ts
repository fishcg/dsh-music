#!/usr/bin/env node
/**
 * Direct import for the DSH acgay-player plugin.
 *
 * Bilibili search/selection -> download -> ffmpeg 192kbps mp3 -> POST
 * /api/plugin/import. Nothing is written to a local MySQL database or local
 * OSS client; acgay is the single writer, and the import is auto-approved.
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  BVID_PATTERN,
  downloadBinary,
  getAudioSource,
  getVideoInfo,
  searchVideos,
  type VideoInfo,
} from "./lib/bilibili.ts";

const execFileAsync = promisify(execFile);

const FFMPEG = process.env.ACGAY_FFMPEG || "ffmpeg";
const FFPROBE = process.env.ACGAY_FFPROBE || "ffprobe";
const IMPORT_URL = (process.env.ACGAY_BASE_URL || "https://www.acgay.cn").replace(/\/+$/, "") + "/api/plugin/import";
const TOKEN_PATHS = [
  path.join(homedir(), ".acgay-import-token"),
  path.join(homedir(), ".dsh/profiles/desktop/acgay-import-token"),
];
const NOISE = /(合集|串烧|伴奏|翻唱|cover|翻自|琴谱|钢琴版|教学|教程|reaction|切片|直播回放|电台合集|无损音乐合集)/i;
const OFFICIAL = /(4k|8k|hi-?res|无损|官方|mv|1080p|2160p|修复)/i;
const MIN_DURATION = 100;
const MAX_DURATION = 600;

type Pick = {
  bvid: string;
  title: string;
  author: string;
  duration: number;
  durationText: string;
};

type ImportResponse = {
  ok?: boolean;
  id?: number | string;
  duplicate?: boolean;
  error?: string;
};

function parseInput(): { query?: string; bvid?: string } {
  const raw = process.argv[2] || "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { query: raw };
  }
  if (!parsed || typeof parsed !== "object") return { query: raw };
  const value = parsed as { query?: unknown; bvid?: unknown };
  return {
    query: typeof value.query === "string" ? value.query.trim() : undefined,
    bvid: typeof value.bvid === "string" ? value.bvid.trim() : undefined,
  };
}

function durationText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

function token(): string {
  const fromEnv = String(process.env.ACGAY_IMPORT_TOKEN || "").trim();
  if (fromEnv) return fromEnv;
  const customFile = String(process.env.ACGAY_IMPORT_TOKEN_FILE || "").trim();
  for (const file of customFile ? [customFile, ...TOKEN_PATHS] : TOKEN_PATHS) {
    try {
      if (!existsSync(file)) continue;
      const value = readFileSync(file, "utf8").trim();
      if (value) return value;
    } catch {
      // try the next path
    }
  }
  throw new Error("缺少 ACGAY_IMPORT_TOKEN；请先配置插件导入 token");
}

async function probeDuration(file: string): Promise<number> {
  const { stdout } = await execFileAsync(FFPROBE, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const value = Number.parseFloat(String(stdout).trim());
  if (!Number.isFinite(value) || value <= 0) throw new Error("ffprobe 未读到音频时长");
  return value;
}

async function transcode(source: string, target: string): Promise<void> {
  await execFileAsync(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", source,
    "-vn",
    "-codec:a", "libmp3lame",
    "-b:a", "192k",
    "-ar", "44100",
    "-ac", "2",
    target,
  ]);
}

function score(info: VideoInfo, tokens: string[]): number {
  const title = info.title || "";
  const haystack = `${title} ${info.author || ""}`;
  let total = 0;
  for (const item of tokens) if (haystack.includes(item)) total += 16;
  if (tokens.length > 0 && tokens.every((item) => title.includes(item))) total += 40;
  const first = tokens[0];
  if (first && title.startsWith(first)) total += 12;
  if (OFFICIAL.test(title)) total += 6;
  if (info.duration >= MIN_DURATION && info.duration <= MAX_DURATION) total += 24;
  if (info.duration > MAX_DURATION) total -= 20;
  if (info.duration > 0 && info.duration < MIN_DURATION) total -= 30;
  if (NOISE.test(title)) total -= 100;
  if (info.isUpowerExclusive) total -= 200;
  return total;
}

async function choose(query: string): Promise<{ info: VideoInfo; pick: Pick }> {
  const tokens = query
    .split(/[\s,，、/]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .slice(0, 5);
  if (tokens.length === 0) throw new Error("查询关键词太短");

  const results = await searchVideos(query, { pageSize: 30 });
  if (results.length === 0) throw new Error(`B 站没有搜索到「${query}」`);

  const candidates = results
    .filter((item) => BVID_PATTERN.test(item.bvid))
    .map((item) => ({
      item,
      score: score({ ...item, desc: "", coverUrl: item.coverUrl, cid: 0, pageIndex: 1, pageTitle: "", isUpowerExclusive: false }, tokens),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  for (const candidate of candidates) {
    let info: VideoInfo;
    try {
      info = await getVideoInfo(candidate.item.bvid);
    } catch {
      continue;
    }
    if (info.isUpowerExclusive) continue;
    if (info.duration < MIN_DURATION || info.duration > MAX_DURATION) continue;
    if (NOISE.test(info.title)) continue;
    if (!tokens.every((item) => `${info.title} ${info.desc}`.includes(item))) continue;
    const pick: Pick = {
      bvid: info.bvid,
      title: info.title,
      author: info.author,
      duration: info.duration,
      durationText: durationText(info.duration),
    };
    return { info, pick };
  }

  throw new Error(`B 站没有找到可导入的「${query}」单曲（100–600 秒，非合集/伴奏）`);
}

async function resolveBvid(bvid: string): Promise<{ info: VideoInfo; pick: Pick }> {
  if (!BVID_PATTERN.test(bvid)) throw new Error("BV 号格式不正确");
  const info = await getVideoInfo(bvid);
  if (info.isUpowerExclusive) throw new Error("充电专属视频无法直接导入");
  if (info.duration < MIN_DURATION || info.duration > MAX_DURATION) {
    throw new Error(`视频时长 ${durationText(info.duration) || "未知"}，不在 100–600 秒范围内`);
  }
  return {
    info,
    pick: {
      bvid: info.bvid,
      title: info.title,
      author: info.author,
      duration: info.duration,
      durationText: durationText(info.duration),
    },
  };
}

async function upload(
  pick: Pick,
  audio: Buffer,
  cover: Buffer | null,
  coverMime: string,
): Promise<ImportResponse> {
  const form = new FormData();
  form.append("bvid", pick.bvid);
  form.append("subject", pick.title.slice(0, 255));
  form.append("summary", "");
  form.append("author", pick.author.slice(0, 128));
  form.append("categoryId", "104");
  form.append("audio", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "audio.mp3");
  if (cover) {
    const ext = coverMime.includes("png") ? "png" : coverMime.includes("webp") ? "webp" : "jpg";
    form.append("cover", new Blob([new Uint8Array(cover)], { type: coverMime }), `cover.${ext}`);
  }

  const response = await fetch(IMPORT_URL, {
    method: "POST",
    headers: { "x-acgay-import-token": token() },
    body: form,
    signal: AbortSignal.timeout(180_000),
  });
  const data = (await response.json().catch(() => ({}))) as ImportResponse;
  if (!response.ok || data.ok !== true) {
    throw new Error(data.error || `导入接口返回 ${response.status}`);
  }
  return data;
}

async function main(): Promise<void> {
  const input = parseInput();
  if (input.bvid) {
    if (!BVID_PATTERN.test(input.bvid)) throw new Error("BV 号格式不正确");
  } else if (!input.query) {
    throw new Error("缺少查询词或 BV 号");
  }

  const chosen = input.bvid ? await resolveBvid(input.bvid) : await choose(input.query as string);
  const { info, pick } = chosen;
  const workDir = await mkdtemp(path.join(tmpdir(), "acgay-import-"));

  try {
    const audioSource = await getAudioSource(pick.bvid, info.cid);
    const sourceBuffer = (
      await downloadBinary(audioSource.url, { maxBytes: 150 * 1024 * 1024, label: "音频" })
    ).buffer;
    const sourceFile = path.join(workDir, `source.${audioSource.container}`);
    const mp3File = path.join(workDir, "output.mp3");
    await writeFile(sourceFile, sourceBuffer);
    await transcode(sourceFile, mp3File);
    const audio = await readFile(mp3File);
    if (audio.length === 0) throw new Error("转码后的音频为空");
    const duration = await probeDuration(mp3File);

    let cover: Buffer | null = null;
    let coverMime = "image/jpeg";
    if (info.coverUrl) {
      try {
        const downloaded = await downloadBinary(info.coverUrl, { maxBytes: 5 * 1024 * 1024, label: "封面" });
        cover = downloaded.buffer;
        coverMime = downloaded.contentType || "image/jpeg";
      } catch {
        cover = null;
      }
    }

    const uploaded = await upload(pick, audio, cover, coverMime);
    const id = Number(uploaded.id) || 0;
    console.log(JSON.stringify({
      ok: true,
      prodId: id,
      localId: 0,
      bvid: pick.bvid,
      title: pick.title,
      author: pick.author,
      duration: Math.round(duration),
      duplicate: Boolean(uploaded.duplicate),
      message: uploaded.duplicate ? "曲目已在 acgay 中" : "已导入 acgay 并自动过审",
    }));
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.log(JSON.stringify({ ok: false, error: String((error && (error as Error).message) || error) }));
  process.exitCode = 1;
});
