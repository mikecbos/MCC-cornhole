import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FaTrophy } from "react-icons/fa";
import { Match, Team, Player } from "@shared/schema";
import { BracketMatch } from "./BracketMatch";
import { prepareMatchesForDisplay, generateEmptyBracket, MatchDisplay } from "@/lib/bracket";

interface TournamentBracketProps {
  tournamentId?: number;
  isAdmin?: boolean;
}

export const TournamentBracket = ({ tournamentId = 1, isAdmin = false }: TournamentBracketProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [displayMatches, setDisplayMatches] = useState<MatchDisplay[]>([]);
  const [rounds, setRounds] = useState<number[]>([]);
  const [champion, setChampion] = useState<string | null>(null);

  // Get active tournament if no id is provided
  const { data: activeTournament } = useQuery({
    queryKey: ["/api/tournaments/active"],
    enabled: !tournamentId
  });

  const effectiveTournamentId = tournamentId || (activeTournament?.id);

  // Fetch matches for the tournament
  const { data: matches = [], isLoading: isLoadingMatches } = useQuery({
    queryKey: ["/api/brackets", effectiveTournamentId],
    queryFn: async ({ queryKey }) => {
      if (!queryKey[1]) return [];
      const res = await fetch(`/api/brackets/${queryKey[1]}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!effectiveTournamentId
  });

  // Fetch teams
  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    queryKey: ["/api/teams"],
  });

  // Fetch players
  const { data: players = [], isLoading: isLoadingPlayers } = useQuery({
    queryKey: ["/api/players"],
  });

  // Prepare data for display
  useEffect(() => {
    if (matches.length > 0 && teams.length > 0 && players.length > 0) {
      const preparedMatches = prepareMatchesForDisplay(matches, teams, players);
      setDisplayMatches(preparedMatches);
      
      const uniqueRounds = [...new Set(preparedMatches.map((m) => m.round))].sort();
      setRounds(uniqueRounds);
      
      // Find champion if exists
      const finalMatch = preparedMatches.find(
        (m) => m.round === Math.max(...uniqueRounds)
      );
      
      if (finalMatch?.winnerId) {
        const winnerTeam = teams.find((t) => t.id === finalMatch.winnerId);
        if (winnerTeam) {
          setChampion(winnerTeam.name);
        }
      } else {
        setChampion(null);
      }
    } else if (matches.length === 0 && !isLoadingMatches) {
      // Create empty bracket structure if no matches exist
      const emptyBracket = generateEmptyBracket(16);
      setDisplayMatches(emptyBracket);
      
      const uniqueRounds = [...new Set(emptyBracket.map((m) => m.round))].sort();
      setRounds(uniqueRounds);
    }
  }, [matches, teams, players, isLoadingMatches]);

  // Loading state
  const isLoading = isLoadingMatches || isLoadingTeams || isLoadingPlayers;

  return (
    <Card className="h-full">
      <CardContent className="pt-6 h-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-neutral-dark">Tournament Bracket</h2>
          <div className="text-sm text-gray-500">
            <span className="font-medium">Teams Registered:</span>{" "}
            <span>{teams.filter(t => !t.waitingForTeammate && t.player2Id !== null).length}</span>/16
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-[500px] w-full" />
          </div>
        ) : (
          <div className="overflow-auto" ref={scrollContainerRef} style={{ minHeight: "500px" }}>
            <div className="tournament-bracket flex space-x-8 py-3">
              {rounds.map((round) => (
                <div 
                  key={round} 
                  className="round flex flex-col justify-around space-y-6"
                  style={{ minWidth: "200px" }}
                >
                  <div className="round-header mb-3">
                    <h3 className="text-sm font-medium text-gray-500 uppercase">
                      {round === Math.max(...rounds) ? "Final Round" : `Round ${round}`}
                    </h3>
                  </div>
                  
                  {displayMatches
                    .filter((match) => match.round === round)
                    .map((match) => (
                      <BracketMatch 
                        key={match.id}
                        match={match}
                        isAdmin={isAdmin}
                      />
                    ))
                  }
                  
                  {/* Champion Trophy */}
                  {round === Math.max(...rounds) && (
                    <div className="winner flex justify-center items-center mt-12 ml-6">
                      <div className="text-center">
                        <div className="text-accent text-3xl mb-2">
                          <FaTrophy />
                        </div>
                        <div className="text-gray-500 text-sm">Champion</div>
                        <div className="font-medium mt-1 text-gray-900">
                          {champion || "TBD"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
