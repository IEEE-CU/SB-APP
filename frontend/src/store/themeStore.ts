import { create } from "zustand";

interface ThemeState {
  darkMode: boolean;
  toggleDarkMode: () => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  darkMode: false,
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
  initTheme: () => {
    const isDark = localStorage.getItem("theme") === "dark";
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    set({ darkMode: isDark });
  },
}));
