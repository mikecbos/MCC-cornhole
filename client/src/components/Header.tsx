import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { FaUser, FaLock, FaTachometerAlt } from "react-icons/fa";
import { FaBullseye } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export const Header = () => {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin on component mount
  useEffect(() => {
    const adminStatus = localStorage.getItem("isAdmin") === "true";
    setIsAdmin(adminStatus);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("isAdmin");
    setIsAdmin(false);
    
    toast({
      title: "Logged Out",
      description: "You have been logged out of the admin panel.",
    });
    
    // Redirect to home if currently on admin page
    if (location.startsWith("/admin")) {
      navigate("/");
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <Link href="/">
            <div className="flex items-center space-x-3 cursor-pointer">
              <FaBullseye className="text-accent text-2xl" />
              <h1 className="text-xl font-bold text-neutral-dark">Cornhole Tournament Bracket</h1>
            </div>
          </Link>

          <div className="flex items-center space-x-2">
            {isAdmin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center">
                    <FaUser className="mr-2" /> Admin <span className="ml-1 text-xs">▼</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <FaTachometerAlt className="mr-2" /> Admin Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <FaLock className="mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                variant="outline" 
                className="flex items-center"
                onClick={() => navigate("/auth")}
              >
                <FaUser className="mr-2" /> Admin Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
