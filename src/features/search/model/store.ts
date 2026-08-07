import type { RawData } from "@orama/orama";
import { load, save } from "@orama/orama";
import type { MyOramaDB } from "@/features/search/model/schema";
import { createMyDb } from "@/features/search/model/schema";
import { getDb } from "@/lib/db";

const KV_KEY = "search:index:v13";
const KV_META_KEY = "search:index:meta:v13";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function compressRaw(raw: RawData): Promise<Uint8Array> {
  // Prefer built-in compression to avoid extra deps; fall back to plain bytes if unsupported
  const json = JSON.stringify(raw);
  const encoded = textEncoder.encode(json);

  if (typeof CompressionStream === "undefined") {
    return encoded;
  }

  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  await writer.write(encoded);
  await writer.close();
  const compressed = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(compressed);
}

async function decompressToRaw(buffer: ArrayBuffer): Promise<RawData> {
  // Attempt gzip first; if it fails, treat as plain JSON string (back-compat)
  const tryGzip = async () => {
    if (typeof DecompressionStream === "undefined") {
      throw new TypeError("DecompressionStream unavailable");
    }

    const stream = new DecompressionStream("gzip");
    const writer = stream.writable.getWriter();
    await writer.write(new Uint8Array(buffer));
    await writer.close();
    const decompressed = await new Response(stream.readable).arrayBuffer();
    const json = textDecoder.decode(decompressed);
    return JSON.parse(json) as RawData;
  };

  try {
    return await tryGzip();
  } catch {
    const json = textDecoder.decode(new Uint8Array(buffer));
    return JSON.parse(json) as RawData;
  }
}

let cachedDb: MyOramaDB | null = null;
let cachedVersion: string | null = null;
let inflight: Promise<MyOramaDB> | null = null;
// 后台重建任务（跨请求去重，避免并发重复重建）
let rebuildInflight: Promise<void> | null = null;

async function loadFromKv(env: Env): Promise<MyOramaDB | null> {
  const buf = await env.KV.get(KV_KEY, "arrayBuffer");
  if (!buf) return null;

  try {
    const raw = await decompressToRaw(buf);
    const db = await createMyDb();
    await load(db, raw);
    return db;
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "orama index load failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  }
}

/**
 * 后台异步重建索引：不阻塞调用方。重建完成后写回 KV 并刷新内存缓存，
 * 后续搜索请求即可命中，无需人工去后台点“重建索引”。
 * 用 rebuildInflight 跨请求去重，避免部署后瞬时大量请求重复触发全库扫描。
 */
async function triggerBackgroundRebuild(
  env: Env,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<void> {
  if (rebuildInflight) return rebuildInflight;
  rebuildInflight = (async () => {
    try {
      const { rebuildIndex } = await import(
        "@/features/search/service/search.service"
      );
      await rebuildIndex({ env, db: getDb(env) });
      const rebuilt = await loadFromKv(env);
      const newMeta = await getOramaMeta(env);
      if (rebuilt && (newMeta?.count ?? 0) > 0) {
        cachedDb = rebuilt;
        cachedVersion = newMeta!.version;
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          message: "orama index auto-rebuild failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      rebuildInflight = null;
    }
  })();
  // 让后台重建在响应返回后继续跑（Cloudflare Workers waitUntil），避免 isolate 被冻结导致重建中断
  waitUntil?.(rebuildInflight);
  return rebuildInflight;
}

export async function getOramaDb(
  env: Env,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<MyOramaDB> {
  const meta = await getOramaMeta(env);
  const latestVersion = meta?.version || "init";
  const hasDocs = (meta?.count ?? 0) > 0;

  if (cachedDb && cachedVersion === latestVersion && hasDocs) return cachedDb;
  if (inflight) return inflight;

  inflight = (async () => {
    const fromKv = await loadFromKv(env);
    // 仅当索引存在且含文档时才复用；空索引（重建失败 / 被清空 / 版本升级）直接走后台重建
    if (fromKv && hasDocs) {
      cachedVersion = latestVersion;
      return fromKv;
    }
    // 索引缺失/为空（重新部署后 KV 被重置、或版本升级）：立即返回空索引，
    // 同时后台异步重建并写回 KV——不在用户搜索请求内同步重建，避免 Workers 请求
    // CPU 预算被打满导致重建被中断、搜索长期失效。
    void triggerBackgroundRebuild(env, waitUntil);
    return fromKv ?? (await createMyDb());
  })().finally(() => {
    inflight = null;
  });

  cachedDb = await inflight;
  return cachedDb;
}

export async function persistOramaDb(
  env: Env,
  db: MyOramaDB,
  docCount?: number,
) {
  const raw = save(db);
  const compressed = await compressRaw(raw);
  await env.KV.put(KV_KEY, compressed);

  const prevMeta = await getOramaMeta(env);
  const newVersion = Date.now().toString();

  const meta = {
    version: newVersion,
    updatedAt: new Date().toISOString(),
    sizeInBytes: compressed.byteLength,
    // 重建时传入真实文档数；upsert/delete 时沿用上次的计数，避免被误清为 0
    count: docCount ?? prevMeta?.count ?? 0,
  };
  await env.KV.put(KV_META_KEY, JSON.stringify(meta));
  setOramaDb(db, newVersion);
  return newVersion;
}

export async function getOramaMeta(
  env: Env,
): Promise<{ version: string; count?: number } | null> {
  return await env.KV.get(KV_META_KEY, "json");
}

export function setOramaDb(db: MyOramaDB, version: string) {
  cachedDb = db;
  cachedVersion = version;
}
