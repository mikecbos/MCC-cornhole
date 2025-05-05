import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertTeamSchema, Team, Player } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team | null;
}

const formSchema = insertTeamSchema.partial().extend({
  id: z.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export const EditTeamModal = ({ isOpen, onClose, team }: EditTeamModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all available players
  const { data: availablePlayers = [] } = useQuery({
    queryKey: ["/api/players/available"],
    enabled: isOpen,
  });

  // Get all players (for dropdown)
  const { data: allPlayers = [] } = useQuery({
    queryKey: ["/api/players"],
    enabled: isOpen,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      player1Id: undefined,
      player2Id: null,
    },
  });

  // Reset form when team changes
  useEffect(() => {
    if (team) {
      form.reset({
        id: team.id,
        name: team.name,
        player1Id: team.player1Id,
        player2Id: team.player2Id,
      });
    }
  }, [team, form]);

  // Edit team mutation
  const editTeamMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!team?.id) throw new Error("No team ID provided");
      const response = await apiRequest("PUT", `/api/teams/${team.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/players/available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brackets"] });
      
      toast({
        title: "Team Updated",
        description: "The team has been successfully updated."
      });
      
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update team",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: FormValues) => {
    editTeamMutation.mutate(data);
  };

  const getPlayerOptions = () => {
    // For player1, show the current player1 + all available players
    const player1Options = [...availablePlayers];
    if (team?.player1Id) {
      const currentPlayer = allPlayers.find(p => p.id === team.player1Id);
      if (currentPlayer && !player1Options.some(p => p.id === currentPlayer.id)) {
        player1Options.push(currentPlayer);
      }
    }

    // For player2, show the current player2 + all available players + "None" option
    const player2Options = [...availablePlayers];
    if (team?.player2Id) {
      const currentPlayer = allPlayers.find(p => p.id === team.player2Id);
      if (currentPlayer && !player2Options.some(p => p.id === currentPlayer.id)) {
        player2Options.push(currentPlayer);
      }
    }

    return {
      player1Options,
      player2Options
    };
  };

  const { player1Options, player2Options } = getPlayerOptions();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
          <DialogDescription>
            Update team information, including name and members
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter team name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="player1Id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Player 1</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select player 1" />
                      </SelectTrigger>
                      <SelectContent>
                        {player1Options.map((player) => (
                          <SelectItem key={player.id} value={player.id.toString()}>
                            {player.firstName} {player.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    This is the main player of the team.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="player2Id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Player 2</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value === "null" ? null : parseInt(value));
                      }}
                      value={field.value === null ? "null" : field.value?.toString()}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select player 2" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="null">No Teammate (Waiting)</SelectItem>
                        {player2Options.map((player) => (
                          <SelectItem key={player.id} value={player.id.toString()}>
                            {player.firstName} {player.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    This is the teammate. Select "No Teammate" if this player is waiting to be paired.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={editTeamMutation.isPending}>
                {editTeamMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};