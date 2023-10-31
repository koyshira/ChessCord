
# Discord Chess Bot

Welcome to the Discord Chess Bot! This bot allows users to play chess directly within your Discord server using slash commands.

## Features

- **Play Chess**: Start a chess game with another user in the server.
- **Move Validation**: Ensures legal moves according to standard chess rules.
- **Interactive Interface**: Visual representation of the chessboard for easy gameplay.
- **Multiplayer Support**: Engage in multiple concurrent chess games within the server.
- **Turn-based System**: Each player can make a move in turns.

## Usage

To begin a game, use the following slash commands:

- `/challenge @opponent` to challenge another player.
- `/move <position>` to make your move in the game.

## Slash Commands

- `/help` - Displays the list of available commands and how to use them.
- `/challenge @opponent` - Challenges the mentioned user to a game of chess.
- `/accept` - Accepts a chess game challenge.
- `/move <position>` - Make a move in the ongoing game.
- `/resign` - Resign from the current game.

## Installation

1. **Prerequisites**

	- Node.js installed
	- Discord Bot token from the Discord Developer Portal

2. **Clone the Repository**

    ```git
    git clone https://github.com/CastaLabs/chessBot.git
    ```

3. **Configuration**

	- Navigate to the cloned directory and create a `.env` file.
	- Add your Discord Bot token in the `.env` file:

	  ```node
	  TOKEN=your_discord_bot_token
	  ```

4. **Install Dependencies**

    ```node
    npm install
    ```

5. **Run the Bot**

    ```node
    node bot.js
    ```

## License

This project is licensed under the [MIT License](https://koy.mit-license.org)
  
## Acknowledgements

- Thanks to [ChessLibrary](https://www.npmjs.com/package/chess.js) for the chess logic implementation.
- This bot was built using the [Discord.js](https://www.npmjs.com/package/discord.js) library.
