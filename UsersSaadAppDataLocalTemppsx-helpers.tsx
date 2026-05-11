import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/chartHelpers.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=c201f403"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("C:/dev/psx/src/chartHelpers.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$(), _s2 = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=c201f403"; const useEffect = __vite__cjsImport3_react["useEffect"]; const useRef = __vite__cjsImport3_react["useRef"]; const useState = __vite__cjsImport3_react["useState"]; const useCallback = __vite__cjsImport3_react["useCallback"];
export function useResizeObserver() {
  _s();
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setSize({ width: cr.width, height: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}
_s(useResizeObserver, "RDbIYTNa0/5j2rWmW9M9BL7GUPs=");
export function useChartHover(args) {
  _s2();
  const { pointCount, plotLeft, plotRight, viewBoxWidth } = args;
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const compute = useCallback(
    (clientX, clientY) => {
      const svg = svgRef.current;
      const container = containerRef.current;
      if (!svg || !container || pointCount < 1) return null;
      const svgRect = svg.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (svgRect.width === 0) return null;
      const localX = clientX - svgRect.left;
      const localY = clientY - svgRect.top;
      const svgX = localX / svgRect.width * viewBoxWidth;
      const innerLeft = plotLeft;
      const innerRight = viewBoxWidth - plotRight;
      const innerWidth = innerRight - innerLeft;
      if (innerWidth <= 0) return null;
      const clamped = Math.min(innerRight, Math.max(innerLeft, svgX));
      const frac = (clamped - innerLeft) / innerWidth;
      const index = Math.max(
        0,
        Math.min(pointCount - 1, Math.round(frac * (pointCount - 1)))
      );
      const targetSvgX = innerLeft + index / Math.max(1, pointCount - 1) * innerWidth;
      const svgYHeight = svgRect.height;
      const svgYPos = localY / svgRect.height * (svgYHeight || 1);
      return {
        index,
        svgX: targetSvgX,
        svgY: svgYPos,
        containerX: clientX - containerRect.left,
        containerY: clientY - containerRect.top
      };
    },
    [pointCount, plotLeft, plotRight, viewBoxWidth]
  );
  const handlers = {
    onPointerMove: (e) => {
      const next = compute(e.clientX, e.clientY);
      if (next) setHover(next);
    },
    onPointerLeave: () => setHover(null),
    onPointerDown: (e) => {
      const next = compute(e.clientX, e.clientY);
      if (next) setHover(next);
    }
  };
  return { containerRef, svgRef, hover, handlers };
}
_s2(useChartHover, "/KqhfhM2+k2SsrAHialSTFrIbL8=");
export function ChartTooltip({
  x,
  y,
  containerWidth,
  title,
  rows
}) {
  const ESTIMATED_WIDTH = 200;
  const flipLeft = x + ESTIMATED_WIDTH + 24 > containerWidth;
  const style = {
    position: "absolute",
    top: Math.max(8, y - 12),
    left: flipLeft ? void 0 : x + 16,
    right: flipLeft ? containerWidth - x + 16 : void 0,
    pointerEvents: "none"
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "chart-tooltip", style, role: "tooltip", children: [
    title ? /* @__PURE__ */ jsxDEV("div", { className: "chart-tooltip-title", children: title }, void 0, false, {
      fileName: "C:/dev/psx/src/chartHelpers.tsx",
      lineNumber: 149,
      columnNumber: 16
    }, this) : null,
    rows.map(
      (row, i) => /* @__PURE__ */ jsxDEV("div", { className: "chart-tooltip-row", children: [
        /* @__PURE__ */ jsxDEV("span", { className: "chart-tooltip-row-left", children: [
          row.color ? /* @__PURE__ */ jsxDEV(
            "span",
            {
              className: "chart-tooltip-swatch",
              style: { background: row.color }
            },
            void 0,
            false,
            {
              fileName: "C:/dev/psx/src/chartHelpers.tsx",
              lineNumber: 154,
              columnNumber: 11
            },
            this
          ) : null,
          /* @__PURE__ */ jsxDEV("span", { children: row.label }, void 0, false, {
            fileName: "C:/dev/psx/src/chartHelpers.tsx",
            lineNumber: 159,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/chartHelpers.tsx",
          lineNumber: 152,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "chart-tooltip-row-value", children: row.value }, void 0, false, {
          fileName: "C:/dev/psx/src/chartHelpers.tsx",
          lineNumber: 161,
          columnNumber: 11
        }, this)
      ] }, `${row.label}-${i}`, true, {
        fileName: "C:/dev/psx/src/chartHelpers.tsx",
        lineNumber: 151,
        columnNumber: 7
      }, this)
    )
  ] }, void 0, true, {
    fileName: "C:/dev/psx/src/chartHelpers.tsx",
    lineNumber: 148,
    columnNumber: 5
  }, this);
}
_c = ChartTooltip;
export function buildCatmullRomPath(points) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}
export function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min];
  }
  const range = max - min;
  const rough = range / count;
  const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow10;
  let step;
  if (norm >= 7.5) step = 10 * pow10;
  else if (norm >= 3) step = 5 * pow10;
  else if (norm >= 1.5) step = 2 * pow10;
  else
    step = pow10;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}
