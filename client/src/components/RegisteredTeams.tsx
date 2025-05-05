import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FaUserCircle, FaTrash, FaEdit } from "react-icons/fa";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditTeamModal } from "@/components/modals/EditTeamModal";
import { apiRequest } from "@/lib/queryClient";
import { Team, Player } from "@shared/schema";

interface RegisteredTeamsProps {
  teams?: Team[];
  players?: Player[];
  isAdmin?: boolean;
}

export const RegisteredTeams = ({ 
  teams: propTeams, 
  players: propPlayers,
  isAdmin = false
}: RegisteredTeamsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [teamToEdit, setTeamToEdit] = useState<Team | null>(null);
  
  // If teams and players are not provided as props, fetch them
  const { data: fetchedTeams = [], isLoading: isLoadingTeams } = useQuery({
    queryKey: ["/api/teams"],
    enabled: !propTeams
  });

  const { data: fetchedPlayers = [], isLoading: isLoadingPlayers } = useQuery({
    queryKey: ["/api/players"],
    enabled: !propPlayers
  });

  const teams = propTeams || fetchedTeams;
  const players = propPlayers || fetchedPlayers;
  const isLoading = (!propTeams && isLoadingTeams) || (!propPlayers && isLoadingPlayers);

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      const response = await apiRequest("DELETE", `/api/teams/${teamId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brackets"] });
      
      toast({
        title: "Team Deleted",
        description: "The team has been successfully removed from the tournament.",
      });
      
      setTeamToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "There was an error deleting the team.",
        variant: "destructive"
      });
    }
  });

  // Handler for confirming team deletion
  const handleDeleteTeam = () => {
    if (teamToDelete) {
      deleteTeamMutation.mutate(teamToDelete.id);
    }
  };

  // Include all teams when in admin mode
  const filteredTeams = isAdmin 
    ? teams 
    : teams.filter(team => !team.waitingForTeammate && team.player2Id !== null);

  const getPlayerName = (playerId: number) => {
    const player = players.find(p => p.id === playerId);
    return player ? `${player.firstName} ${player.lastName}` : "Unknown Player";
  };

  if (isLoading) {
    return (
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6 text-neutral-dark">Registered Teams</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6 text-neutral-dark">Registered Teams</h2>
      
      {filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            No teams have registered yet. Be the first to register!
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map(team => (
            <Card key={team.id} className="team-card">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-lg text-primary">{team.name}</span>
                  {isAdmin ? (
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setTeamToEdit(team)}
                      >
                        <FaEdit size={14} />
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => setTeamToDelete(team)}
                        disabled={deleteTeamMutation.isPending}
                      >
                        <FaTrash size={14} />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                      {team.seedNumber ? `Seed #${team.seedNumber}` : 'Awaiting Match'}
                    </span>
                  )}
                </div>
                <div className="flex items-center mb-1">
                  <FaUserCircle className="text-gray-400 mr-2" />
                  <span>{getPlayerName(team.player1Id)}</span>
                </div>
                <div className="flex items-center">
                  <FaUserCircle className="text-gray-400 mr-2" />
                  <span>{team.player2Id ? getPlayerName(team.player2Id) : "Waiting for teammate"}</span>
                </div>
                
                {isAdmin && team.waitingForTeammate && (
                  <div className="mt-2">
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full">
                      Waiting for Teammate
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={teamToDelete !== null} onOpenChange={(open) => !open && setTeamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Team Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the team "{teamToDelete?.name}"? 
              This will remove them from the tournament bracket and make their players available again.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTeam} className="bg-red-600 hover:bg-red-700">
              {deleteTeamMutation.isPending ? "Deleting..." : "Delete Team"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Edit Team Modal */}
      <EditTeamModal 
        isOpen={teamToEdit !== null}
        onClose={() => setTeamToEdit(null)}
        team={teamToEdit}
      />
    </div>
  );
};
