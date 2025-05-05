import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TournamentBracket } from "@/components/TournamentBracket";
import { RegisteredTeams } from "@/components/RegisteredTeams";
import { TournamentConfigForm } from "@/components/forms/TournamentConfigForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FaUserPlus, FaTrophy, FaUsers, FaRedo, FaCalendarAlt, 
  FaEdit, FaArchive, FaPlus, FaClock 
} from "react-icons/fa";
import { Tournament } from "@shared/schema";

export default function Admin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState("tournaments");
  
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
  
  // Fetch all tournaments including archived ones
  const { data: tournaments = [] } = useQuery({
    queryKey: ["/api/tournaments/all"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tournaments/all?archived=true");
      return response.json();
    }
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
  });

  const { data: players = [] } = useQuery({
    queryKey: ["/api/players"],
  });

  // Mutations
  const regenerateBracketMutation = useMutation({
    mutationFn: async (tournamentId: number) => {
      if (!tournamentId) throw new Error("No tournament ID provided");
      
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
  
  // Delete player mutation
  const deletePlayerMutation = useMutation({
    mutationFn: async (playerId: number) => {
      const response = await apiRequest("DELETE", `/api/players/${playerId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brackets"] });
      
      toast({
        title: "Player Deleted",
        description: "The player has been successfully removed from the tournament."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "There was an error deleting the player.",
        variant: "destructive"
      });
    }
  });
  
  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string; player1Id: number; player2Id?: number | null }) => {
      const response = await apiRequest("POST", "/api/teams", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brackets"] });
      
      setCreateTeamModalOpen(false);
      
      toast({
        title: "Team Created",
        description: "The team has been successfully created."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "There was an error creating the team.",
        variant: "destructive"
      });
    }
  });
  
  // Archive tournament mutation
  const archiveTournamentMutation = useMutation({
    mutationFn: async (tournamentId: number) => {
      await apiRequest("POST", `/api/tournaments/${tournamentId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/active"] });
      
      toast({
        title: "Tournament Archived",
        description: "The tournament has been archived successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "There was an error archiving the tournament.",
        variant: "destructive"
      });
    }
  });

  const handleRegenerateBracket = (tournamentId: number) => {
    regenerateBracketMutation.mutate(tournamentId);
  };
  
  const handleCreateTournament = () => {
    setSelectedTournament(null);
    setConfigModalOpen(true);
  };
  
  const handleEditTournament = (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setConfigModalOpen(true);
  };
  
  const handleArchiveTournament = (tournamentId: number) => {
    if (confirm("Are you sure you want to archive this tournament? It will no longer be active.")) {
      archiveTournamentMutation.mutate(tournamentId);
    }
  };

  return (
    <div className="bg-slate-100 min-h-screen flex flex-col">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-neutral-dark">Admin Dashboard</h1>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => navigate("/history")}>
              <FaCalendarAlt className="mr-2" /> Tournament History
            </Button>
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
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="tournaments" className="flex items-center">
              <FaCalendarAlt className="mr-2" /> Tournaments
            </TabsTrigger>
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
          
          <TabsContent value="tournaments">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Tournament Management</h2>
              <Button onClick={handleCreateTournament} className="flex items-center">
                <FaPlus className="mr-2 h-4 w-4" />
                Create Tournament
              </Button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {tournaments.length === 0 ? (
                <Card className="col-span-2">
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-500">No tournaments found. Create your first tournament to get started.</p>
                  </CardContent>
                </Card>
              ) : (
                tournaments.map((tournament: Tournament) => (
                  <Card key={tournament.id} className={tournament.isActive ? 'border-green-400' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between">
                        <div>
                          <CardTitle>{tournament.name}</CardTitle>
                          <CardDescription>{tournament.season} {tournament.year}</CardDescription>
                        </div>
                        <div className="space-x-1">
                          {tournament.isActive && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          )}
                          {tournament.isArchived && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              Archived
                            </span>
                          )}
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {tournament.tournamentStatus === "completed" ? "Completed" : 
                             tournament.tournamentStatus === "in_progress" ? "In Progress" : 
                             "Registration"}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2">
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {tournament.description || "No description provided."}
                      </p>
                      <div className="mt-2">
                        <span className="text-sm text-gray-500">
                          {tournament.maxTeams} Teams Maximum • {tournament.bracketType === "single" ? "Single Elimination" : "Double Elimination"}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between pt-2">
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex items-center"
                          onClick={() => handleEditTournament(tournament)}
                        >
                          <FaEdit className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        
                        {!tournament.isArchived && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex items-center"
                            onClick={() => handleArchiveTournament(tournament.id)}
                          >
                            <FaArchive className="h-3 w-3 mr-1" /> Archive
                          </Button>
                        )}
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="flex items-center"
                        onClick={() => handleRegenerateBracket(tournament.id)}
                        disabled={regenerateBracketMutation.isPending}
                      >
                        <FaRedo className="h-3 w-3 mr-1" />
                        {regenerateBracketMutation.isPending ? "Generating..." : "Generate Bracket"}
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="bracket">
            {tournament ? (
              <Card>
                <CardHeader>
                  <CardTitle>Active Tournament: {tournament.name}</CardTitle>
                  <CardDescription>
                    Click on a team in the bracket to set them as the winner for that match. The bracket will automatically update.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TournamentBracket tournamentId={tournament.id} isAdmin={true} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-amber-600">No active tournament. Please create or activate a tournament.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="teams">
            <Card>
              <CardHeader>
                <CardTitle>Registered Teams</CardTitle>
                <CardDescription>
                  View and manage all teams registered for the tournament.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tournament ? (
                  <div className="mb-4">
                    <p className="font-medium text-sm">
                      <span className="text-primary">
                        {teams.filter(t => !t.waitingForTeammate && t.player2Id !== null).length}
                      </span> / {tournament.maxTeams} teams registered
                    </p>
                  </div>
                ) : (
                  <p className="text-amber-600 mb-4">No active tournament.</p>
                )}
                <RegisteredTeams teams={teams} players={players} isAdmin={true} />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="players">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Registered Players</CardTitle>
                  <CardDescription>
                    View and manage all players registered for the tournament.
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setCreateTeamModalOpen(true)} 
                  className="flex items-center"
                  disabled={!players.filter(p => p.isAvailable).length}
                >
                  <FaPlus className="mr-2 h-4 w-4" />
                  Create Team
                </Button>
              </CardHeader>
              <CardContent>                
                <div className="border rounded-md">
                  <div className="grid grid-cols-4 gap-4 bg-gray-50 p-4 border-b font-medium">
                    <div>Name</div>
                    <div>Team</div>
                    <div>Status</div>
                    <div>Actions</div>
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
                        <div key={player.id} className="grid grid-cols-4 gap-4 p-4 border-b last:border-0">
                          <div>{player.firstName} {player.lastName}</div>
                          <div>{team ? team.name : "No Team"}</div>
                          <div>
                            <span className={`px-2 py-1 rounded-full text-xs ${player.isAvailable ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                              {player.isAvailable ? "Available" : "On Team"}
                            </span>
                          </div>
                          <div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this player? This will also remove them from any teams.")) {
                                  deletePlayerMutation.mutate(player.id);
                                }
                              }}
                              disabled={deletePlayerMutation.isPending}
                            >
                              <FaTrash size={14} />
                            </Button>
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
      
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTournament ? "Edit Tournament" : "Create Tournament"}
            </DialogTitle>
          </DialogHeader>
          <TournamentConfigForm
            tournamentId={selectedTournament?.id}
            defaultValues={selectedTournament || undefined}
            onSuccess={() => {
              setConfigModalOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
              queryClient.invalidateQueries({ queryKey: ["/api/tournaments/all"] });
              queryClient.invalidateQueries({ queryKey: ["/api/tournaments/active"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
