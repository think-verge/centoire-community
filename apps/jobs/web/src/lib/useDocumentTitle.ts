import { useEffect } from "react";

export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · Centoire Jobs` : "Centoire Jobs";
  }, [title]);
}
