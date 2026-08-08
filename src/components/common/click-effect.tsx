import { useEffect } from "react";

/**
 * 全局鼠标点击特效：点击/触摸时在落点迸发一圈扩散圆环 + 若干彩色粒子。
 *
 * 设计要点：
 * - 纯客户端运行（仅在 useEffect 内操作 DOM），不进入 SSR，不会造成水合不一致。
 * - 用 Web Animations API 驱动，动画结束即移除节点，无内存泄漏、不触发 React 重渲染。
 * - 圆环使用主题主色（--fuwari-primary），粒子混入几抹柔亮色，整体与站点协调又活泼。
 * - 尊重系统「减少动态效果」(prefers-reduced-motion)：开启时完全不渲染。
 */
export function ClickEffect() {
  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    // 读取主题主色，让特效与站点视觉协调
    const primaryColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--fuwari-primary")
        .trim() || "#3b82f6";

    const palette = [
      primaryColor,
      primaryColor, // 主色加权，整体更统一
      "#ff7eb6",
      "#7afcff",
      "#feff9c",
      "#b388ff",
    ];

    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
    document.body.appendChild(overlay);

    const rand = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const spawn = (x: number, y: number) => {
      // 扩散圆环
      const ring = document.createElement("span");
      ring.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:9999px;border:2px solid ${primaryColor};opacity:0.6;pointer-events:none;will-change:transform,opacity;`;
      overlay.appendChild(ring);
      const ringAnim = ring.animate(
        [
          { transform: "scale(0.4)", opacity: 0.6 },
          { transform: "scale(7)", opacity: 0 },
        ],
        { duration: 600, easing: "cubic-bezier(0.22,1,0.36,1)" },
      );
      ringAnim.onfinish = () => ring.remove();

      // 彩色粒子
      const count = Math.round(rand(9, 14));
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + rand(-0.3, 0.3);
        const distance = rand(40, 95);
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance + rand(10, 35); // 轻微下坠
        const size = rand(4, 9);
        const color = palette[Math.floor(Math.random() * palette.length)];
        const p = document.createElement("span");
        p.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:9999px;background:${color};opacity:1;pointer-events:none;will-change:transform,opacity;`;
        overlay.appendChild(p);
        const dur = rand(520, 820);
        const anim = p.animate(
          [
            { transform: "translate(0,0) scale(1)", opacity: 1 },
            {
              transform: `translate(${dx}px,${dy}px) scale(0)`,
              opacity: 0,
            },
          ],
          { duration: dur, easing: "cubic-bezier(0.22,1,0.36,1)" },
        );
        anim.onfinish = () => p.remove();
      }
    };

    const onClick = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return; // 仅响应主按钮
      spawn(e.clientX, e.clientY);
    };

    window.addEventListener("pointerdown", onClick);
    return () => {
      window.removeEventListener("pointerdown", onClick);
      overlay.remove();
    };
  }, []);

  return null;
}
