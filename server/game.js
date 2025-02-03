function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
} 

class GameLogic {
  constructor(io, rooms, gameStates) {
    this.io = io;
    this.rooms = rooms;
    this.gameStates = gameStates;
  }

  initializeDeck() {
    const cards = [];
    ['Q', 'K', 'A'].forEach(type => {
      for (let i = 0; i < 6; i++) cards.push({ type, isJoker: false });
    });
    for (let i = 0; i < 2; i++) cards.push({ type: 'Joker', isJoker: true });
    return shuffle(cards);
  }

  startGame(roomNumber) {
    const deck = this.initializeDeck();
    const players = this.rooms[roomNumber].players;
    const trueCardType = ['Q', 'K', 'A'][Math.floor(Math.random() * 3)];

    players.forEach(player => {
      player.hand = deck.splice(0, 5);
      player.isOut = false;
    });
    this.rooms[roomNumber].state = 'inProgress';

    this.gameStates.set(roomNumber, {
      deck,
      discardPile: [],
      currentPlayer: 0,
      lastPlay: null,
      trueCardType,
      status: 'playing'
    });

    // this.io.to(roomNumber).emit('gameStart', {
    //   players: players.map(p => ({ username: p.username, cardCount: 5 })),
    //   trueCardType
    // });
    players.forEach((player, index) => {
      this.io.to(player.id).emit('gameStart', {
        players: players.map(p => ({ 
          username: p.username, 
          cardCount: 5
        })),
        trueCardType,
        myIndex: index,  // 直接发送索引
        currentPlayer: 0,
      });
    });

    players.forEach((player, index) => {
      this.io.to(player.id).emit('dealCards', {
        hand: player.hand,
        yourTurn: index === 0
      });
    });
  }

  handlePlayCards(socket, { roomNumber, cardIndexes }) {
    const gameState = this.gameStates.get(roomNumber);
    const player = this.rooms[roomNumber].find(p => p.id === socket.id);
    
    if (!this.validatePlay(gameState, player, cardIndexes, roomNumber)) return;

    const playedCards = this.processPlayedCards(player, cardIndexes);
    this.updateGameState(gameState, playedCards, player, roomNumber);
    this.notifyPlayers(roomNumber, player, playedCards, gameState);
    this.passTurn(roomNumber, gameState);
  }

  validatePlay(gameState, player, cardIndexes, roomNumber) {
    return gameState.currentPlayer === this.rooms[roomNumber].indexOf(player) &&
           cardIndexes.length >= 1 &&
           cardIndexes.length <= 3;
  }

  processPlayedCards(player, cardIndexes) {
    return cardIndexes
      .sort((a, b) => b - a)
      .map(i => player.hand.splice(i, 1)[0]);
  }

  updateGameState(gameState, playedCards, player, roomNumber) {
    gameState.lastPlay = {
      player: this.rooms[roomNumber].indexOf(player),
      cards: playedCards,
      timestamp: Date.now()
    };
  }

  notifyPlayers(roomNumber, player, playedCards, gameState) {
    this.io.to(roomNumber).emit('cardsPlayed', {
      player: player.username,
      cardCount: playedCards.length,
      nextPlayer: (gameState.currentPlayer + 1) % this.rooms[roomNumber].length
    });
  }

  passTurn(roomNumber, gameState) {
    gameState.currentPlayer = (gameState.currentPlayer + 1) % this.rooms[roomNumber].length;
    this.io.to(roomNumber).emit('turnChange', gameState.currentPlayer);
  }

  handleChallenge(socket, { roomNumber }) {
    const gameState = this.gameStates.get(roomNumber);
    const challengerIndex = this.rooms[roomNumber].findIndex(p => p.id === socket.id);
    console.log("challengerIndex", challengerIndex);
    // if (!this.validateChallenge(gameState, challengerIndex, roomNumber)) return;
    const challengeResult = this.checkChallengeValidity(gameState);
    this.processChallengeResult(roomNumber, gameState, challengeResult, challengerIndex);
    this.checkGameOver(roomNumber);
  }

  validateChallenge(gameState, challengerIndex, roomNumber) {
    return (gameState.currentPlayer + 1) % this.rooms[roomNumber].length === challengerIndex;
  }

  checkChallengeValidity(gameState) {
    return gameState.lastPlay.cards.every(card => 
      card.isJoker || card.type === gameState.trueCardType
    );
  }

  processChallengeResult(roomNumber, gameState, isValid, challengerIndex) {
    const loserIndex = isValid ? challengerIndex : gameState.lastPlay.player;
    this.rooms[roomNumber][loserIndex].isOut = true;

    console.log("loserIndex", loserIndex);

    this.io.to(roomNumber).emit('challengeResult', {
      success: !isValid,
      loser: this.rooms[roomNumber][loserIndex].username,
      actualCards: gameState.lastPlay.cards.map(c => c.type)
    });
  }

  checkGameOver(roomNumber) {
    const remainingPlayers = this.rooms[roomNumber].filter(p => !p.isOut);
    if (remainingPlayers.length === 1) {
      this.io.to(roomNumber).emit('gameOver', { winner: remainingPlayers[0].username });
      this.gameStates.delete(roomNumber);
    }
  }
  endGame() {
    // TODO
  }
  cleanStateGames() {
    // TODO
  }
}

module.exports = GameLogic;