var _c;
$RefreshReg$(_c, "ChartTooltip");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/dev/psx/src/chartHelpers.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/dev/psx/src/chartHelpers.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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SUFBSUosU0FBU0ksS0FBS0gsVUFBVUYsT0FBTyxHQUFHSyxLQUFLTCxNQUFNO0FBQ3hESSxVQUFNRSxLQUFLZixPQUFPYyxFQUFFRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0FBQUEsRUFDbEM7QUFDQSxTQUFPSDtBQUNUO0FBQUMsSUFBQTVCO0FBQUEsYUFBQUEsSUFBQSIsIm5hbWVzIjpbInVzZUVmZmVjdCIsInVzZVJlZiIsInVzZVN0YXRlIiwidXNlQ2FsbGJhY2siLCJ1c2VSZXNpemVPYnNlcnZlciIsIl9zIiwicmVmIiwic2l6ZSIsInNldFNpemUiLCJ3aWR0aCIsImhlaWdodCIsImVsIiwiY3VycmVudCIsInJvIiwiUmVzaXplT2JzZXJ2ZXIiLCJlbnRyaWVzIiwiZW50cnkiLCJjciIsImNvbnRlbnRSZWN0Iiwib2JzZXJ2ZSIsImRpc2Nvbm5lY3QiLCJ1c2VDaGFydEhvdmVyIiwiYXJncyIsIl9zMiIsInBvaW50Q291bnQiLCJwbG90TGVmdCIsInBsb3RSaWdodCIsInZpZXdCb3hXaWR0aCIsImNvbnRhaW5lclJlZiIsInN2Z1JlZiIsImhvdmVyIiwic2V0SG92ZXIiLCJjb21wdXRlIiwiY2xpZW50WCIsImNsaWVudFkiLCJzdmciLCJjb250YWluZXIiLCJzdmdSZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiY29udGFpbmVyUmVjdCIsImxvY2FsWCIsImxlZnQiLCJsb2NhbFkiLCJ0b3AiLCJzdmdYIiwiaW5uZXJMZWZ0IiwiaW5uZXJSaWdodCIsImlubmVyV2lkdGgiLCJjbGFtcGVkIiwiTWF0aCIsIm1pbiIsIm1heCIsImZyYWMiLCJpbmRleCIsInJvdW5kIiwidGFyZ2V0U3ZnWCIsInN2Z1lIZWlnaHQiLCJzdmdZUG9zIiwic3ZnWSIsImNvbnRhaW5lclgiLCJjb250YWluZXJZIiwiaGFuZGxlcnMiLCJvblBvaW50ZXJNb3ZlIiwiZSIsIm5leHQiLCJvblBvaW50ZXJMZWF2ZSIsIm9uUG9pbnRlckRvd24iLCJDaGFydFRvb2x0aXAiLCJ4IiwieSIsImNvbnRhaW5lcldpZHRoIiwidGl0bGUiLCJyb3dzIiwiRVNUSU1BVEVEX1dJRFRIIiwiZmxpcExlZnQiLCJzdHlsZSIsInBvc2l0aW9uIiwidW5kZWZpbmVkIiwicmlnaHQiLCJwb2ludGVyRXZlbnRzIiwibWFwIiwicm93IiwiaSIsImNvbG9yIiwiYmFja2dyb3VuZCIsImxhYmVsIiwidmFsdWUiLCJfYyIsImJ1aWxkQ2F0bXVsbFJvbVBhdGgiLCJwb2ludHMiLCJsZW5ndGgiLCJkIiwicDAiLCJwMSIsInAyIiwicDMiLCJjcDF4IiwiY3AxeSIsImNwMngiLCJjcDJ5IiwibmljZVRpY2tzIiwiY291bnQiLCJOdW1iZXIiLCJpc0Zpbml0ZSIsInJhbmdlIiwicm91Z2giLCJwb3cxMCIsInBvdyIsImZsb29yIiwibG9nMTAiLCJub3JtIiwic3RlcCIsIm5pY2VNaW4iLCJuaWNlTWF4IiwiY2VpbCIsInRpY2tzIiwidiIsInB1c2giLCJ0b0ZpeGVkIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbImNoYXJ0SGVscGVycy50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VSZWYsIHVzZVN0YXRlLCB1c2VDYWxsYmFjayB9IGZyb20gXCJyZWFjdFwiO1xuaW1wb3J0IHR5cGUgUmVhY3QgZnJvbSBcInJlYWN0XCI7XG5cbmV4cG9ydCB0eXBlIFNpemUgPSB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH07XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VSZXNpemVPYnNlcnZlcjxUIGV4dGVuZHMgSFRNTEVsZW1lbnQ+KCk6IHtcbiAgcmVmOiBSZWFjdC5SZWZPYmplY3Q8VCB8IG51bGw+O1xuICBzaXplOiBTaXplO1xufSB7XG4gIGNvbnN0IHJlZiA9IHVzZVJlZjxUIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtzaXplLCBzZXRTaXplXSA9IHVzZVN0YXRlPFNpemU+KHsgd2lkdGg6IDAsIGhlaWdodDogMCB9KTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGVsID0gcmVmLmN1cnJlbnQ7XG4gICAgaWYgKCFlbCkgcmV0dXJuO1xuICAgIGNvbnN0IHJvID0gbmV3IFJlc2l6ZU9ic2VydmVyKChlbnRyaWVzKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICAgICAgY29uc3QgY3IgPSBlbnRyeS5jb250ZW50UmVjdDtcbiAgICAgICAgc2V0U2l6ZSh7IHdpZHRoOiBjci53aWR0aCwgaGVpZ2h0OiBjci5oZWlnaHQgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcm8ub2JzZXJ2ZShlbCk7XG4gICAgcmV0dXJuICgpID0+IHJvLmRpc2Nvbm5lY3QoKTtcbiAgfSwgW10pO1xuXG4gIHJldHVybiB7IHJlZiwgc2l6ZSB9O1xufVxuXG5leHBvcnQgdHlwZSBIb3ZlckluZm8gPSB7XG4gIGluZGV4OiBudW1iZXI7XG4gIHN2Z1g6IG51bWJlcjtcbiAgc3ZnWTogbnVtYmVyO1xuICBjb250YWluZXJYOiBudW1iZXI7XG4gIGNvbnRhaW5lclk6IG51bWJlcjtcbn07XG5cbnR5cGUgVXNlQ2hhcnRIb3ZlckFyZ3MgPSB7XG4gIHBvaW50Q291bnQ6IG51bWJlcjtcbiAgcGxvdExlZnQ6IG51bWJlcjtcbiAgcGxvdFJpZ2h0OiBudW1iZXI7XG4gIHZpZXdCb3hXaWR0aDogbnVtYmVyO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUNoYXJ0SG92ZXIoYXJnczogVXNlQ2hhcnRIb3ZlckFyZ3MpIHtcbiAgY29uc3QgeyBwb2ludENvdW50LCBwbG90TGVmdCwgcGxvdFJpZ2h0LCB2aWV3Qm94V2lkdGggfSA9IGFyZ3M7XG4gIGNvbnN0IGNvbnRhaW5lclJlZiA9IHVzZVJlZjxIVE1MRGl2RWxlbWVudCB8IG51bGw+KG51bGwpO1xuICBjb25zdCBzdmdSZWYgPSB1c2VSZWY8U1ZHU1ZHRWxlbWVudCB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbaG92ZXIsIHNldEhvdmVyXSA9IHVzZVN0YXRlPEhvdmVySW5mbyB8IG51bGw+KG51bGwpO1xuXG4gIGNvbnN0IGNvbXB1dGUgPSB1c2VDYWxsYmFjayhcbiAgICAoY2xpZW50WDogbnVtYmVyLCBjbGllbnRZOiBudW1iZXIpOiBIb3ZlckluZm8gfCBudWxsID0+IHtcbiAgICAgIGNvbnN0IHN2ZyA9IHN2Z1JlZi5jdXJyZW50O1xuICAgICAgY29uc3QgY29udGFpbmVyID0gY29udGFpbmVyUmVmLmN1cnJlbnQ7XG4gICAgICBpZiAoIXN2ZyB8fCAhY29udGFpbmVyIHx8IHBvaW50Q291bnQgPCAxKSByZXR1cm4gbnVsbDtcbiAgICAgIGNvbnN0IHN2Z1JlY3QgPSBzdmcuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICBjb25zdCBjb250YWluZXJSZWN0ID0gY29udGFpbmVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaWYgKHN2Z1JlY3Qud2lkdGggPT09IDApIHJldHVybiBudWxsO1xuICAgICAgY29uc3QgbG9jYWxYID0gY2xpZW50WCAtIHN2Z1JlY3QubGVmdDtcbiAgICAgIGNvbnN0IGxvY2FsWSA9IGNsaWVudFkgLSBzdmdSZWN0LnRvcDtcbiAgICAgIGNvbnN0IHN2Z1ggPSAobG9jYWxYIC8gc3ZnUmVjdC53aWR0aCkgKiB2aWV3Qm94V2lkdGg7XG4gICAgICBjb25zdCBpbm5lckxlZnQgPSBwbG90TGVmdDtcbiAgICAgIGNvbnN0IGlubmVyUmlnaHQgPSB2aWV3Qm94V2lkdGggLSBwbG90UmlnaHQ7XG4gICAgICBjb25zdCBpbm5lcldpZHRoID0gaW5uZXJSaWdodCAtIGlubmVyTGVmdDtcbiAgICAgIGlmIChpbm5lcldpZHRoIDw9IDApIHJldHVybiBudWxsO1xuICAgICAgY29uc3QgY2xhbXBlZCA9IE1hdGgubWluKGlubmVyUmlnaHQsIE1hdGgubWF4KGlubmVyTGVmdCwgc3ZnWCkpO1xuICAgICAgY29uc3QgZnJhYyA9IChjbGFtcGVkIC0gaW5uZXJMZWZ0KSAvIGlubmVyV2lkdGg7XG4gICAgICBjb25zdCBpbmRleCA9IE1hdGgubWF4KFxuICAgICAgICAwLFxuICAgICAgICBNYXRoLm1pbihwb2ludENvdW50IC0gMSwgTWF0aC5yb3VuZChmcmFjICogKHBvaW50Q291bnQgLSAxKSkpLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IHRhcmdldFN2Z1ggPSBpbm5lckxlZnQgKyAoaW5kZXggLyBNYXRoLm1heCgxLCBwb2ludENvdW50IC0gMSkpICogaW5uZXJXaWR0aDtcbiAgICAgIGNvbnN0IHN2Z1lIZWlnaHQgPSBzdmdSZWN0LmhlaWdodDtcbiAgICAgIGNvbnN0IHN2Z1lQb3MgPSAobG9jYWxZIC8gc3ZnUmVjdC5oZWlnaHQpICogKHN2Z1lIZWlnaHQgfHwgMSk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBpbmRleCxcbiAgICAgICAgc3ZnWDogdGFyZ2V0U3ZnWCxcbiAgICAgICAgc3ZnWTogc3ZnWVBvcyxcbiAgICAgICAgY29udGFpbmVyWDogY2xpZW50WCAtIGNvbnRhaW5lclJlY3QubGVmdCxcbiAgICAgICAgY29udGFpbmVyWTogY2xpZW50WSAtIGNvbnRhaW5lclJlY3QudG9wLFxuICAgICAgfTtcbiAgICB9LFxuICAgIFtwb2ludENvdW50LCBwbG90TGVmdCwgcGxvdFJpZ2h0LCB2aWV3Qm94V2lkdGhdLFxuICApO1xuXG4gIGNvbnN0IGhhbmRsZXJzID0ge1xuICAgIG9uUG9pbnRlck1vdmU6IChlOiBSZWFjdC5Qb2ludGVyRXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IG5leHQgPSBjb21wdXRlKGUuY2xpZW50WCwgZS5jbGllbnRZKTtcbiAgICAgIGlmIChuZXh0KSBzZXRIb3ZlcihuZXh0KTtcbiAgICB9LFxuICAgIG9uUG9pbnRlckxlYXZlOiAoKSA9PiBzZXRIb3ZlcihudWxsKSxcbiAgICBvblBvaW50ZXJEb3duOiAoZTogUmVhY3QuUG9pbnRlckV2ZW50KSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gY29tcHV0ZShlLmNsaWVudFgsIGUuY2xpZW50WSk7XG4gICAgICBpZiAobmV4dCkgc2V0SG92ZXIobmV4dCk7XG4gICAgfSxcbiAgfTtcblxuICByZXR1cm4geyBjb250YWluZXJSZWYsIHN2Z1JlZiwgaG92ZXIsIGhhbmRsZXJzIH07XG59XG5cbmV4cG9ydCB0eXBlIFRvb2x0aXBSb3cgPSB7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHZhbHVlOiBzdHJpbmc7XG4gIGNvbG9yPzogc3RyaW5nO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIENoYXJ0VG9vbHRpcCh7XG4gIHgsXG4gIHksXG4gIGNvbnRhaW5lcldpZHRoLFxuICB0aXRsZSxcbiAgcm93cyxcbn06IHtcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIGNvbnRhaW5lcldpZHRoOiBudW1iZXI7XG4gIHRpdGxlPzogc3RyaW5nO1xuICByb3dzOiBUb29sdGlwUm93W107XG59KSB7XG4gIGNvbnN0IEVTVElNQVRFRF9XSURUSCA9IDIwMDtcbiAgY29uc3QgZmxpcExlZnQgPSB4ICsgRVNUSU1BVEVEX1dJRFRIICsgMjQgPiBjb250YWluZXJXaWR0aDtcbiAgY29uc3Qgc3R5bGU6IFJlYWN0LkNTU1Byb3BlcnRpZXMgPSB7XG4gICAgcG9zaXRpb246IFwiYWJzb2x1dGVcIixcbiAgICB0b3A6IE1hdGgubWF4KDgsIHkgLSAxMiksXG4gICAgbGVmdDogZmxpcExlZnQgPyB1bmRlZmluZWQgOiB4ICsgMTYsXG4gICAgcmlnaHQ6IGZsaXBMZWZ0ID8gY29udGFpbmVyV2lkdGggLSB4ICsgMTYgOiB1bmRlZmluZWQsXG4gICAgcG9pbnRlckV2ZW50czogXCJub25lXCIsXG4gIH07XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJjaGFydC10b29sdGlwXCIgc3R5bGU9e3N0eWxlfSByb2xlPVwidG9vbHRpcFwiPlxuICAgICAge3RpdGxlID8gPGRpdiBjbGFzc05hbWU9XCJjaGFydC10b29sdGlwLXRpdGxlXCI+e3RpdGxlfTwvZGl2PiA6IG51bGx9XG4gICAgICB7cm93cy5tYXAoKHJvdywgaSkgPT4gKFxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNoYXJ0LXRvb2x0aXAtcm93XCIga2V5PXtgJHtyb3cubGFiZWx9LSR7aX1gfT5cbiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJjaGFydC10b29sdGlwLXJvdy1sZWZ0XCI+XG4gICAgICAgICAgICB7cm93LmNvbG9yID8gKFxuICAgICAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImNoYXJ0LXRvb2x0aXAtc3dhdGNoXCJcbiAgICAgICAgICAgICAgICBzdHlsZT17eyBiYWNrZ3JvdW5kOiByb3cuY29sb3IgfX1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICkgOiBudWxsfVxuICAgICAgICAgICAgPHNwYW4+e3Jvdy5sYWJlbH08L3NwYW4+XG4gICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImNoYXJ0LXRvb2x0aXAtcm93LXZhbHVlXCI+e3Jvdy52YWx1ZX08L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKSl9XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZENhdG11bGxSb21QYXRoKHBvaW50czogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9W10pOiBzdHJpbmcge1xuICBpZiAocG9pbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFwiXCI7XG4gIGlmIChwb2ludHMubGVuZ3RoID09PSAxKSByZXR1cm4gYE0gJHtwb2ludHNbMF0ueH0gJHtwb2ludHNbMF0ueX1gO1xuICBsZXQgZCA9IGBNICR7cG9pbnRzWzBdLnh9ICR7cG9pbnRzWzBdLnl9YDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgY29uc3QgcDAgPSBwb2ludHNbaSAtIDFdID8/IHBvaW50c1tpXTtcbiAgICBjb25zdCBwMSA9IHBvaW50c1tpXTtcbiAgICBjb25zdCBwMiA9IHBvaW50c1tpICsgMV07XG4gICAgY29uc3QgcDMgPSBwb2ludHNbaSArIDJdID8/IHAyO1xuICAgIGNvbnN0IGNwMXggPSBwMS54ICsgKHAyLnggLSBwMC54KSAvIDY7XG4gICAgY29uc3QgY3AxeSA9IHAxLnkgKyAocDIueSAtIHAwLnkpIC8gNjtcbiAgICBjb25zdCBjcDJ4ID0gcDIueCAtIChwMy54IC0gcDEueCkgLyA2O1xuICAgIGNvbnN0IGNwMnkgPSBwMi55IC0gKHAzLnkgLSBwMS55KSAvIDY7XG4gICAgZCArPSBgIEMgJHtjcDF4fSAke2NwMXl9LCAke2NwMnh9ICR7Y3AyeX0sICR7cDIueH0gJHtwMi55fWA7XG4gIH1cbiAgcmV0dXJuIGQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuaWNlVGlja3MobWluOiBudW1iZXIsIG1heDogbnVtYmVyLCBjb3VudCA9IDUpOiBudW1iZXJbXSB7XG4gIGlmICghTnVtYmVyLmlzRmluaXRlKG1pbikgfHwgIU51bWJlci5pc0Zpbml0ZShtYXgpIHx8IG1pbiA9PT0gbWF4KSB7XG4gICAgcmV0dXJuIFttaW5dO1xuICB9XG4gIGNvbnN0IHJhbmdlID0gbWF4IC0gbWluO1xuICBjb25zdCByb3VnaCA9IHJhbmdlIC8gY291bnQ7XG4gIGNvbnN0IHBvdzEwID0gTWF0aC5wb3coMTAsIE1hdGguZmxvb3IoTWF0aC5sb2cxMChyb3VnaCkpKTtcbiAgY29uc3Qgbm9ybSA9IHJvdWdoIC8gcG93MTA7XG4gIGxldCBzdGVwOiBudW1iZXI7XG4gIGlmIChub3JtID49IDcuNSkgc3RlcCA9IDEwICogcG93MTA7XG4gIGVsc2UgaWYgKG5vcm0gPj0gMykgc3RlcCA9IDUgKiBwb3cxMDtcbiAgZWxzZSBpZiAobm9ybSA+PSAxLjUpIHN0ZXAgPSAyICogcG93MTA7XG4gIGVsc2Ugc3RlcCA9IHBvdzEwO1xuICBjb25zdCBuaWNlTWluID0gTWF0aC5mbG9vcihtaW4gLyBzdGVwKSAqIHN0ZXA7XG4gIGNvbnN0IG5pY2VNYXggPSBNYXRoLmNlaWwobWF4IC8gc3RlcCkgKiBzdGVwO1xuICBjb25zdCB0aWNrczogbnVtYmVyW10gPSBbXTtcbiAgZm9yIChsZXQgdiA9IG5pY2VNaW47IHYgPD0gbmljZU1heCArIHN0ZXAgLyAyOyB2ICs9IHN0ZXApIHtcbiAgICB0aWNrcy5wdXNoKE51bWJlcih2LnRvRml4ZWQoMTApKSk7XG4gIH1cbiAgcmV0dXJuIHRpY2tzO1xufVxuIl0sImZpbGUiOiJDOi9kZXYvcHN4L3NyYy9jaGFydEhlbHBlcnMudHN4In0=