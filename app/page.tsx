import Link from "next/link";

const modes = [
  { label: "CARD BATTLES", title: "Outplay the opponent", copy: "Head-to-head card competitions where decisions matter every turn.", accent: "blue" },
  { label: "FPS DUELS", title: "Aim. Adapt. Win.", copy: "Fast competitive rounds built around measurable player skill.", accent: "red" },
  { label: "SKILL GAMES", title: "More ways to compete", copy: "A growing arena for games where players prove who is better.", accent: "purple" },
];

const steps = [
  ["01", "Choose your arena", "Pick a game and an open challenge."],
  ["02", "Enter the match", "Connect, stake and face your opponent."],
  ["03", "Prove your skill", "Play the game. The result decides the winner."],
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-arena-bg text-arena-text">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070a10]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center bg-arena-danger [clip-path:polygon(50%_0,100%_25%,88%_82%,50%_100%,12%_82%,0_25%)]">
              <span className="font-display text-xl font-black text-white">S</span>
            </span>
            <span className="font-display text-xl font-bold tracking-[0.18em]">SKILLFI <span className="text-arena-danger">ARENA</span></span>
          </Link>

          <nav className="hidden items-center gap-8 text-xs font-semibold tracking-[0.16em] text-white/60 md:flex">
            <a href="#arenas" className="transition hover:text-white">ARENAS</a>
            <a href="#how-it-works" className="transition hover:text-white">HOW IT WORKS</a>
            <a href="#why" className="transition hover:text-white">WHY SKILLFI</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/arena" className="hidden border border-white/15 px-5 py-2.5 text-xs font-bold tracking-[0.14em] text-white/80 transition hover:border-white/30 hover:text-white sm:block">
              SIGN IN
            </Link>
            <Link href="/arena" className="bg-arena-danger px-5 py-2.5 text-xs font-black tracking-[0.14em] text-white shadow-[0_0_28px_rgba(248,113,113,0.22)] transition hover:scale-[1.02] hover:bg-red-500">
              JOIN ARENA
            </Link>
          </div>
        </div>
      </header>

      <section className="relative flex min-h-screen items-end overflow-hidden pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(59,130,246,0.16),transparent_25%),radial-gradient(circle_at_18%_55%,rgba(37,99,235,0.20),transparent_32%),radial-gradient(circle_at_82%_55%,rgba(239,68,68,0.18),transparent_32%)]" />
        <div className="absolute inset-0 bg-arena-grid opacity-40" />
        <div className="absolute left-1/2 top-[47%] h-[70vh] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/40 to-transparent" />
        <div className="absolute left-1/2 top-[47%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 pb-16 lg:grid-cols-[1fr_1.3fr_1fr] lg:items-end lg:px-8 lg:pb-20">
          <div className="order-2 lg:order-1">
            <div className="relative border border-cyan-400/40 bg-[#07111d]/80 p-6 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-sm lg:rotate-[-3deg]">
              <div className="mb-5 flex items-center justify-between border-b border-cyan-400/20 pb-4">
                <div><p className="font-display text-2xl font-bold tracking-widest text-cyan-300">PLAYER 01</p><p className="text-[10px] tracking-[0.3em] text-white/40">BLUE SQUAD</p></div>
                <span className="font-display text-4xl font-black text-cyan-300/70">87</span>
              </div>
              <div className="flex h-44 items-center justify-center">
                <div className="relative h-32 w-32 rounded-full border border-cyan-300/40 bg-cyan-400/10 shadow-[0_0_50px_rgba(34,211,238,0.25)]">
                  <div className="absolute inset-5 rounded-full border border-cyan-300/20" />
                  <div className="absolute left-1/2 top-1/2 h-16 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-cyan-300/70 blur-[1px]" />
                  <div className="absolute left-1/2 top-1/2 h-16 w-2 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-cyan-300/70 blur-[1px]" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[9px] tracking-[0.2em] text-white/40"><span>ACC</span><span>SPEED</span><span>STRATEGY</span></div>
              <div className="mt-2 grid grid-cols-3 gap-2"><i className="h-1 bg-cyan-300" /><i className="h-1 bg-cyan-300/70" /><i className="h-1 bg-cyan-300/50" /></div>
            </div>
          </div>

          <div className="order-1 text-center lg:order-2">
            <p className="mb-4 font-display text-xs font-bold tracking-[0.45em] text-white/50">THE COMPETITIVE ARENA</p>
            <h1 className="font-display text-6xl font-black uppercase leading-[0.82] tracking-tight text-white sm:text-7xl lg:text-8xl">
              COMPETE.<br /><span className="text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.55)]">PROVE.</span><br /><span className="text-arena-danger">EARN.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-sm leading-7 text-white/60 sm:text-base">SkillFi Arena turns competitive gaming into head-to-head competition. Pick your game, face an opponent and let skill decide the outcome.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/arena" className="bg-arena-danger px-8 py-4 text-sm font-black tracking-[0.18em] text-white shadow-[0_0_40px_rgba(248,113,113,0.25)] transition hover:scale-[1.02]">ENTER THE ARENA <span className="ml-2">→</span></Link>
              <a href="#arenas" className="border border-white/15 px-8 py-4 text-sm font-bold tracking-[0.18em] text-white/70 transition hover:border-white/30 hover:text-white">EXPLORE MODES</a>
            </div>
          </div>

          <div className="order-3">
            <div className="relative border border-red-400/40 bg-[#180b10]/80 p-6 shadow-[0_0_45px_rgba(248,113,113,0.12)] backdrop-blur-sm lg:rotate-[3deg]">
              <div className="mb-5 flex items-center justify-between border-b border-red-400/20 pb-4">
                <div><p className="font-display text-2xl font-bold tracking-widest text-red-300">PLAYER 02</p><p className="text-[10px] tracking-[0.3em] text-white/40">RED SQUAD</p></div>
                <span className="font-display text-4xl font-black text-red-300/70">92</span>
              </div>
              <div className="flex h-44 items-center justify-center">
                <div className="relative h-32 w-32 rounded-full border border-red-300/40 bg-red-400/10 shadow-[0_0_50px_rgba(248,113,113,0.25)]">
                  <div className="absolute inset-5 rounded-full border border-red-300/20" />
                  <div className="absolute left-1/2 top-1/2 h-16 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-red-300/70 blur-[1px]" />
                  <div className="absolute left-1/2 top-1/2 h-16 w-2 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-red-300/70 blur-[1px]" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[9px] tracking-[0.2em] text-white/40"><span>ACC</span><span>SPEED</span><span>STRATEGY</span></div>
              <div className="mt-2 grid grid-cols-3 gap-2"><i className="h-1 bg-red-300/70" /><i className="h-1 bg-red-300" /><i className="h-1 bg-red-300/60" /></div>
            </div>
          </div>
        </div>
      </section>

      <section id="arenas" className="border-y border-white/10 bg-[#080c12] py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-12 max-w-2xl"><p className="font-display text-xs font-bold tracking-[0.35em] text-arena-danger">CHOOSE YOUR BATTLE</p><h2 className="mt-3 font-display text-4xl font-black uppercase sm:text-5xl">Different games.<br />Same arena.</h2><p className="mt-4 text-sm leading-7 text-white/50">The format changes. The principle stays the same: two players enter, one proves they are better.</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            {modes.map((mode) => (
              <article key={mode.label} className={`group relative overflow-hidden border border-white/10 bg-[#0d121a] p-7 transition hover:-translate-y-1 hover:border-white/20 ${mode.accent === "blue" ? "hover:shadow-[0_20px_60px_rgba(34,211,238,0.10)]" : mode.accent === "red" ? "hover:shadow-[0_20px_60px_rgba(248,113,113,0.10)]" : "hover:shadow-[0_20px_60px_rgba(168,85,247,0.10)]"}`}>
                <div className="mb-14 flex items-center justify-between"><span className="font-display text-[11px] font-bold tracking-[0.3em] text-white/40">{mode.label}</span><span className="text-white/20 transition group-hover:text-white/50">↗</span></div>
                <h3 className="font-display text-2xl font-bold">{mode.title}</h3><p className="mt-3 text-sm leading-6 text-white/45">{mode.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-arena-bg py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="font-display text-xs font-bold tracking-[0.35em] text-cyan-300">THE LOOP</p><h2 className="mt-3 font-display text-4xl font-black uppercase sm:text-5xl">Three steps.<br />One winner.</h2></div><p className="max-w-md text-sm leading-7 text-white/45">A simple competitive loop designed to get players from lobby to match without unnecessary friction.</p></div>
          <div className="grid border-y border-white/10 md:grid-cols-3">
            {steps.map(([number, title, copy]) => <div key={number} className="border-b border-white/10 p-7 last:border-0 md:border-b-0 md:border-r md:last:border-r-0"><span className="font-display text-4xl font-black text-white/15">{number}</span><h3 className="mt-8 font-display text-xl font-bold uppercase">{title}</h3><p className="mt-2 text-sm leading-6 text-white/45">{copy}</p></div>)}
          </div>
        </div>
      </section>

      <section id="why" className="relative overflow-hidden border-t border-white/10 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(248,113,113,0.12),transparent_42%)]" />
        <div className="relative mx-auto max-w-4xl px-5 text-center lg:px-8"><p className="font-display text-xs font-bold tracking-[0.35em] text-white/40">WELCOME TO SKILLFI ARENA</p><h2 className="mt-4 font-display text-5xl font-black uppercase sm:text-7xl">Your skill.<br /><span className="text-arena-danger">Your match.</span><br />Your result.</h2><p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-white/50">No spectators. No scripted outcomes. Step into the arena and prove what you can do.</p><Link href="/arena" className="mt-9 inline-flex bg-arena-danger px-9 py-4 text-sm font-black tracking-[0.18em] text-white shadow-[0_0_40px_rgba(248,113,113,0.22)] transition hover:scale-[1.02]">JOIN THE ARENA →</Link></div>
      </section>

      <footer className="border-t border-white/10 bg-[#070a0f] py-8"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between lg:px-8"><span className="font-display font-bold tracking-[0.18em]">SKILLFI ARENA</span><span>COMPETE. PROVE. EARN.</span></div></footer>
    </main>
  );
}
