import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MatchDisplay } from "@/lib/bracket";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FaCheck } from "react-icons/fa";

interface BracketMatchProps {
  match: MatchDisplay;
  isAdmin?: boolean;
}

export const BracketMatch = ({ match, isAdmin = false }: BracketMatchProps) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const setWinnerMutation = useMutation({
    mutationFn: async (winnerId: number) => {
      const response = await apiRequest("PUT", `/api/matches/${match.id}`, {
        winnerId
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brackets"] });
      setIsPopoverOpen(false);
      toast({
        title: "Match Updated",
        description: "The winner has been set and the bracket has been updated."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "There was an error updating the match. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleWinnerSelect = (teamId: number) => {
    if (isAdmin) {
      setWinnerMutation.mutate(teamId);
    }
  };

  const isTeam1Winner = match.winnerId === match.team1?.id;
  const isTeam2Winner = match.winnerId === match.team2?.id;

  return (
    <div className="matchup">
      <Popover open={isAdmin && isPopoverOpen} onOpenChange={isAdmin ? setIsPopoverOpen : undefined}>
        <PopoverTrigger asChild>
          <div 
            className={`team-card ${!match.team1 ? 'border-dashed text-gray-400' : ''} ${isTeam1Winner ? 'bg-green-50 border-green-200' : 'bg-gray-50'} border rounded p-3 mb-1 ${isAdmin ? 'cursor-pointer hover:bg-gray-100' : ''}`}
            onClick={() => isAdmin && match.team1 && setIsPopoverOpen(true)}
          >
            <div className="flex justify-between items-center">
              <span className={`font-medium ${isTeam1Winner ? 'text-green-700' : match.team1 ? 'text-primary' : ''}`}>
                {match.team1 ? match.team1.name : "TBD"}
                {isTeam1Winner && <FaCheck className="ml-1 inline-block text-green-500" />}
              </span>
              <span className="text-xs text-gray-500">
                {match.team1?.seedNumber ? `#${match.team1.seedNumber}` : ''}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {match.team1 
                ? match.team1.players.join(" & ") 
                : "Awaiting registration..."}
            </div>
          </div>
        </PopoverTrigger>
        
        {isAdmin && (
          <PopoverContent className="w-[200px] p-2">
            <div className="font-medium mb-2">Set as Winner?</div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full"
                onClick={() => setIsPopoverOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                className="w-full"
                onClick={() => match.team1?.id && handleWinnerSelect(match.team1.id)}
                disabled={setWinnerMutation.isPending || !match.team1?.id}
              >
                Confirm
              </Button>
            </div>
          </PopoverContent>
        )}
      </Popover>
      
      <div className="connector h-8 border-r-2 border-gray-300 ml-6"></div>
      
      <Popover open={isAdmin && isPopoverOpen} onOpenChange={isAdmin ? setIsPopoverOpen : undefined}>
        <PopoverTrigger asChild>
          <div 
            className={`team-card ${!match.team2 ? 'border-dashed text-gray-400' : ''} ${isTeam2Winner ? 'bg-green-50 border-green-200' : 'bg-gray-50'} border rounded p-3 mt-1 ${isAdmin ? 'cursor-pointer hover:bg-gray-100' : ''}`}
            onClick={() => isAdmin && match.team2 && setIsPopoverOpen(true)}
          >
            <div className="flex justify-between items-center">
              <span className={`font-medium ${isTeam2Winner ? 'text-green-700' : match.team2 ? 'text-primary' : ''}`}>
                {match.team2 ? match.team2.name : "TBD"}
                {isTeam2Winner && <FaCheck className="ml-1 inline-block text-green-500" />}
              </span>
              <span className="text-xs text-gray-500">
                {match.team2?.seedNumber ? `#${match.team2.seedNumber}` : ''}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {match.team2 
                ? match.team2.players.join(" & ") 
                : "Awaiting registration..."}
            </div>
          </div>
        </PopoverTrigger>
        
        {isAdmin && (
          <PopoverContent className="w-[200px] p-2">
            <div className="font-medium mb-2">Set as Winner?</div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full"
                onClick={() => setIsPopoverOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                className="w-full"
                onClick={() => match.team2?.id && handleWinnerSelect(match.team2.id)}
                disabled={setWinnerMutation.isPending || !match.team2?.id}
              >
                Confirm
              </Button>
            </div>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
};
