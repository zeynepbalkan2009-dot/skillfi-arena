import Image from "next/image";

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="route-transition" aria-hidden="true">
        <div className="route-transition__beam" />
        <Image
          src="/art/skillfi-pixel-fleet.png"
          alt=""
          width={1122}
          height={1402}
          sizes="240px"
          className="route-transition__fleet"
          priority
        />
        <div className="route-transition__copy">
          <span>SKILLFI NETWORK</span>
          <strong>LOADING NEXT SECTOR</strong>
        </div>
      </div>
      <div className="route-stage">{children}</div>
    </>
  );
}
