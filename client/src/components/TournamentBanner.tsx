import { useState } from "react";
import { Button } from "@/components/ui/button";

interface TournamentBannerProps {
  onRegisterClick: () => void;
  onViewBracketClick: () => void;
}

export const TournamentBanner = ({ onRegisterClick, onViewBracketClick }: TournamentBannerProps) => {
  return (
    <div className="relative overflow-hidden rounded-lg mb-8 h-64 md:h-80">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 to-blue-800/90 z-10"></div>
      <img 
        src="https://images.unsplash.com/photo-1529788295308-1eace6f67388?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" 
        alt="Cornhole tournament" 
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="relative z-20 h-full flex flex-col justify-center items-center text-white px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-2">Summer Cornhole Championship</h2>
        <p className="text-lg md:text-xl mb-6">Register your team and compete for the trophy!</p>
        <div className="flex space-x-4">
          <Button 
            onClick={onRegisterClick}
            className="bg-white text-primary font-medium px-5 py-2 rounded-md hover:bg-gray-100 transition"
          >
            Register Now
          </Button>
          <Button 
            onClick={onViewBracketClick}
            className="bg-accent text-white font-medium px-5 py-2 rounded-md hover:bg-orange-700 transition"
          >
            View Bracket
          </Button>
        </div>
      </div>
    </div>
  );
};
