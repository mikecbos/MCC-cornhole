import { apiRequest } from "@/lib/queryClient";

// Team name suggestion function
export async function getTeamNameSuggestions(
  firstName: string,
  lastName: string,
  teammateFirstName?: string,
  teammateLastName?: string
): Promise<string[]> {
  try {
    const response = await apiRequest(
      "POST",
      "/api/team-name-suggestions",
      {
        firstName,
        lastName,
        teammateFirstName,
        teammateLastName
      }
    );
    
    const data = await response.json();
    return data.suggestions || [];
  } catch (error) {
    console.error("Error getting team name suggestions", error);
    return [];
  }
}
