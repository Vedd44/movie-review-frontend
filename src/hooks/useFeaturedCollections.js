import { useEffect, useState } from "react";
import { getFeaturedCollections, getNextFeaturedBoundary } from "../featuredCollections";

export default function useFeaturedCollections(collections) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer;
    const update = () => {
      clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      const boundary = getNextFeaturedBoundary(current);
      if (boundary !== null) timer = setTimeout(update, Math.min(boundary - current, 2147483647));
    };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return getFeaturedCollections(collections, now);
}
