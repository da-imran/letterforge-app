# **App Name**: LetterForge

## Core Features:

- User Onboarding & Profile: Allow players to create or log in using a unique nickname, persist user session in local storage, and display user-specific game statistics on a profile page.
- Game Mode Selection: An intuitive interface to choose between 'Normal Mode' and 'Time Attack' mode, clearly outlining their respective rules.
- Interactive Game Board: Display randomly generated letters prominently, provide an input field for submitting words, and give real-time visual feedback for valid, invalid, and duplicate word submissions. Update current score dynamically.
- Time Attack Game Mechanics: Implement a precise countdown timer for 'Time Attack' mode. Enable players to reset letters to generate new ones during active time-attack games, and handle automatic game completion upon timer expiration.
- Leaderboard & Rankings: A dedicated page to view global rankings, filterable by game mode ('normal_mode', 'time_attack') and time period ('daily', 'weekly', 'all_time'), displaying player nicknames, scores, and game counts.
- Game Completion & Result Display: Mechanism to mark a game as complete, showing a summary of the player's performance including score and used words, and facilitating score submission to the leaderboard.
- Robust API Integration: A comprehensive service layer in `/lib/api.ts` utilizing fetch to handle all communications with the Express.js backend API, encompassing user, game, score, and leaderboard functionalities.

## Style Guidelines:

- Primary color: Deep Blue-Violet (#8A40DB), signifying intelligence and digital depth, chosen for main UI elements like buttons, active states, and primary headlines.
- Background color: A subtly textured, very dark Indigo (#16121D), providing a deep, immersive canvas suitable for dark mode and minimizing eye strain.
- Accent color: Vibrant Electric Blue (#4D6AFF), analogous to the primary hue, used for interactive elements, highlights, and subtle calls to action to create dynamic contrast.
- Supplementary color for scores and success: Gold/Yellow (#f59e0b) for points awarded and score increments. An Emerald Green (#10b981) can be used for secondary positive feedback.
- Body and headline font: 'Inter' (sans-serif) for its modern, highly readable, and versatile characteristics, ensuring clear communication across all UI components and content lengths.
- Sleek, minimalistic, and geometrically precise SVG icons. Design them to align with a digital, contemporary aesthetic, enhancing clarity and user experience without overwhelming the interface.
- Responsive layout leveraging a flexible grid system. The design will gracefully adapt from expansive desktop views (>1024px), to optimized tablet layouts (640px-1024px), and compact single-column structures for mobile devices (<640px).
- Subtle, fluid animations: a distinct 'flip' transition for letter tiles on new game/reset, a visually engaging '+points' popup on score increments, a gentle 'shake' effect for invalid word submissions, and a celebratory 'confetti' burst upon successful game completion.