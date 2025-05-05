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
import { Skeleton } from "@/components/ui/skeleton";
import { FaMagic } from "react-icons/fa";

interface NameSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: string[];
  onSelectName: (name: string) => void;
  onGenerateMore: () => void;
  isLoading?: boolean;
}

export const NameSuggestionsModal = ({
  isOpen,
  onClose,
  suggestions,
  onSelectName,
  onGenerateMore,
  isLoading = false
}: NameSuggestionsModalProps) => {
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
        <div className="bg-blue-50 px-6 py-4 -mt-6 -mx-6 rounded-t-lg border-b border-blue-100">
          <div className="flex items-center">
            <div className="bg-blue-100 rounded-full p-2 mr-3">
              <FaMagic className="text-primary" />
            </div>
            <DialogTitle className="text-xl font-bold text-blue-800">
              Team Name Suggestions
            </DialogTitle>
          </div>
        </div>
        
        <DialogDescription className="text-gray-700 mb-4">
          Choose one of our AI-generated team names:
        </DialogDescription>
        
        {isLoading ? (
          <div className="space-y-2 mb-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {suggestions.map((name, index) => (
              <div 
                key={index}
                className="bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition"
                onClick={() => onSelectName(name)}
              >
                <span>{name}</span>
              </div>
            ))}
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="mr-3">
            Cancel
          </Button>
          <Button onClick={onGenerateMore} disabled={isLoading}>
            {isLoading ? "Generating..." : "Generate More"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
