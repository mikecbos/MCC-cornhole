import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FaExclamationTriangle } from "react-icons/fa";

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
}

export const ErrorModal = ({ isOpen, onClose, message }: ErrorModalProps) => {
  // Ensure the dialog closes properly
  const [open, setOpen] = useState(isOpen);
  
  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);
  
  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <div className="bg-red-50 px-6 py-4 -mt-6 -mx-6 rounded-t-lg border-b border-red-100">
          <div className="flex items-center">
            <div className="bg-red-100 rounded-full p-2 mr-3">
              <FaExclamationTriangle className="text-red-500" />
            </div>
            <DialogTitle className="text-xl font-bold text-red-800">
              Registration Error
            </DialogTitle>
          </div>
        </div>
        
        <DialogDescription className="text-gray-700 mb-4">
          {message}
        </DialogDescription>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="mr-3">
            Cancel
          </Button>
          <Button onClick={handleClose}>
            Change Teammate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
