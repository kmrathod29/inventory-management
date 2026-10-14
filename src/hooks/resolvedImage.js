import { useState, useEffect } from "react";

const NO_IMAGE = `${import.meta.env.BASE_URL}images/NoImage.jpg`;

export function useResolvedImage(relativePath) {
  const [resolvedImage, setResolvedImage] = useState(NO_IMAGE);

  useEffect(() => {
    async function resolve() {
      if (!relativePath) {
        setResolvedImage(NO_IMAGE);
        return;
      }
      const absPath = await window.db.resolveImagePath(relativePath);
      if (!absPath) {
        setResolvedImage(NO_IMAGE);
        return;
      }
      setResolvedImage(`app-image://open?path=${encodeURIComponent(absPath.replace(/\\/g, "/"))}`);
    }
    resolve().catch(() => {
      setResolvedImage(NO_IMAGE);
    });
  }, [relativePath]);

  return resolvedImage;
}