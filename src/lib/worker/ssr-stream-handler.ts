import {
  defineHandlerCallback,
  transformReadableStreamWithRouter,
} from "@tanstack/react-router/ssr/server";
import { createStartHandler } from "@tanstack/react-start/server";
import { StartServer } from "@tanstack/react-start-server";
import { jsx } from "react/jsx-runtime";
import ReactDOMServer from "react-dom/server";

/**
 * 自定义 SSR stream handler：对所有请求（不限于搜索引擎 bot）都等待
 * React 流式渲染的 `allReady`（所有 Suspense 边界 resolve）后再吐出完整 HTML。
 *
 * 原因：框架默认 handler 仅对 bot UA 等待 allReady，对普通浏览器会先吐出
 * 「骨架 / 空兜底」的 SSR 外壳，再异步流式补真实内容。但客户端已持有脱水
 * （dehydrated）的查询数据，首帧直接渲染真实 DOM，与服务器吐出的兜底外壳
 * 结构不一致 → 全站水合报错（#418 首页 / #419 登录页）。让服务端等全部
 * resolve 后再输出，两端 DOM 一致，水合不再报错。
 *
 * 另：捕获 SSR 渲染期错误。React 会把 Suspense 边界内的错误静默吞掉并输出
 * `<!--$!-->` 标记（客户端因此必须整棵子树重渲染 → #419），错误本身不会
 * 出现在 HTML 里。这里用 onError 把错误打到 Workers 日志，便于线上排查。
 */
const allReadyStreamHandler = defineHandlerCallback(
  ({ request, router, responseHeaders }) => {
    return (async () => {
      // biome-ignore lint/suspicious/noExplicitAny: React 流式 ReadableStream 与 DOM ReadableStream 类型不兼容，需绕过
      const stream: any = await ReactDOMServer.renderToReadableStream(
        jsx(StartServer, { router }),
        {
          signal: request.signal,
          nonce: router.options.ssr?.nonce,
          progressiveChunkSize: Number.POSITIVE_INFINITY,
          onError(error: unknown) {
            const err = error as Error | undefined;
            const detail = `${err?.name ?? "Error"}: ${err?.message ?? String(error)} @@ ${err?.stack ?? "(no stack)"}`;
            console.error("[SSR ERROR]", detail);
          },
        },
      );

      // 关键修复：无条件等待所有 Suspense 边界 resolve（框架默认仅对 bot 等待）
      await stream.allReady;

      // biome-ignore lint/suspicious/noExplicitAny: transformReadableStreamWithRouter 返回 stream/web ReadableStream，与 Response BodyInit 类型不兼容
      const responseStream: any = transformReadableStreamWithRouter(
        router,
        stream,
      );
      return new Response(responseStream, {
        status: router.stores.statusCode.get(),
        headers: responseHeaders,
      });
    })();
  },
);

const startFetch = createStartHandler(allReadyStreamHandler);

// 与框架默认 server-entry 保持一致：导出带 .fetch 的形态
export const handler = { fetch: startFetch };
export default handler;
