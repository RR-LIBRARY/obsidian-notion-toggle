import { useEffect, useState } from "react";

/**
 * The current page origin, read after hydration so server and client markup
 * match. Returns the placeholder until the browser is ready.
 */
export function useOrigin(placeholder = "https://<your-bridge>"): string {
  const [origin, setOrigin] = useState(placeholder);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  return origin;
}
