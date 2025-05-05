import { useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TournamentBanner } from "@/components/TournamentBanner";
import { InfoCards } from "@/components/InfoCards";
import { RegistrationForm } from "@/components/RegistrationForm";
import { TournamentBracket } from "@/components/TournamentBracket";
import { RegisteredTeams } from "@/components/RegisteredTeams";
import { TournamentHighlights } from "@/components/TournamentHighlights";

export default function Home() {
  const registrationRef = useRef<HTMLDivElement>(null);
  const bracketRef = useRef<HTMLDivElement>(null);

  const scrollToRegistration = () => {
    registrationRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToBracket = () => {
    bracketRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="bg-slate-100 min-h-screen flex flex-col">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        <TournamentBanner
          onRegisterClick={scrollToRegistration}
          onViewBracketClick={scrollToBracket}
        />
        
        <InfoCards />
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2" ref={registrationRef}>
            <RegistrationForm />
          </div>
          
          <div className="lg:col-span-3" ref={bracketRef}>
            <TournamentBracket />
          </div>
        </div>
        
        <RegisteredTeams />
        
        <TournamentHighlights />
      </main>
      
      <Footer />
    </div>
  );
}
