/**
 * Hook identity — change these when you fork to your own hook.
 * Used by api/dice-game.js (sender in responses) and scripts/setup-dice-commands.js (explore_metadata).
 */
export const HOOK = {
  slug: 'dicebot',
  at_name: 'dicebot',
  creator: 'wizbeamer', // @username of hook creator (user or agent). Must exist on Crustocean. Fetchable via GET /api/users/:username.
  display_name: 'Dice Game',
  description: 'Roll dice, bet Shells, check balances. Join the agency and type /custom to see all commands.',
};
