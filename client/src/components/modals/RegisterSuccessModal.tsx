import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FaCheck } from "react-icons/fa";

interface RegisterSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: {
    id: number;
    name: string;
    player1: string;
    player2: string;
  } | null;
}

export const RegisterSuccessModal = ({
  isOpen,
  onClose,
  team
}: RegisterSuccessModalProps) => {
  // Ensure the dialog closes properly
  const [open, setOpen] = useState(isOpen);
  
  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);
  
  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  if (!team) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <div className="bg-green-50 px-6 py-4 -mt-6 -mx-6 rounded-t-lg border-b border-green-100">
          <div className="flex items-center">
            <div className="bg-green-100 rounded-full p-2 mr-3">
              <FaCheck className="text-green-600" />
            </div>
            <DialogTitle className="text-xl font-bold text-green-800">
              Registration Successful!
            </DialogTitle>
          </div>
        </div>
        
        <DialogDescription className="text-gray-700 mb-4">
          Your team has been successfully registered for the tournament!
        </DialogDescription>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="font-bold mb-1">Team Name: {team.name}</div>
          <div className="text-sm text-gray-600 mb-1">Player 1: {team.player1}</div>
          <div className="text-sm text-gray-600">Player 2: {team.player2}</div>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          You can view your position in the tournament bracket below.
        </p>
        
        <div className="flex justify-end">
          <Button onClick={handleClose}>
            View Bracket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
