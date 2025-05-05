import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TournamentBracket } from "@/components/TournamentBracket";
import { RegisteredTeams } from "@/components/RegisteredTeams";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FaUserPlus, FaTrophy, FaUsers, FaRedo } from "react-icons/fa";

export default function Admin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Check if admin is logged in
  useEffect(() => {
    // For demo purposes, we're not implementing a full auth system
    // In a real application, you would check localStorage/cookie for admin token
    // and redirect if not logged in
  }, [navigate]);

  // Queries
  const { data: tournament } = useQuery({
    queryKey: ["/api/tournaments/active"],
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
  });

  const { data: players = [] } = useQuery({
    queryKey: ["/api/players"],
  });

  // Mutations
  const regenerateBracketMutation = useMutation({
    mutationFn: async () => {
      const tournamentId = tournament?.id;
      if (!tournamentId) throw new Error("No active tournament found");
      
      const response = await apiRequest(
        "POST", 
        `/api/brackets/${tournamentId}/generate`,
        {}
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brackets"] });
      toast({
        title: "Bracket Regenerated",
        description: "The tournament bracket has been successfully regenerated."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "There was an error regenerating the bracket.",
        variant: "destructive"
      });
    }
  });

  const handleRegenerateBracket = () => {
    regenerateBracketMutation.mutate();
  };

  return (
    <div className="bg-slate-100 min-h-screen flex flex-col">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-neutral-dark">Admin Dashboard</h1>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to Public View
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                // Clear admin status
                localStorage.removeItem("isAdmin");
                // Navigate to home page
                navigate("/");
                // Show toast
                toast({
                  title: "Logged Out",
                  description: "You have been logged out of the admin panel.",
                });
              }}
            >
              Logout
            </Button>
          </div>
        </div>
        
        <Card className="mb-8">
          <CardHeader className="bg-primary-50">
            <CardTitle className="text-xl text-primary-900">Tournament Management</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">ACTIVE TOURNAMENT</h3>
                <p className="font-medium">{tournament?.name || "No active tournament"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">REGISTERED TEAMS</h3>
                <p className="font-medium">{teams.filter(t => !t.waitingForTeammate && t.player2Id !== null).length} / {tournament?.maxTeams || "?"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">ACTIONS</h3>
                <Button
                  onClick={handleRegenerateBracket}
                  disabled={regenerateBracketMutation.isPending}
                  className="flex items-center"
                >
                  <FaRedo className="mr-2" />
                  {regenerateBracketMutation.isPending ? "Regenerating..." : "Regenerate Bracket"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Tabs defaultValue="bracket">
          <TabsList className="mb-6">
            <TabsTrigger value="bracket" className="flex items-center">
              <FaTrophy className="mr-2" /> Bracket Management
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex items-center">
              <FaUsers className="mr-2" /> Teams
            </TabsTrigger>
            <TabsTrigger value="players" className="flex items-center">
              <FaUserPlus className="mr-2" /> Players
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="bracket">
            <Card>
              <CardContent className="pt-6">
                <p className="text-gray-600 mb-4">
                  Click on a team in the bracket to set them as the winner for that match. The bracket will automatically update.
                </p>
                <TournamentBracket tournamentId={tournament?.id} isAdmin={true} />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="teams">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2">Registered Teams</h3>
                  <p className="text-gray-600 mb-4">
                    View and manage all teams registered for the tournament.
                  </p>
                </div>
                <RegisteredTeams teams={teams} players={players} isAdmin={true} />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="players">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2">Registered Players</h3>
                  <p className="text-gray-600 mb-4">
                    View all players registered for the tournament.
                  </p>
                </div>
                
                <div className="border rounded-md">
                  <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 border-b font-medium">
                    <div>Name</div>
                    <div>Team</div>
                    <div>Status</div>
                  </div>
                  
                  {players.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No players registered yet.
                    </div>
                  ) : (
                    players.map(player => {
                      const team = teams.find(t => 
                        t.player1Id === player.id || t.player2Id === player.id
                      );
                      
                      return (
                        <div key={player.id} className="grid grid-cols-3 gap-4 p-4 border-b last:border-0">
                          <div>{player.firstName} {player.lastName}</div>
                          <div>{team ? team.name : "No Team"}</div>
                          <div>
                            <span className={`px-2 py-1 rounded-full text-xs ${player.isAvailable ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                              {player.isAvailable ? "Available" : "On Team"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      <Footer />
    </div>
  );
}
