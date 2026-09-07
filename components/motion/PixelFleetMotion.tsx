import Image from "next/image";

type PixelFleetMotionProps = {
  compact?: boolean;
  label?: string;
};

export function PixelFleetMotion({
  compact = false,
  label = "SkillFi Arena fleet signal",
}: PixelFleetMotionProps) {
  return (
    <figure
      className={`pixel-fleet ${compact ? "pixel-fleet--compact" : ""}`}
      aria-label={label}
    >
      <div className="pixel-fleet__scanline" aria-hidden="true" />
      <Image
        src="/art/skillfi-pixel-fleet.png"
        alt=""
        width={1122}
        height={1402}
        sizes={compact ? "176px" : "(max-width: 1024px) 92vw, 420px"}
        className="pixel-fleet__art"
        priority={!compact}
      />
      <figcaption className="pixel-fleet__hud">
        <span>FLEET / 05</span>
        <span className="pixel-fleet__status">SIGNAL LOCKED</span>
      </figcaption>
    </figure>
  );
}
