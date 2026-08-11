import Image from "next/image";
import type { AssetType } from "@/types";
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
  return (
    <div className={`relative overflow-hidden bg-zinc-100 dark:bg-zinc-800 ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes={sizes}
        priority={priority}
      />
      <div className="absolute bottom-2 right-2 rounded-md bg-black/50 p-1.5 text-white backdrop-blur-sm">
        <AssetTypeIcon type={type} />
      </div>
    </div>
  );
}
