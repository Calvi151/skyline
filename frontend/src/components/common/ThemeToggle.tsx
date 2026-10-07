import { useThemeStore } from '../../store/themeStore'

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeStore()

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else {
      setTheme('light')
    }
  }

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Beralih tema terang atau gelap"
      title={`Mode ${isDark ? 'Gelap' : 'Terang'} (klik untuk ganti)`}
      className="w-10 h-10 rounded-full border border-line bg-panel flex items-center justify-center text-ink hover:bg-tint transition-all focus:outline-none focus:ring-2 focus:ring-brand-fg"
    >
      <span className="material-symbols-outlined text-[20px] select-none">
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  )
}
