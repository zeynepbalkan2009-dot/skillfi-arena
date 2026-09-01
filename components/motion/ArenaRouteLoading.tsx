import { WaitingMotion } from "@/components/motion/WaitingMotion";

export function ArenaRouteLoading({ label }: { label: string }) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-arena-bg px-4 text-arena-text">
      <section className="w-full max-w-2xl rounded-3xl border border-arena-border bg-arena-surface/80 p-8 shadow-2xl shadow-cyan-950/10 sm:p-12">
        <WaitingMotion label={label} />
      </section>
    </main>
  );
}
