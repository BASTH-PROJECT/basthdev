import { useMemo } from "react";

export function useGreeting() {
  return useMemo(() => {
    const hour = new Date().getHours();

    if (hour >= 19) return "Selamat malam";
    if (hour >= 16) return "Selamat sore";
    if (hour >= 12) return "Selamat siang";
    return "Selamat pagi";
  }, []);
}
