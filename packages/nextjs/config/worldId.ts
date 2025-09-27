/**
 * World ID Configuration
 * Centralized configuration for World ID App ID and actions
 */

export const WORLD_ID_CONFIG = {
  // World ID App ID - Replace with your actual World ID App ID
  APP_ID: "app_staging_63bdbf24a4508f0f971c7311107ffa1c",

  // World ID Actions
  ACTIONS: {
    CREATE_TOKEN: "create-token",
    BUY_TOKEN: "buy-token",
  },
} as const;

// Export individual constants for convenience
export const WORLD_ID_APP_ID = WORLD_ID_CONFIG.APP_ID;
export const WORLD_ID_CREATE_TOKEN_ACTION = WORLD_ID_CONFIG.ACTIONS.CREATE_TOKEN;
export const WORLD_ID_BUY_TOKEN_ACTION = WORLD_ID_CONFIG.ACTIONS.BUY_TOKEN;
