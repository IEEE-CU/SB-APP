import { useState } from "react";
import { useThemeStore } from "@/store/themeStore";
import { Sun, Moon, Layers, Monitor, Palette } from "lucide-react";

// ─── Apple-style slider component ────────────────────────────────────────────
function GlassSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  leftLabel,
  rightLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  leftLabel?: string;
  rightLabel?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-body-sm font-medium text-ink">{label}</span>
        <span
          className="text-caption font-semibold text-primary tabular-nums px-2 py-0.5 rounded-md"
          style={{ background: "var(--color-primary-active)" + "22" }}
        >
          {value}%
        </span>
      </div>

      <div className="relative">
        {/* Track background */}
        <div className="relative h-[6px] rounded-full bg-white/10 dark:bg-white/8 overflow-visible">
          {/* Filled portion */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-75"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, var(--color-primary-active), var(--color-primary))",
            }}
          />

          {/* Thumb */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.3)] border border-white/30 transition-all duration-75 ${
              isDragging ? "scale-110 shadow-[0_2px_20px_rgba(0,0,0,0.45)]" : ""
            }`}
            style={{ left: `${pct}%` }}
          />
        </div>

        {/* Invisible range input on top for interaction */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ WebkitAppearance: "none" }}
          aria-label={label}
        />
      </div>

      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-[11px] text-ink-faint font-medium">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

// ─── Settings section wrapper ─────────────────────────────────────────────────
function SettingSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 dark:border-white/8 bg-white/5 dark:bg-white/5 backdrop-blur-sm overflow-hidden">
      {/* Section header */}
      <div className="px-6 py-4 border-b border-white/8 dark:border-white/6 flex items-center gap-2.5">
        <Icon size={16} className="text-primary" />
        <h2 className="text-body-sm font-semibold text-ink tracking-tight">
          {title}
        </h2>
      </div>
      <div className="divide-y divide-white/8 dark:divide-white/6">
        {children}
      </div>
    </section>
  );
}

// ─── Settings row wrapper ─────────────────────────────────────────────────────
function SettingRow({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-5">{children}</div>;
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const { darkMode, toggleDarkMode, uiOpacity, setUiOpacity } = useThemeStore();

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Page heading */}
      <div className="space-y-1">
        <h1 className="text-heading-2 font-bold text-ink tracking-tight">
          Settings
        </h1>
        <p className="text-body-sm text-ink-muted">
          Customize your IEEE Finance Pro experience.
        </p>
      </div>

      {/* ── Appearance ── */}
      <SettingSection icon={Palette} title="Appearance">
        {/* Theme toggle */}
        <SettingRow>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-body-sm font-medium text-ink">Color Theme</p>
              <p className="text-caption text-ink-muted">
                Switch between light and dark mode.
              </p>
            </div>
            {/* Segmented toggle — Apple style */}
            <div className="flex items-center rounded-xl bg-white/8 dark:bg-white/8 border border-white/10 p-1 gap-1 flex-shrink-0">
              <button
                onClick={() => darkMode && toggleDarkMode()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-semibold transition-all duration-200 ${
                  !darkMode
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
                aria-pressed={!darkMode}
              >
                <Sun size={13} />
                Light
              </button>
              <button
                onClick={() => !darkMode && toggleDarkMode()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-semibold transition-all duration-200 ${
                  darkMode
                    ? "bg-white/15 text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
                aria-pressed={darkMode}
              >
                <Moon size={13} />
                Dark
              </button>
            </div>
          </div>
        </SettingRow>
      </SettingSection>

      {/* ── Interface ── */}
      <SettingSection icon={Layers} title="Interface Glass">
        <SettingRow>
          <div className="space-y-5">
            <div className="space-y-1">
              <p className="text-body-sm font-medium text-ink">
                Sidebar & Header Opacity
              </p>
              <p className="text-caption text-ink-muted">
                Control how transparent the sidebar and top bar are. Lower
                values give a frosted-glass look; higher values are more solid.
              </p>
            </div>

            {/* Live preview strip */}
            <div
              className="h-12 rounded-xl border border-white/10 flex items-center justify-center transition-all duration-150 relative overflow-hidden"
              style={{
                backgroundColor: `color-mix(in srgb, var(--color-surface) ${uiOpacity}%, transparent)`,
                backdropFilter: "blur(20px)",
              }}
            >
              <span className="text-caption text-ink-muted font-medium select-none z-10">
                Live preview — {uiOpacity}% opaque
              </span>
              {/* Checkerboard pattern to show transparency */}
              <div
                className="absolute inset-0 -z-0 opacity-20"
                style={{
                  backgroundImage:
                    "repeating-conic-gradient(#888 0% 25%, transparent 0% 50%)",
                  backgroundSize: "16px 16px",
                }}
              />
            </div>

            <GlassSlider
              value={uiOpacity}
              onChange={setUiOpacity}
              label="Opacity"
              leftLabel="Ghost (0%)"
              rightLabel="Solid (100%)"
            />
          </div>
        </SettingRow>
      </SettingSection>

      {/* ── Display ── */}
      <SettingSection icon={Monitor} title="Display">
        <SettingRow>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-body-sm font-medium text-ink">Reduce Motion</p>
              <p className="text-caption text-ink-muted">
                Coming soon — follows your OS accessibility preference.
              </p>
            </div>
            <div className="px-3 py-1 rounded-full text-[11px] font-semibold text-ink-muted bg-white/5 border border-white/10">
              Soon
            </div>
          </div>
        </SettingRow>
        <SettingRow>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-body-sm font-medium text-ink">Compact Mode</p>
              <p className="text-caption text-ink-muted">
                Coming soon — tighter spacing for power users.
              </p>
            </div>
            <div className="px-3 py-1 rounded-full text-[11px] font-semibold text-ink-muted bg-white/5 border border-white/10">
              Soon
            </div>
          </div>
        </SettingRow>
      </SettingSection>
    </div>
  );
}
