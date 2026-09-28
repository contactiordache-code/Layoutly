"use client";
/*
 * The "Style" view: the DefaultSwapy bento layout (components/ui/default-swapy.tsx) — same grid,
 * same card designs, same drag-to-swap behaviour — filled with the design tokens of the site the
 * user is inspecting instead of demo content.
 */
import { SwapyItem, SwapyLayout, SwapySlot } from "@/components/ui/default-swapy-utils/swapy";
import { Droplet, PlusCircle } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { type SlotItemMapArray, utils } from "swapy";

export type SiteStyle = {
  host: string;
  title: string;
  background: string;
  colors: { value: string; count: number; usage: string[] }[];
  fonts: { family: string; stack: string; count: number; weights: string[] }[];
  fontSizes: { size: string; count: number; lineHeight: string; weight: string }[];
  radii: { value: string; count: number }[];
  shadows: { value: string; count: number }[];
  variables: { name: string; value: string }[];
};

export type StyleTokens = {
  colors: { name: string; value: string }[];
};

export type StyleBoardProps = {
  style: SiteStyle;
  tokens: StyleTokens;
  onCopy: (text: string, label: string) => void;
};

// ---------- Color helpers ----------

function rgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string) {
  const c = rgb(hex);
  if (!c) return 0.5;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Readable text color on top of `bg`. */
function on(bg: string) {
  return luminance(bg) > 0.4 ? "#0a0a0a" : "#fafafa";
}

function faded(color: string, alpha: number) {
  const c = rgb(color);
  return c ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})` : color;
}

function px(size: string) {
  return Math.round(parseFloat(size) || 0);
}

// ---------- Board data ----------

type Board = ReturnType<typeof useBoard>;

function useBoard({ style, tokens }: StyleBoardProps) {
  return useMemo(() => {
    const named = (name: string) => tokens.colors.find((c) => c.name === name)?.value;
    const palette = tokens.colors.map((c) => c.value);
    const nonBg = palette.filter((c) => c !== style.background);
    const neutrals = tokens.colors.filter((c) => c.name.startsWith("neutral")).map((c) => c.value);
    const accents = tokens.colors.filter((c) => c.name === "primary" || c.name.startsWith("accent")).map((c) => c.value);

    const background = style.background || "#ffffff";
    const text = named("text") || on(background);
    const primary = named("primary") || nonBg[0] || text;
    const accent = accents[1] || accents[0] || nonBg[1] || primary;
    const accent2 = accents[2] || nonBg[2] || accent;
    const light = [...palette].sort((a, b) => luminance(b) - luminance(a))[0] || "#ffffff";
    const dark = [...palette].sort((a, b) => luminance(a) - luminance(b))[0] || "#0a0a0a";

    const body = style.fonts[0];
    const heading = style.fonts[1] || style.fonts[0];
    const base = [...style.fontSizes].sort((a, b) => b.count - a.count)[0];
    const largest = style.fontSizes[0];

    return {
      host: style.host,
      background,
      text,
      primary,
      accent,
      accent2,
      light,
      dark,
      soft: neutrals[0] || faded(primary, 0.15),
      palette,
      body,
      heading,
      base,
      largest,
      sizes: style.fontSizes,
      radii: style.radii,
      shadows: style.shadows,
      variables: style.variables.length,
    };
  }, [style, tokens]);
}

type CardProps = { b: Board; onCopy: StyleBoardProps["onCopy"] };

function Copyable({ value, label, onCopy, className, style, children, title }: {
  value: string;
  label: string;
  onCopy: StyleBoardProps["onCopy"];
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      title={title || `Copy ${value}`}
      // Swapy starts a drag on pointerdown; let clicks through without starting one.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onCopy(value, label)}
    >
      {children}
    </button>
  );
}

// ---------- Cards (designs from DefaultSwapy) ----------

export function PrimaryColorCard({ b, onCopy }: CardProps) {
  const fg = on(b.primary);
  return (
    <div className="rounded-xl h-full p-6 flex flex-col justify-center items-center text-center shadow-md" style={{ background: b.primary, color: fg }}>
      <div className="flex gap-2">
        <Copyable value={b.primary} label="Primary color" onCopy={onCopy} className="2xl:text-5xl text-3xl font-bold mb-2 uppercase">
          {b.primary}
        </Copyable>
        <div className="flex items-center gap-1 mb-1">
          <span className="text-xl">
            <Droplet style={{ fill: fg }} size={24} />
          </span>
        </div>
      </div>
      <p className="font-medium">Primary color</p>
      <p className="text-sm" style={{ opacity: 0.8 }}>
        most used accent
      </p>
    </div>
  );
}

export function ColorCountCard({ b }: CardProps) {
  const bg = b.dark;
  return (
    <div className="rounded-xl h-full p-6 flex flex-col justify-center shadow-md" style={{ background: bg, color: on(bg) }}>
      <p className="mb-1 font-medium">Colors</p>
      <h2 className="2xl:text-6xl text-4xl font-bold leading-none">{b.palette.length}</h2>
      <p className="font-medium mt-2" style={{ color: b.accent !== bg ? b.accent : b.primary }}>
        +{b.variables} CSS variables
      </p>
    </div>
  );
}

export function HeadingFontCard({ b, onCopy }: CardProps) {
  const bg = b.accent;
  return (
    <div className="rounded-xl h-full p-6 flex flex-col justify-between relative shadow-md" style={{ background: bg, color: on(bg) }}>
      <p className="text-sm font-medium" style={{ opacity: 0.8 }}>
        Heading font
      </p>
      {b.heading ? (
        <Copyable value={b.heading.stack} label="Font stack" onCopy={onCopy} className="text-left" title="Copy font stack">
          <p className="text-2xl font-bold" style={{ fontFamily: b.heading.stack }}>
            {b.heading.family}
          </p>
          <p className="text-2xl font-bold" style={{ fontFamily: b.heading.stack }}>
            Aa Bb Cc 123
          </p>
        </Copyable>
      ) : (
        <p className="text-2xl font-bold">No text found</p>
      )}
    </div>
  );
}

export function TypeScaleCard({ b }: CardProps) {
  const bg = b.light;
  const fg = on(bg);
  return (
    <div className="rounded-xl p-6 h-full flex flex-col justify-between relative overflow-hidden shadow-md" style={{ background: bg, color: fg }}>
      <div className="font-medium px-4 py-2 rounded-xl inline-block mb-4 max-w-fit" style={{ background: faded(b.primary, 0.25), color: fg }}>
        Type scale · {b.sizes.map((s) => px(s.size)).join(" / ")}
      </div>
      <div>
        <p className="font-bold">Base text size</p>
        <div className="flex items-end gap-2">
          <span className="text-6xl font-bold">{b.base ? px(b.base.size) : "–"}</span>
          <span className="font-medium mb-1" style={{ color: b.primary !== bg ? b.primary : fg }}>
            px · largest {b.largest ? px(b.largest.size) : "–"}px
          </span>
        </div>
      </div>
    </div>
  );
}

export function SiteLogoCard({ b }: CardProps) {
  const [c1, c2, c3] = [b.primary, b.accent, b.accent2];
  return (
    <div className="rounded-xl h-full p-6 flex flex-col items-center justify-center shadow-md" style={{ background: b.background, color: b.text }}>
      <div className="w-16 h-16 mb-4">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="33" cy="33" r="25" fill={c1} />
          <circle cx="67" cy="33" r="25" fill={c2} />
          <circle cx="50" cy="67" r="25" fill={c3} />
        </svg>
      </div>
      <h2 className="2xl:text-3xl text-xl font-bold">{b.host}</h2>
    </div>
  );
}

export function BodyFontCard({ b, onCopy }: CardProps) {
  const bg = b.soft;
  const fg = on(bg);
  return (
    <div className="rounded-xl h-full p-6 col-span-1 shadow-md" style={{ background: bg, color: fg }}>
      <h2 className="text-3xl font-bold mb-1">Font</h2>
      <p className="mb-6" style={{ opacity: 0.8, fontFamily: b.body?.stack }}>
        {b.body ? `${b.body.family} · ${b.body.weights.join(" ")}` : "—"}
      </p>

      <div className="flex gap-3 mt-4">
        {b.palette.slice(0, 4).map((c) => (
          <Copyable key={c} value={c} label={c} onCopy={onCopy} className="w-12 h-12 rounded-md" style={{ background: c, boxShadow: `inset 0 0 0 1px ${faded(fg, 0.15)}` }} />
        ))}
      </div>
    </div>
  );
}

export function RadiusCard({ b, onCopy }: CardProps) {
  const bg = b.accent2;
  const [r1, r2] = [b.radii[0]?.value || "0px", b.radii[1]?.value || b.radii[0]?.value || "0px"];
  return (
    <div className="rounded-xl h-full p-4 relative overflow-hidden shadow-md" style={{ background: bg }}>
      <div className="text-lg font-medium px-4 py-2 rounded-lg inline-block mb-4 w-full" style={{ background: b.dark, color: on(b.dark) }}>
        <p>Border radius</p>
        <p>{b.radii.length ? b.radii.map((r) => r.value).join(" · ") : "none"}</p>
        <p style={{ opacity: 0.7 }}>{b.radii.length} values</p>
      </div>
      <div className="flex gap-2 h-20">
        <Copyable value={r1} label="Radius" onCopy={onCopy} className="w-full overflow-hidden" style={{ borderRadius: r1, background: b.primary }} />
        <Copyable value={r2} label="Radius" onCopy={onCopy} className="w-full overflow-hidden ml-4" style={{ borderRadius: r2, background: b.light }} />
      </div>
    </div>
  );
}

export function PaletteCard({ b, onCopy }: CardProps) {
  const bg = b.primary;
  const fg = on(bg);
  const shown = b.palette.slice(0, 4);
  return (
    <div className="rounded-xl h-full p-4 flex flex-col justify-center items-center shadow-lg" style={{ background: bg, color: fg }}>
      <h3 className="text-2xl font-bold mb-2">Palette</h3>
      <p className="text-3xl font-bold mb-4">{b.palette.length} colors</p>

      <div className="flex -space-x-2 mb-4">
        {shown.map((c) => (
          <Copyable key={c} value={c} label={c} onCopy={onCopy} className="w-10 h-10 rounded-xl overflow-hidden border-2" style={{ background: c, borderColor: bg }} />
        ))}
        <div className="w-10 h-10 rounded-xl border-2 flex items-center justify-center" style={{ background: b.accent, borderColor: bg, color: on(b.accent) }}>
          <PlusCircle className="w-5 h-5" />
        </div>
      </div>

      <p className="text-sm">Click any color to copy it</p>
    </div>
  );
}

export function ShadowCard({ b, onCopy }: CardProps) {
  const bg = b.soft;
  const fg = on(bg);
  const shadow = b.shadows[0]?.value;
  return (
    <div className="rounded-xl h-full p-6 shadow-lg" style={{ background: bg, color: fg }}>
      <h3 className="text-xl font-bold mb-4">Shadows</h3>
      <h2 className="text-3xl font-bold mb-6">{b.shadows.length ? `${b.shadows.length} found` : "Flat design"}</h2>

      <Copyable
        value={shadow || "none"}
        label="Shadow"
        onCopy={onCopy}
        className="w-full rounded-lg p-4 text-left"
        style={{ background: b.dark, color: on(b.dark), boxShadow: shadow }}
      >
        <div className="flex justify-between text-sm mb-2">
          <span>Shadow</span>
          <span>Radius</span>
        </div>
        <div className="flex justify-between font-medium gap-4">
          <span className="truncate">{shadow || "none"}</span>
          <span>{b.radii[0]?.value || "0px"}</span>
        </div>
      </Copyable>
    </div>
  );
}

// ---------- Layout (same grid and spans as DefaultSwapy) ----------

type Item = {
  id: string;
  title: string;
  Widget: (props: CardProps) => ReactNode;
  className?: string;
};

const items: Item[] = [
  { id: "1", title: "Primary", Widget: PrimaryColorCard, className: "lg:col-span-4 sm:col-span-7 col-span-12" },
  { id: "2", title: "Colors", Widget: ColorCountCard, className: "lg:col-span-3 sm:col-span-5 col-span-12" },
  { id: "3", title: "Heading font", Widget: HeadingFontCard, className: "lg:col-span-5 sm:col-span-5 col-span-12" },
  { id: "4", title: "Type scale", Widget: TypeScaleCard, className: "lg:col-span-5 sm:col-span-7 col-span-12" },
  { id: "5", title: "Site", Widget: SiteLogoCard, className: "lg:col-span-4 sm:col-span-6 col-span-12" },
  { id: "6", title: "Font", Widget: BodyFontCard, className: "lg:col-span-3 sm:col-span-6 col-span-12" },
  { id: "7", title: "Radius", Widget: RadiusCard, className: "lg:col-span-4 sm:col-span-5 col-span-12" },
  { id: "8", title: "Palette", Widget: PaletteCard, className: "lg:col-span-4 sm:col-span-7 col-span-12" },
  { id: "9", title: "Shadows", Widget: ShadowCard, className: "lg:col-span-4 sm:col-span-12 col-span-12" },
];

export default function SiteStyleBoard(props: StyleBoardProps) {
  const b = useBoard(props);
  const [slotItemMap] = useState<SlotItemMapArray>(utils.initSlotItemMap(items, "id"));
  const slottedItems = useMemo(() => utils.toSlottedItems(items, "id", slotItemMap), [slotItemMap]);

  return (
    <SwapyLayout id="swapy" className="w-full layoutly-board" config={{ swapMode: "hover" }}>
      <div className="grid w-full grid-cols-12 gap-2 md:gap-6 py-4">
        {slottedItems.map(({ slotId, itemId }) => {
          const item = items.find((i) => i.id === itemId);
          if (!item) return null;
          const { Widget } = item;
          return (
            <SwapySlot key={slotId} className={`swapyItem rounded-lg h-64 ${item.className}`} id={slotId}>
              <SwapyItem id={itemId} className="relative rounded-lg w-full h-full 2xl:text-xl text-sm" key={itemId}>
                <Widget b={b} onCopy={props.onCopy} />
              </SwapyItem>
            </SwapySlot>
          );
        })}
      </div>
    </SwapyLayout>
  );
}
