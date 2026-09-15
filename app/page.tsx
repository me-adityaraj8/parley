import { AmbientBackground } from "@/components/shared/ambient-background";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { TechFlow } from "@/components/landing/tech-flow";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/me-adityaraj8/parley";

export default function LandingPage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-violet focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <AmbientBackground />
      <Navbar repoUrl={REPO_URL} />
      <main id="main">
        <Hero />
        <Features />
        <HowItWorks />
        <TechFlow />
        <FinalCta />
      </main>
      <Footer repoUrl={REPO_URL} />
    </>
  );
}
