import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "delivery-theme";

type ThemeMode = "dark" | "light";

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const next = stored === "light" || stored === "dark" ? stored : "dark";
    setMode(next);
    applyTheme(next);
  }, []);

  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  return (
    <Button
      type="button"
      onClick={toggle}
      size="icon"
      variant="ghost"
      className="fixed right-4 top-4 z-50 grid h-11 w-11 rounded-full border border-border bg-glass text-foreground shadow-lg backdrop-blur-xl transition-transform active:scale-95"
      aria-label={mode === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      title={mode === "dark" ? "Modo holográfico" : "Modo cyberpunk"}
    >
      {mode === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
