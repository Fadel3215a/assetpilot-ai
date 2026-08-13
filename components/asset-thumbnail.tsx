import Image from "next/image";
import type { AssetType } from "@/types";
import { resolvePublicAssetPath } from "@/lib/base-path";
import { AssetTypeIcon } from "./asset-type-icon";

interface AssetThumbnailProps {
  src: string;
  alt: string;
  type: AssetType;
  priority?: boolean;
  className?: string;
  sizes?: string;
}

export function AssetThumbnail({
  src,
  alt,
  type,
  priority = false,
  className = "",
  sizes = "(max-width: 768px) 100vw, 300px",
}: AssetThumbnailProps) {
  const isBlob = src.startsWith("blob:");
  const resolvedSrc = isBlob ? src : resolvePublicAssetPath(src);

  return (
    <div className={`relative overflow-hidden bg-surface ${className}`}>
      {isBlob ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolvedSrc} alt={alt} className="h-full w-full object-cover" loading={priority ? "eager" : "lazy"} />
      ) : (
        <Image
          src={resolvedSrc}
          alt={alt}
          fill
          className="object-cover"
          sizes={sizes}
          priority={priority}
          unoptimized
        />
      )}
      <div className="absolute bottom-2 right-2 rounded-md bg-black/50 p-1.5 text-white backdrop-blur-sm">
        <AssetTypeIcon type={type} />
      </div>
    </div>
  );
}
