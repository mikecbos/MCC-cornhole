/**
 * Tournament Management Platform Configuration
 * This file contains default settings that can be overridden with environment variables
 */

export const config = {
  // Application settings
  app: {
    name: process.env.APP_NAME || "Cornhole Tournament Manager",
    port: parseInt(process.env.PORT || "5000"),
  },
  
  // Default admin credentials
  admin: {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "admin",
    // In production, you should use environment variables for these values
  },
  
  // Default tournament settings
  tournament: {
    defaultName: process.env.DEFAULT_TOURNAMENT_NAME || "Cornhole Championship",
    defaultMaxTeams: parseInt(process.env.DEFAULT_MAX_TEAMS || "16"),
    defaultBracketType: process.env.DEFAULT_BRACKET_TYPE || "single", // "single" or "double"
  },
  
  // Theme configuration
  theme: {
    primaryColor: process.env.PRIMARY_COLOR || "#4f46e5", // Indigo
    secondaryColor: process.env.SECONDARY_COLOR || "#06b6d4", // Cyan
    accentColor: process.env.ACCENT_COLOR || "#f59e0b", // Amber
  },
  
  // Feature flags
  features: {
    enableTeamNameSuggestions: process.env.ENABLE_TEAM_NAME_SUGGESTIONS !== "false",
    enableTournamentArchive: process.env.ENABLE_TOURNAMENT_ARCHIVE !== "false",
    enableScoreTracking: process.env.ENABLE_SCORE_TRACKING !== "false",
  },
  
  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o",
  },
};

export default config;