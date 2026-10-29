import React, { useId } from "react";
export default function EquipmentPhoto({ item, className = "" }) {
  const clip = `equipment-photo-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  if (!item.photo) return null;
  if (item.photoCrop) {
    const c = item.photoCrop;
    return (
      <svg
        className={`equipment-photo ${className}`}
        viewBox={`${c.x} ${c.y} ${c.width} ${c.height}`}
        role="img"
        aria-label={item.name}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath id={clip}>
            <rect x={c.x} y={c.y} width={c.width} height={c.height} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <image
            href={item.photo}
            x="0"
            y="0"
            width={c.sourceWidth}
            height={c.sourceHeight}
          />
        </g>
      </svg>
    );
  }
  return (
    <img
      className={className}
      src={item.photo}
      alt={item.name}
      loading="lazy"
    />
  );
}
