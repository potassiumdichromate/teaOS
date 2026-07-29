import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils.js";

type Shape = "square" | "hexagon" | "circle" | "triangle";
type Direction = "diagonal" | "up" | "right" | "down" | "left";

/**
 * Animated canvas grid with a mouse-hover trail. Adapted from React Bits'
 * `ShapeGrid` for use as a *background* layer, which the original is not
 * built for:
 *
 * - the pointer listener moves from the canvas to `window`, so the canvas can
 *   carry `pointer-events: none` and never swallow a click on the buttons and
 *   links stacked above it;
 * - the animation loop is suspended when the canvas scrolls out of view
 *   (IntersectionObserver) or the tab is hidden, and is not started at all
 *   under `prefers-reduced-motion` — one static frame is drawn instead. The
 *   original runs `requestAnimationFrame` forever regardless;
 * - the demo's `#0F8F73` green / `#222` fill are replaced with this theme's
 *   `border` line colour and `primary` hover fill;
 * - the trailing `createRadialGradient` fill in the original is dead code (one
 *   fully-transparent colour stop, so it paints nothing); the intended edge
 *   fade is done properly with a CSS mask on the wrapper instead.
 */
export default function ShapeGrid({
  direction = "diagonal",
  speed = 0.35,
  borderColor = "hsl(222 14% 17%)",
  squareSize = 44,
  hoverFillColor = "hsl(212 92% 60% / 0.16)",
  shape = "square",
  hoverTrailAmount = 6,
  className,
}: {
  direction?: Direction;
  speed?: number;
  borderColor?: string;
  squareSize?: number;
  hoverFillColor?: string;
  shape?: Shape;
  hoverTrailAmount?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const isHex = shape === "hexagon";
    const isTri = shape === "triangle";
    const hexHoriz = squareSize * 1.5;
    const hexVert = squareSize * Math.sqrt(3);

    const offset = { x: 0, y: 0 };
    const opacities = new Map<string, number>();
    let hovered: { x: number; y: number } | null = null;
    let trail: Array<{ x: number; y: number }> = [];
    let frame: number | null = null;
    let visible = true;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const path = {
      hex(cx: number, cy: number, size: number) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const vx = cx + size * Math.cos(angle);
          const vy = cy + size * Math.sin(angle);
          if (i === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
      },
      circle(cx: number, cy: number, size: number) {
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.closePath();
      },
      triangle(cx: number, cy: number, size: number, flip: boolean) {
        ctx.beginPath();
        if (flip) {
          ctx.moveTo(cx, cy + size / 2);
          ctx.lineTo(cx + size / 2, cy - size / 2);
          ctx.lineTo(cx - size / 2, cy - size / 2);
        } else {
          ctx.moveTo(cx, cy - size / 2);
          ctx.lineTo(cx + size / 2, cy + size / 2);
          ctx.lineTo(cx - size / 2, cy + size / 2);
        }
        ctx.closePath();
      },
    };

    const wrap = (value: number, period: number) => ((value % period) + period) % period;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1;

      const paint = (key: string, trace: () => void) => {
        const alpha = opacities.get(key);
        if (alpha) {
          ctx.globalAlpha = alpha;
          trace();
          ctx.fillStyle = hoverFillColor;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        trace();
        ctx.strokeStyle = borderColor;
        ctx.stroke();
      };

      if (isHex) {
        const colShift = Math.floor(offset.x / hexHoriz);
        const ox = wrap(offset.x, hexHoriz);
        const oy = wrap(offset.y, hexVert);
        const cols = Math.ceil(canvas.width / hexHoriz) + 3;
        const rows = Math.ceil(canvas.height / hexVert) + 3;
        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const cx = col * hexHoriz + ox;
            const cy = row * hexVert + ((col + colShift) % 2 !== 0 ? hexVert / 2 : 0) + oy;
            paint(`${col},${row}`, () => path.hex(cx, cy, squareSize));
          }
        }
      } else if (isTri) {
        const halfW = squareSize / 2;
        const colShift = Math.floor(offset.x / halfW);
        const rowShift = Math.floor(offset.y / squareSize);
        const ox = wrap(offset.x, halfW);
        const oy = wrap(offset.y, squareSize);
        const cols = Math.ceil(canvas.width / halfW) + 4;
        const rows = Math.ceil(canvas.height / squareSize) + 4;
        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const cx = col * halfW + ox;
            const cy = row * squareSize + squareSize / 2 + oy;
            const flip = wrap(col + colShift + row + rowShift, 2) !== 0;
            paint(`${col},${row}`, () => path.triangle(cx, cy, squareSize, flip));
          }
        }
      } else if (shape === "circle") {
        const ox = wrap(offset.x, squareSize);
        const oy = wrap(offset.y, squareSize);
        const cols = Math.ceil(canvas.width / squareSize) + 3;
        const rows = Math.ceil(canvas.height / squareSize) + 3;
        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const cx = col * squareSize + squareSize / 2 + ox;
            const cy = row * squareSize + squareSize / 2 + oy;
            paint(`${col},${row}`, () => path.circle(cx, cy, squareSize));
          }
        }
      } else {
        const ox = wrap(offset.x, squareSize);
        const oy = wrap(offset.y, squareSize);
        const cols = Math.ceil(canvas.width / squareSize) + 3;
        const rows = Math.ceil(canvas.height / squareSize) + 3;
        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const sx = col * squareSize + ox;
            const sy = row * squareSize + oy;
            paint(`${col},${row}`, () => {
              ctx.beginPath();
              ctx.rect(sx, sy, squareSize, squareSize);
            });
          }
        }
      }
    };

    const stepOpacities = () => {
      const targets = new Map<string, number>();
      if (hovered) targets.set(`${hovered.x},${hovered.y}`, 1);
      if (hoverTrailAmount > 0) {
        trail.forEach((cell, i) => {
          const key = `${cell.x},${cell.y}`;
          if (!targets.has(key)) targets.set(key, (trail.length - i) / (trail.length + 1));
        });
      }
      for (const key of targets.keys()) {
        if (!opacities.has(key)) opacities.set(key, 0);
      }
      for (const [key, value] of opacities) {
        const target = targets.get(key) ?? 0;
        const next = value + (target - value) * 0.15;
        if (next < 0.005) opacities.delete(key);
        else opacities.set(key, next);
      }
    };

    const tick = () => {
      const step = Math.max(speed, 0.05);
      const wrapX = isHex ? hexHoriz * 2 : squareSize;
      const wrapY = isHex ? hexVert : isTri ? squareSize * 2 : squareSize;
      if (direction === "right" || direction === "diagonal") offset.x = wrap(offset.x - step, wrapX);
      if (direction === "left") offset.x = wrap(offset.x + step, wrapX);
      if (direction === "up") offset.y = wrap(offset.y + step, wrapY);
      if (direction === "down" || direction === "diagonal") offset.y = wrap(offset.y - step, wrapY);
      stepOpacities();
      draw();
      frame = requestAnimationFrame(tick);
    };

    const play = () => {
      if (reduced || frame !== null || !visible || document.hidden) return;
      frame = requestAnimationFrame(tick);
    };
    const pause = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };

    // Cell under the pointer. Tracked on `window` rather than the canvas so the
    // canvas itself can stay `pointer-events: none`.
    const onPointerMove = (event: MouseEvent) => {
      if (reduced) return;
      const rect = canvas.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      if (mx < 0 || my < 0 || mx > rect.width || my > rect.height) {
        hovered = null;
        return;
      }
      let col: number;
      let row: number;
      if (isHex) {
        const colShift = Math.floor(offset.x / hexHoriz);
        col = Math.round((mx - wrap(offset.x, hexHoriz)) / hexHoriz);
        const rowOffset = (col + colShift) % 2 !== 0 ? hexVert / 2 : 0;
        row = Math.round((my - wrap(offset.y, hexVert) - rowOffset) / hexVert);
      } else if (isTri) {
        const halfW = squareSize / 2;
        col = Math.round((mx - wrap(offset.x, halfW)) / halfW);
        row = Math.floor((my - wrap(offset.y, squareSize)) / squareSize);
      } else if (shape === "circle") {
        col = Math.round((mx - wrap(offset.x, squareSize)) / squareSize);
        row = Math.round((my - wrap(offset.y, squareSize)) / squareSize);
      } else {
        col = Math.floor((mx - wrap(offset.x, squareSize)) / squareSize);
        row = Math.floor((my - wrap(offset.y, squareSize)) / squareSize);
      }
      if (!hovered || hovered.x !== col || hovered.y !== row) {
        if (hovered && hoverTrailAmount > 0) {
          trail = [{ ...hovered }, ...trail].slice(0, hoverTrailAmount);
        }
        hovered = { x: col, y: row };
      }
    };

    const onVisibility = () => (document.hidden ? pause() : play());

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (visible) play();
        else pause();
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) draw();
    else play();

    return () => {
      pause();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [borderColor, direction, hoverFillColor, hoverTrailAmount, shape, speed, squareSize]);

  return <canvas ref={canvasRef} aria-hidden className={cn("block h-full w-full", className)} />;
}
