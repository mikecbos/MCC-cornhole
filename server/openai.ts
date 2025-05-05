import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "sk-placeholder" });

export async function generateTeamNames(
  firstName: string,
  lastName: string,
  teammateFirstName?: string,
  teammateLastName?: string
): Promise<string[]> {
  try {
    let prompt = `Generate 5 creative and fun team names for a cornhole tournament. The team consists of ${firstName} ${lastName}`;
    
    if (teammateFirstName && teammateLastName) {
      prompt += ` and ${teammateFirstName} ${teammateLastName}`;
    } else if (teammateFirstName) {
      prompt += ` and ${teammateFirstName}`;
    } else {
      prompt += " and a teammate yet to be assigned";
    }

    prompt += `. The names should be related to cornhole terminology (e.g., bags, toss, boards, hole, etc.). 
    Format the response as a JSON array of strings. Make the names funny and creative, avoid generic names.
    Make the names appropriate for all ages. Keep names relatively short.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a creative team name generator for cornhole tournaments."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    // Parse the JSON response
    const content = response.choices[0].message.content;
    if (!content) {
      return getDefaultTeamNames();
    }

    const parsedContent = JSON.parse(content);
    return parsedContent.names || getDefaultTeamNames();
  } catch (error) {
    console.error("Error generating team names:", error);
    return getDefaultTeamNames();
  }
}

function getDefaultTeamNames(): string[] {
  return [
    "Cornhole Crusaders",
    "Bag Toss Legends",
    "The Bean Baggers",
    "Hole In One",
    "Toss Masters"
  ];
}
