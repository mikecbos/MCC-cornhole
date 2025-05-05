import { useState } from "react";
import { Link, useLocation } from "wouter";
import { FaUser, FaChevronDown } from "react-icons/fa";
import { FaBullseye } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { AdminLoginModal } from "./modals/AdminLoginModal";

export const Header = () => {
  const [location] = useLocation();
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);

  return (
    <>
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/">
              <div className="flex items-center space-x-3 cursor-pointer">
                <FaBullseye className="text-accent text-2xl" />
                <h1 className="text-xl font-bold text-neutral-dark">Cornhole Tournament Bracket</h1>
              </div>
            </Link>
            <div>
              <Button 
                variant="ghost" 
                className="text-sm text-gray-600 hover:text-primary flex items-center"
                onClick={() => setIsAdminLoginOpen(true)}
              >
                <FaUser className="mr-1" /> Admin Login
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
      />
    </>
  );
};
