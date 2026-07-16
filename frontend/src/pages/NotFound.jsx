import { Link } from "react-router-dom";
import Navbar from "@/components/site/Navbar";
import Footer from "@/components/site/Footer";
import { ASSETS } from "@/lib/brand";

export default function NotFound() {
  return (
    <div data-testid="not-found-page" className="min-h-screen bg-[#F7F5F2] flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto flex max-w-4xl flex-col items-center justify-center px-6 py-24 text-center md:px-10">
        <img
          src={ASSETS.mascot}
          alt=""
          className="w-56 md:w-72 opacity-90"
          draggable={false}
        />
        <p
          data-testid="not-found-code"
          className="mt-8 text-xs font-bold uppercase tracking-[0.3em] text-[#FF6B35]"
        >
          Error · 404
        </p>
        <h1 className="mt-3 text-5xl font-bold tracking-[-0.03em] md:text-7xl">
          That page{" "}
          <span className="accent-italic text-[#FF6B35]">wandered off.</span>
        </h1>
        <p className="mt-4 max-w-lg text-[#1A1A1A]/70">
          The link you followed might be broken, or the page may have moved.
          Let's get you back to something that exists.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/" data-testid="not-found-home-btn" className="btn-primary">
            Back to home
          </Link>
          <Link
            to="/#work"
            data-testid="not-found-work-btn"
            className="btn-secondary"
          >
            View work
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
