import Link from "next/link";
import { GearSix } from "@phosphor-icons/react/ssr";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-edge/70 bg-canvas/80 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
          <span className="grid size-8 place-items-center rounded-xl bg-accent text-on-accent">
            <GearSix size={18} weight="bold" />
          </span>
          Halfshaft
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/for-workshops"
            className="hidden whitespace-nowrap text-sm font-semibold text-body transition-colors hover:text-ink sm:inline"
          >
            For workshops
          </Link>
          <Link href="/login" className="whitespace-nowrap text-sm font-semibold text-body transition-colors hover:text-ink">
            Log in
          </Link>
          <Link href="/shop/signup" className="btn btn-primary whitespace-nowrap px-4 py-2 text-sm">
            {/* One label per screen size: .btn spaces out its children, so the words can't be split. */}
            <span className="sm:hidden">Sign up</span>
            <span className="hidden sm:inline">Sign up your workshop</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
