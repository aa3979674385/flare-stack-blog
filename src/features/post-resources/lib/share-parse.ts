/**
 * 网盘分享链接自动解析：从「完整分享文案」中剥离出 链接 + 提取码，并识别网盘类型。
 *
 * 支持的常见格式：
 *  - 链接带查询参数：https://pan.baidu.com/s/1xxxx?pwd=abcd
 *  - 纯文本分享：链接: https://pan.baidu.com/s/1xxxx 提取码: abcd
 *  - 夸克/阿里/天翼/115 等：识别域名自动归类
 */

export type ShareLinkType =
  | "百度网盘"
  | "夸克网盘"
  | "阿里云盘"
  | "天翼云盘"
  | "115网盘"
  | "其他";

const PLATFORM_HINTS: { type: ShareLinkType; domains: string[] }[] = [
  { type: "百度网盘", domains: ["pan.baidu.com", "baidu.com"] },
  { type: "夸克网盘", domains: ["pan.quark.cn", "quark.cn"] },
  { type: "阿里云盘", domains: ["aliyundrive.com", "alipan.com", "ali.cn"] },
  { type: "天翼云盘", domains: ["cloud.189.cn", "189.cn"] },
  {
    type: "115网盘",
    domains: ["115.com", "115cdn.com", "115cdn.net", "115share.com"],
  },
];

export interface ParsedShare {
  url: string;
  password?: string;
  type: ShareLinkType;
}

function detectType(url: string): ShareLinkType {
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const p of PLATFORM_HINTS) {
      if (p.domains.some((d) => host === d || host.endsWith("." + d) || host.includes(d))) {
        return p.type;
      }
    }
  } catch {
    // 非法 URL，交给下方兜底
  }
  return "其他";
}

function extractPassword(rawUrl: string, fullText: string): string | undefined {
  // 1. 优先从 URL 查询参数取：pwd / code / password / passwd / accesscode / ac
  try {
    const u = new URL(rawUrl);
    for (const key of ["pwd", "code", "password", "passwd", "accesscode", "ac"]) {
      const v = u.searchParams.get(key);
      if (v && v.trim()) return v.trim();
    }
  } catch {
    // 非标准 URL，忽略
  }

  // 2. 文案中的「提取码/访问码/提取密码/口令/密码: XXXX」
  const textPatterns = [
    /(?:提取码|访问码|提取密码|口令|密码)[:：]?\s*([A-Za-z0-9]{3,12})/i,
    /(?:pwd|code|password)[:=]\s*([A-Za-z0-9]{3,12})/i,
  ];
  for (const re of textPatterns) {
    const m = fullText.match(re);
    if (m) return m[1].trim();
  }
  return undefined;
}

function firstUrl(text: string): string | undefined {
  const m = text.match(/https?:\/\/[^\s"'<>）)】\]]+/i);
  if (!m) return undefined;
  // 去掉结尾可能的标点
  return m[0].replace(/[。.，,；;、]+$/, "");
}

/** 解析单条分享文案。无法识别到 URL 时返回 null。 */
export function parseShareLink(raw: string): ParsedShare | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const url = firstUrl(text);
  if (!url) return null;
  const password = extractPassword(url, text);
  return { url, password, type: detectType(url) };
}

/** 批量解析：按换行拆分，每行一条分享；过滤掉无法识别的行。 */
export function parseShareLinks(raw: string): ParsedShare[] {
  return (raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseShareLink(line))
    .filter((x): x is ParsedShare => x !== null);
}
