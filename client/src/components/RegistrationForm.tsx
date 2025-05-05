import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { FaMagic } from "react-icons/fa";
import { RegisterSuccessModal } from "./modals/RegisterSuccessModal";
import { ErrorModal } from "./modals/ErrorModal";
import { NameSuggestionsModal } from "./modals/NameSuggestionsModal";
import { getTeamNameSuggestions } from "@/lib/openai";
import { FALLBACK_TEAM_NAMES } from "@/lib/teamNames";

// Define the form schema with zod
const formSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters" }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters" }),
  teamName: z.string().min(2, { message: "Team name must be at least 2 characters" }),
  teammateOption: z.enum(["bring", "select", "random"]),
  teamMember: z.string().optional(),
  availableTeammate: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

interface RegisteredTeam {
  id: number;
  name: string;
  player1: string;
  player2: string;
}

export const RegistrationForm = () => {
  // States for modals
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showNameSuggestionsModal, setShowNameSuggestionsModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [suggestionNames, setSuggestionNames] = useState<string[]>(FALLBACK_TEAM_NAMES);
  const [registeredTeam, setRegisteredTeam] = useState<RegisteredTeam | null>(null);
  const [isLoadingNames, setIsLoadingNames] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get available players
  const { data: availablePlayers = [] } = useQuery({
    queryKey: ["/api/players/available"],
  });

  // Form setup
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      teamName: "",
      teammateOption: "bring",
      teamMember: "",
      availableTeammate: ""
    }
  });

  // Watch for teammate option to conditionally show fields
  const teammateOption = form.watch("teammateOption");

  // Handle generating team names
  const handleSuggestNames = async () => {
    const firstName = form.getValues("firstName");
    const lastName = form.getValues("lastName");
    const teamMember = form.getValues("teamMember") || "";
    
    if (!firstName || !lastName) {
      toast({
        title: "Missing Information",
        description: "Please enter your name first.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoadingNames(true);
    
    try {
      let teammateFirstName = "";
      let teammateLastName = "";
      
      if (teammateOption === "bring" && teamMember) {
        const nameParts = teamMember.trim().split(" ");
        if (nameParts.length >= 2) {
          teammateFirstName = nameParts[0];
          teammateLastName = nameParts.slice(1).join(" ");
        } else {
          teammateFirstName = teamMember;
        }
      }

      const suggestions = await getTeamNameSuggestions(
        firstName,
        lastName,
        teammateFirstName,
        teammateLastName
      );
      
      if (suggestions && suggestions.length > 0) {
        setSuggestionNames(suggestions);
      } else {
        // Use fallback names if the API fails
        setSuggestionNames(FALLBACK_TEAM_NAMES);
      }
    } catch (error) {
      console.error("Error getting team name suggestions:", error);
      setSuggestionNames(FALLBACK_TEAM_NAMES);
    } finally {
      setIsLoadingNames(false);
      setShowNameSuggestionsModal(true);
    }
  };

  // Create player mutation
  const createPlayerMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      const response = await apiRequest("POST", "/api/players", {
        firstName: data.firstName,
        lastName: data.lastName,
        isAvailable: false
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/players/available"] });
    }
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      player1Id: number;
      player2Id?: number;
      waitingForTeammate: boolean;
    }) => {
      const response = await apiRequest("POST", "/api/teams", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brackets"] });
    },
    onError: (error: any) => {
      setErrorMessage(error.message || "There was an error creating the team. Please try again.");
      setShowErrorModal(true);
    }
  });

  // Form submission
  const onSubmit = async (data: FormValues) => {
    try {
      // Create the registerer first
      const player1 = await createPlayerMutation.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName
      });

      // Prepare team data based on teammate option
      let teamData = {
        name: data.teamName,
        player1Id: player1.id,
        player2Id: null as number | null,
        waitingForTeammate: data.teammateOption === "random"
      };

      if (data.teammateOption === "bring" && data.teamMember) {
        // Create the teammate player
        const nameParts = data.teamMember.split(" ");
        if (nameParts.length < 2) {
          throw new Error("Please enter the full name (first and last) of your teammate.");
        }
        
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ");
        
        const teammate = await createPlayerMutation.mutateAsync({
          firstName,
          lastName
        });
        
        teamData.player2Id = teammate.id;
      } else if (data.teammateOption === "select" && data.availableTeammate) {
        // Use existing player
        teamData.player2Id = parseInt(data.availableTeammate);
      }
      
      // Create the team
      const team = await createTeamMutation.mutateAsync(teamData);
      
      // Show success modal with team info
      setRegisteredTeam({
        id: team.id,
        name: team.name,
        player1: `${data.firstName} ${data.lastName}`,
        player2: data.teammateOption === "bring" 
          ? data.teamMember || "TBD"
          : data.teammateOption === "select" && data.availableTeammate
            ? availablePlayers.find(p => p.id === parseInt(data.availableTeammate))
              ? `${availablePlayers.find(p => p.id === parseInt(data.availableTeammate))?.firstName} ${availablePlayers.find(p => p.id === parseInt(data.availableTeammate))?.lastName}`
              : "Selected Player"
            : "Random Teammate (TBD)"
      });
      
      setShowSuccessModal(true);
      
      // Reset form
      form.reset();
      
    } catch (error: any) {
      if (error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("There was an error registering your team. Please try again.");
      }
      setShowErrorModal(true);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-2xl font-bold mb-6 text-neutral-dark">Team Registration</h2>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Registrant Info */}
              <div>
                <h3 className="font-medium text-gray-700 mb-4">Your Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="First name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Team Info */}
              <div>
                <h3 className="font-medium text-gray-700 mb-4">Team Information</h3>
                
                <div className="mb-4">
                  <FormField
                    control={form.control}
                    name="teamName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Name *</FormLabel>
                        <div className="flex space-x-2">
                          <FormControl>
                            <Input placeholder="Team name" {...field} />
                          </FormControl>
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={handleSuggestNames}
                            className="flex-shrink-0"
                            disabled={isLoadingNames}
                          >
                            <FaMagic className={isLoadingNames ? "animate-spin" : ""} />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="mb-4">
                  <FormField
                    control={form.control}
                    name="teammateOption"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teammate Options</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bring">I'm bringing my teammate</SelectItem>
                            <SelectItem value="select">Select from registered players</SelectItem>
                            <SelectItem value="random">Find me a random teammate</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {teammateOption === "bring" && (
                  <FormField
                    control={form.control}
                    name="teamMember"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teammate's Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {teammateOption === "select" && (
                  <FormField
                    control={form.control}
                    name="availableTeammate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Available Teammates</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a teammate" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availablePlayers.length > 0 ? (
                              availablePlayers.map((player) => (
                                <SelectItem key={player.id} value={player.id.toString()}>
                                  {player.firstName} {player.lastName}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none">No available players</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {teammateOption === "random" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700">
                    <span className="mr-1">ℹ️</span> You'll be matched with another player who also needs a teammate.
                  </div>
                )}
              </div>
              
              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createPlayerMutation.isPending || createTeamMutation.isPending}
                >
                  {(createPlayerMutation.isPending || createTeamMutation.isPending) 
                    ? "Registering..." 
                    : "Register Team"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Modals */}
      <RegisterSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        team={registeredTeam}
      />
      
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        message={errorMessage}
      />
      
      <NameSuggestionsModal
        isOpen={showNameSuggestionsModal}
        onClose={() => setShowNameSuggestionsModal(false)}
        suggestions={suggestionNames}
        onSelectName={(name) => {
          form.setValue("teamName", name);
          setShowNameSuggestionsModal(false);
        }}
        onGenerateMore={handleSuggestNames}
        isLoading={isLoadingNames}
      />
    </>
  );
};
