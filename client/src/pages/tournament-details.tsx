import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { TournamentBracket } from "@/components/TournamentBracket";
import { RegisteredTeams } from "@/components/RegisteredTeams";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { 
  Calendar, 
  Trophy, 
  Users, 
  AlertTriangle, 
  ArrowLeft, 
  Award, 
  Star,
  Archive
} from "lucide-react";
import { Tournament, Match, Team } from "@shared/schema";

export default function TournamentDetails() {
  const params = useParams();
  const [, navigate] = useLocation();
  const tournamentId = params.id ? parseInt(params.id) : 0;
  
  // Fetch tournament details
  const { data: tournament, isLoading: isLoadingTournament } = useQuery({
    queryKey: [`/api/tournaments/${tournamentId}`],
    enabled: tournamentId > 0,
  });
  
  // Fetch tournament teams
  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    queryKey: [`/api/teams/tournament/${tournamentId}`],
    enabled: tournamentId > 0,
  });
  
  // Fetch tournament bracket/matches
  const { data: matches = [], isLoading: isLoadingMatches } = useQuery({
    queryKey: [`/api/brackets/${tournamentId}`],
    enabled: tournamentId > 0,
  });
  
  // Find the winner (if tournament is completed)
  const winnerMatch = matches.find((match: Match) => match.round === 1 && match.matchNumber === 1);
  const winner = winnerMatch?.winnerId && teams.find((team: Team) => team.id === winnerMatch.winnerId);
  
  const isLoading = isLoadingTournament || isLoadingTeams || isLoadingMatches;
  
  // If tournament not found
  if (!isLoading && !tournament) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-20">
              <AlertTriangle className="mx-auto h-16 w-16 text-amber-500 mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Tournament Not Found</h1>
              <p className="text-gray-600 mb-6">The tournament you're looking for doesn't exist or has been removed.</p>
              <div className="flex justify-center space-x-4">
                <Button onClick={() => navigate("/history")}>View All Tournaments</Button>
                <Button variant="outline" onClick={() => navigate("/")}>Go Home</Button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-grow bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Button 
            variant="outline" 
            className="mb-6"
            onClick={() => navigate("/history")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tournament History
          </Button>
          
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-12 w-96" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                <div>
                  <div className="flex items-center">
                    <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
                    {tournament.isArchived && (
                      <span className="ml-3 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full flex items-center">
                        <Archive className="h-3 w-3 mr-1" /> Archived
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mt-1">
                    {tournament.season} {tournament.year}
                  </p>
                </div>
                
                {winner && (
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="p-4 flex items-center">
                      <Trophy className="h-10 w-10 text-yellow-500 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Tournament Winner</p>
                        <p className="text-lg font-bold text-yellow-900">{winner.name}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              <Card className="mb-8">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">TOURNAMENT DETAILS</h3>
                      <p className="text-gray-900">
                        {tournament.description || "No description provided."}
                      </p>
                      
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center text-sm">
                          <Trophy className="h-4 w-4 text-gray-400 mr-2" />
                          <span>{tournament.bracketType === "single" ? "Single Elimination" : "Double Elimination"}</span>
                        </div>
                        
                        <div className="flex items-center text-sm">
                          <Users className="h-4 w-4 text-gray-400 mr-2" />
                          <span>{tournament.maxTeams} Teams Maximum</span>
                        </div>
                        
                        <div className="flex items-center text-sm">
                          <Star className="h-4 w-4 text-gray-400 mr-2" />
                          <span>
                            {tournament.tournamentStatus === "completed" 
                              ? "Completed" 
                              : tournament.tournamentStatus === "in_progress" 
                                ? "In Progress" 
                                : "Registration Phase"}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">DATE & TIME</h3>
                      
                      {(tournament.startDate || tournament.endDate) ? (
                        <div className="space-y-2">
                          {tournament.startDate && (
                            <div className="flex items-center text-sm">
                              <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                              <span>Start: {format(new Date(tournament.startDate), "MMMM d, yyyy")}</span>
                            </div>
                          )}
                          
                          {tournament.endDate && (
                            <div className="flex items-center text-sm">
                              <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                              <span>End: {format(new Date(tournament.endDate), "MMMM d, yyyy")}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No dates specified</p>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">STATISTICS</h3>
                      
                      <div className="space-y-2">
                        <div className="flex items-center text-sm">
                          <Users className="h-4 w-4 text-gray-400 mr-2" />
                          <span>{teams.length} Teams Registered</span>
                        </div>
                        
                        <div className="flex items-center text-sm">
                          <Award className="h-4 w-4 text-gray-400 mr-2" />
                          <span>{matches.filter((m: Match) => m.winnerId !== null).length} Matches Completed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Tabs defaultValue="bracket">
                <TabsList className="mb-6">
                  <TabsTrigger value="bracket">
                    <Trophy className="h-4 w-4 mr-2" /> Tournament Bracket
                  </TabsTrigger>
                  <TabsTrigger value="teams">
                    <Users className="h-4 w-4 mr-2" /> Registered Teams
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="bracket">
                  <Card>
                    <CardContent className="p-6">
                      <TournamentBracket tournamentId={tournamentId} />
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="teams">
                  <Card>
                    <CardContent className="p-6">
                      <RegisteredTeams teams={teams} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}