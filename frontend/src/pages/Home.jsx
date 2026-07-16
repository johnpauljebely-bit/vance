import Navbar from "@/components/site/Navbar";
import Footer from "@/components/site/Footer";
import Hero from "@/components/site/Hero";
import Portfolio from "@/components/site/Portfolio";
import Services from "@/components/site/Services";
import Numbers from "@/components/site/Numbers";
import HowItWorks from "@/components/site/HowItWorks";
import Testimonials from "@/components/site/Testimonials";
import Faq from "@/components/site/Faq";
import CommissionForm from "@/components/site/CommissionForm";
import useReveal from "@/lib/useReveal";
import { useEffect } from "react";

export default function Home() {
  useReveal();

  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 400);
      }
    }
  }, []);

  return (
    <div data-testid="home-page" className="min-h-screen bg-[#F7F5F2]">
      <Navbar />
      <main>
        <Hero />
        <Portfolio />
        <Services />
        <Numbers />
        <HowItWorks />
        <Testimonials />
        <Faq />
        <CommissionForm />
      </main>
      <Footer />
    </div>
  );
}
