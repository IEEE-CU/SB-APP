import { create } from "zustand";

interface ThemeState {
  darkMode: boolean;
  /** 0–100: controls the glass opacity of the inner app sidebar + header */
  uiOpacity: number;
  toggleDarkMode: () => void;
  setUiOpacity: (value: number) => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  darkMode: false,
  uiOpacity: Number(localStorage.getItem("uiOpacity") ?? 70),
  toggleDarkMode: () => {
    set((state) => {
      const newDark = !state.darkMode;
      if (newDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return { darkMode: newDark };
    });
  },
  setUiOpacity: (value: number) => {
    localStorage.setItem("uiOpacity", String(value));
    set({ uiOpacity: value });
  },
  initTheme: () => {
    const isDark = localStorage.getItem("theme") === "dark";
    const savedOpacity = Number(localStorage.getItem("uiOpacity") ?? 70);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    set({ darkMode: isDark, uiOpacity: savedOpacity });
  },
}));
