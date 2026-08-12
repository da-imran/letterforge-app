const GameMode = {
  TIME_ATTACK: 'time_attack',
  NORMAL: 'normal',
  SURVIVAL: 'survival_mode',
  CHAIN: 'chain_mode',
  FADE: 'fade_mode',
};

const ALLOWED_MODES = [
  GameMode.NORMAL,
  GameMode.TIME_ATTACK,
  GameMode.SURVIVAL,
  GameMode.CHAIN,
  GameMode.FADE,
];

module.exports = { GameMode, ALLOWED_MODES };