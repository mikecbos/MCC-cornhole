import { useQuery } from "@tanstack/react-query";
import { FaUserCircle } from "react-icons/fa";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Team, Player } from "@shared/schema";

interface RegisteredTeamsProps {
  teams?: Team[];
  players?: Player[];
}

export const RegisteredTeams = ({ teams: propTeams, players: propPlayers }: RegisteredTeamsProps) => {
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

  // Filter out incomplete teams (those waiting for a teammate)
  const completedTeams = teams.filter(team => !team.waitingForTeammate && team.player2Id !== null);

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
      
      {completedTeams.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            No teams have registered yet. Be the first to register!
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {completedTeams.map(team => (
            <Card key={team.id} className="team-card">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-lg text-primary">{team.name}</span>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                    {team.seedNumber ? `Seed #${team.seedNumber}` : 'Awaiting Match'}
                  </span>
                </div>
                <div className="flex items-center mb-1">
                  <FaUserCircle className="text-gray-400 mr-2" />
                  <span>{getPlayerName(team.player1Id)}</span>
                </div>
                <div className="flex items-center">
                  <FaUserCircle className="text-gray-400 mr-2" />
                  <span>{team.player2Id ? getPlayerName(team.player2Id) : "Waiting for teammate"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
