import { createHash, randomBytes } from "node:crypto";
const API_ORIGIN = "https://api.bilibili.com";
const REFERER = "https://www.bilibili.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
/** B 站 WBI 签名用的固定置换表（与网页端一致）。 */
const MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19,
    29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
    22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];
const BUVID3 = `${randomBytes(16).toString("hex").toUpperCase()}infoc`;
const API_HEADERS = {
    "User-Agent": USER_AGENT,
    Referer: `${REFERER}/`,
    Origin: REFERER,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Cookie: `buvid3=${BUVID3}; buvid_fp_plain=undefined;`,
};
const DOWNLOAD_HEADERS = {
    "User-Agent": USER_AGENT,
    Accept: "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Range: "bytes=0-",
    Referer: REFERER,
    Origin: REFERER,
};
export const BVID_PATTERN = /^BV[0-9A-Za-z]{10}$/;
let wbiCache = null;
function keyFromWbiUrl(url) {
    const file = url.split("?")[0].split("/").pop() ?? "";
    const key = file.split(".")[0];
    if (!key)
        throw new Error(`无法从 WBI 图片地址解析 key：${url}`);
    return key;
}
/** 从 nav 响应中提取 img_key / sub_key；未登录时 data 仍然存在。 */
export function extractWbiKeys(nav) {
    const data = nav?.data;
    const imgUrl = data?.wbi_img?.img_url;
    const subUrl = data?.wbi_img?.sub_url;
    if (!imgUrl || !subUrl) {
        throw new Error("B 站 nav 响应缺少 wbi_img，无法生成 WBI 签名");
    }
    return { imgKey: keyFromWbiUrl(imgUrl), subKey: keyFromWbiUrl(subUrl) };
}
export function getMixinKey(imgKey, subKey) {
    const original = `${imgKey}${subKey}`;
    return MIXIN_KEY_ENC_TAB.map((index) => original[index] ?? "").join("").slice(0, 32);
}
/** B 站要求去掉值里的这些字符，再参与签名。 */
function sanitizeWbiValue(value) {
    return value.replace(/[!'()*]/g, "");
}
/** 与 Go `url.Values.Encode()` 对齐：空格编码成 `+`。 */
function encodeWbiValue(value) {
    return encodeURIComponent(value).replace(/%20/g, "+");
}
/**
 * 生成带 WBI 签名的 query string。
 *
 * 纯函数：`wts` 可注入，方便固定向量测试。
 */
export function buildSignedQuery(params, imgKey, subKey, wts = Math.floor(Date.now() / 1000)) {
    const entries = Object.entries(params).map(([key, value]) => [
        key,
        sanitizeWbiValue(String(value)),
    ]);
    entries.push(["wts", String(wts)]);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const query = entries
        .map(([key, value]) => `${encodeWbiValue(key)}=${encodeWbiValue(value)}`)
        .join("&");
    const mixinKey = getMixinKey(imgKey, subKey);
    const wRid = createHash("md5").update(query + mixinKey).digest("hex");
    return {
        query: `${query}&w_rid=${wRid}`,
        wts,
        wRid,
        mixinKey,
    };
}
/** 获取并缓存 WBI 密钥（10 分钟刷新一次）。 */
export async function getWbiKeys(force = false) {
    if (!force && wbiCache && Date.now() - wbiCache.fetchedAt < 10 * 60_000) {
        return wbiCache.keys;
    }
    const response = await fetch(`${API_ORIGIN}/x/web-interface/nav`, {
        headers: API_HEADERS,
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
        throw new Error(`获取 B 站 WBI 密钥失败：HTTP ${response.status}`);
    }
    const keys = extractWbiKeys(await response.json());
    wbiCache = { keys, fetchedAt: Date.now() };
    return keys;
}
async function biliGet(path, params) {
    const { imgKey, subKey } = await getWbiKeys();
    const { query } = buildSignedQuery(params, imgKey, subKey);
    const url = `${API_ORIGIN}${path}?${query}`;
    const response = await fetch(url, {
        headers: API_HEADERS,
        signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`B 站接口 HTTP ${response.status}：${text.slice(0, 300)}`);
    }
    let payload;
    try {
        payload = JSON.parse(text);
    }
    catch {
        throw new Error(`B 站接口返回了非 JSON 内容：${text.slice(0, 300)}`);
    }
    if (payload.code !== 0) {
        const message = payload.message ?? payload.msg ?? "";
        throw new Error(`B 站接口 ${path} 失败：code=${payload.code ?? "?"} ${message}`.trim());
    }
    if (payload.data === undefined) {
        throw new Error(`B 站接口 ${path} 没有返回 data`);
    }
    return payload.data;
}
/** 关键词搜索视频；自动过滤非视频条目。 */
export async function searchVideos(keyword, options = {}) {
    const data = await biliGet("/x/web-interface/wbi/search/type", {
        search_type: "video",
        keyword,
        page: options.page ?? 1,
        page_size: options.pageSize ?? 20,
        order: options.order ?? "totalrank",
    });
    return (data.result ?? []).flatMap((item) => {
        if (!item.bvid || !BVID_PATTERN.test(item.bvid))
            return [];
        return [
            {
                bvid: item.bvid,
                title: stripHtml(item.title ?? ""),
                author: stripHtml(item.author ?? ""),
                coverUrl: normalizeUrl(item.pic ?? ""),
                duration: Number(item.duration) || 0,
            },
        ];
    });
}
/** 获取视频标题、简介、UP 主、封面与第一个分 P 的 cid。 */
export async function getVideoInfo(bvid) {
    const data = await biliGet("/x/web-interface/wbi/view", { bvid });
    const firstPage = data.pages?.[0];
    const cid = firstPage?.cid ?? data.cid;
    if (!cid)
        throw new Error(`视频 ${bvid} 没有可用的 cid`);
    return {
        bvid: data.bvid || bvid,
        title: stripHtml(data.title ?? ""),
        desc: stripHtml(data.desc ?? ""),
        coverUrl: normalizeUrl(data.pic ?? ""),
        author: stripHtml(data.owner?.name ?? ""),
        duration: Number(data.duration ?? firstPage?.duration ?? 0) || 0,
        cid,
        pageIndex: firstPage?.page ?? 1,
        pageTitle: firstPage?.part ?? "",
        isUpowerExclusive: Boolean(data.is_upower_exclusive),
    };
}
/**
 * 获取音频播放地址。
 *
 * 优先 DASH 的纯音频流（体积远小于整段视频），失败时回退到 durl。
 */
export async function getAudioSource(bvid, cid) {
    const data = await biliGet("/x/player/wbi/playurl", {
        bvid,
        cid,
        fnval: 4048,
        fnver: 0,
        fourk: 1,
    });
    const audio = (data.dash?.audio ?? []).filter((item) => item.baseUrl || item.base_url);
    const best = [...audio].sort((a, b) => Number(b.bandwidth ?? 0) - Number(a.bandwidth ?? 0))[0];
    if (best) {
        const url = normalizeUrl(best.baseUrl ?? best.base_url ?? "");
        const mime = (best.mimeType ?? best.mime_type ?? "audio/mp4")
            .split(";")[0]
            .trim()
            .toLowerCase();
        return { url, source: "dash", container: "m4a", mime: mime || "audio/mp4" };
    }
    const durl = (data.durl ?? []).find((item) => item.url)?.url;
    if (durl) {
        return {
            url: normalizeUrl(durl),
            source: "durl",
            container: "mp4",
            mime: "video/mp4",
        };
    }
    throw new Error(`视频 ${bvid} 没有返回可用的音频流（可能需要登录或稍后重试）`);
}
/** 下载音频/封面到内存，带大小上限，避免误下超大文件。 */
export async function downloadBinary(url, options) {
    const response = await fetch(normalizeUrl(url), {
        headers: DOWNLOAD_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) {
        throw new Error(`下载${options.label}失败：HTTP ${response.status}`);
    }
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > options.maxBytes) {
        throw new Error(`下载${options.label}超过上限 ${formatBytes(options.maxBytes)}（Content-Length ${formatBytes(contentLength)}）`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
        throw new Error(`下载${options.label}为空`);
    }
    if (buffer.length > options.maxBytes) {
        throw new Error(`下载${options.label}超过上限 ${formatBytes(options.maxBytes)}（实际 ${formatBytes(buffer.length)}）`);
    }
    return {
        buffer,
        contentType: (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(),
    };
}
/** 去掉搜索标题里的高亮标签并解码常见 HTML 实体。 */
export function stripHtml(input) {
    const withoutTags = input.replace(/<[^>]*>/g, "");
    const decoded = decodeHtmlEntities(withoutTags);
    return decoded
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function decodeHtmlEntities(input) {
    const named = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
    };
    return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
        if (code.startsWith("#")) {
            const hex = code[1]?.toLowerCase() === "x";
            const value = Number.parseInt(hex ? code.slice(2) : code.slice(1), hex ? 16 : 10);
            if (Number.isInteger(value) && value >= 0 && value <= 0x10ffff) {
                try {
                    return String.fromCodePoint(value);
                }
                catch {
                    return match;
                }
            }
            return match;
        }
        return named[code.toLowerCase()] ?? match;
    });
}
function normalizeUrl(url) {
    const trimmed = url.trim();
    if (trimmed.startsWith("//"))
        return `https:${trimmed}`;
    return trimmed;
}
export function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
