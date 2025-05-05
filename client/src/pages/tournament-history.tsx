import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tournament } from "@shared/schema";
import { Loader2, Archive, Trophy, Calendar, Users } from "lucide-react";
import { format } from "date-fns";

export default function TournamentHistory() {
  const [, navigate] = useLocation();
  const [yearFilter, setYearFilter] = useState<string>("all");
  
  // Fetch all tournaments including archived ones
  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ["/api/tournaments/all"],
  });
  
  // Get unique years from tournaments
  const years = [...new Set(tournaments.map((t: Tournament) => t.year))].sort((a, b) => b - a);
  
  // Filter tournaments based on selected year
  const filteredTournaments = yearFilter === "all" 
    ? tournaments
    : tournaments.filter((t: Tournament) => t.year === parseInt(yearFilter));
  
  // Group tournaments by year for better presentation
  const groupedTournaments = filteredTournaments.reduce((acc: Record<number, Tournament[]>, tournament: Tournament) => {
    const year = tournament.year || new Date().getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(tournament);
    return acc;
  }, {});
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-grow bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Tournament History</h1>
              <p className="text-gray-600 mt-1">View past tournaments and their results</p>
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => navigate("/admin")}>
                Admin Dashboard
              </Button>
              <Button onClick={() => navigate("/")}>
                Current Tournament
              </Button>
            </div>
          </div>
          
          <div className="mb-6">
            <Card>
              <CardHeader className="bg-gray-50 border-b pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Filters</CardTitle>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
            </Card>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredTournaments.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Archive className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No tournaments found</h3>
                <p className="text-gray-500">There are no archived tournaments available.</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedTournaments)
              .sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA))
              .map(([year, tournaments]) => (
                <div key={year} className="mb-8">
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    <Calendar className="mr-2 h-5 w-5" /> {year}
                  </h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {tournaments.map((tournament: Tournament) => (
                      <Card key={tournament.id} className="overflow-hidden">
                        <CardHeader className="border-b pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle>{tournament.name}</CardTitle>
                              <CardDescription>
                                {tournament.season} {tournament.year}
                              </CardDescription>
                            </div>
                            <div className="flex items-center">
                              {tournament.isArchived && (
                                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                                  Archived
                                </span>
                              )}
                              <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                {tournament.tournamentStatus === "completed" ? "Completed" : 
                                 tournament.tournamentStatus === "in_progress" ? "In Progress" : 
                                 "Registration"}
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-sm">{tournament.maxTeams} Teams Max</span>
                            </div>
                            <div className="flex items-center">
                              <Trophy className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-sm">{tournament.bracketType === "single" ? "Single Elimination" : "Double Elimination"}</span>
                            </div>
                          </div>
                          
                          {tournament.description && (
                            <p className="text-gray-600 text-sm mt-3">
                              {tournament.description}
                            </p>
                          )}
                          
                          {(tournament.startDate || tournament.endDate) && (
                            <div className="mt-4 text-sm">
                              <div className="flex items-center text-gray-600">
                                <Calendar className="h-4 w-4 mr-2" />
                                {tournament.startDate && tournament.endDate ? (
                                  <span>
                                    {format(new Date(tournament.startDate), "MMM d, yyyy")} - {format(new Date(tournament.endDate), "MMM d, yyyy")}
                                  </span>
                                ) : tournament.startDate ? (
                                  <span>Started {format(new Date(tournament.startDate), "MMM d, yyyy")}</span>
                                ) : (
                                  <span>Ended {format(new Date(tournament.endDate!), "MMM d, yyyy")}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                        
                        <CardFooter className="bg-gray-50 border-t">
                          <Button 
                            variant="outline" 
                            className="w-full" 
                            onClick={() => navigate(`/tournaments/${tournament.id}`)}
                          >
                            View Details
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}