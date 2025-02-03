<template>
  <div class="game-container">
    <!-- 真实卡牌展示 -->
    <div class="true-card-container">
      <div class="card true-card">
        <span>{{ trueCardType }}</span>
      </div>
      <div class="true-card-label">真牌</div>
    </div>

    <!-- 中心区域：展示本轮最后打出的卡牌，背面朝上 -->
    <div class="central-pile">
      <div class="pile-label">已出牌</div>
      <transition-group name="pile" tag="div" class="pile-cards">
        <div
          v-for="(c, idx) in centralCards"
          :key="idx"
          :class="['card', c.isFaceUp ? 'face-up' : 'back']"
          :style="getOverlapStyle(idx)"
        >
          <!-- 如果是正面，显示牌面；背面则不显示文字 -->
          <span v-if="c.isFaceUp">{{ c.type }}</span>
      </div>
      </transition-group>
    </div>

    <!-- 玩家位置 -->
    <div v-for="(player, index) in players" :key="player.id" :class="[
      'player',
      `pos-${getPosition(index)}`,
      { active: currentPlayer === index }
    ]">
      <div class="username">
        {{ player.username }}
        <span v-if="player.isMe">(我)</span>
      </div>

      <transition-group name="card" class="cards" tag="div">
        <!-- 如果是自己 -->
        <template v-if="player.isMe">
          <div v-for="(card, cIndex) in hand" :key="cIndex" :class="[
            'card',
            { selected: selectedCards.includes(cIndex) }
          ]" @click="toggleSelect(cIndex)">
            <span>{{ card.type || '???' }}</span>
          </div>
        </template>

        <!-- 如果是其他玩家 -->
        <template v-else>
          <div v-for="n in player.cardCount" :key="n" class="card back"></div>
        </template>
      </transition-group>

      <div v-if="player.isOut" class="eliminated">出局</div>
    </div>

    <!-- 自己操作区 -->
    <div v-if="amICurrentPlayer" class="action-buttons">
      <!-- 出牌按钮 -->
      <button v-if="selectedCards.length > 0 && selectedCards.length <= 3" @click="playSelected" class="play-btn">
        出牌
      </button>
      <!-- 质疑按钮 -->
      <button v-if="showChallenge" @click="challenge" class="challenge-btn">
        质疑
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GameLogic',
  props: {
    roomNumber: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      players: [],          // 所有玩家
      hand: [],             // 自己的手牌
      trueCardType: '',     // 真牌类型
      currentPlayer: -1,    // 当前出牌玩家索引
      selectedCards: [],    // 选择中的手牌索引
      showChallenge: false, // 是否显示质疑按钮
      myIndex: -1,          // 自己在 players 数组中的索引
      mySocketId: '',       // 自己的 socket.id，用于识别跟 players 对应
      centralCards: [],     // 中心区域展示的卡牌
    }
  },
  computed: {
    // 判断是否轮到我出牌
    amICurrentPlayer() {
      return this.currentPlayer === this.myIndex;
    }
  },
  created() {
    console.log('Game created, roomNumber:', this.roomNumber);
  },
  methods: {
    // 计算玩家在画面上的位置（示例）
    getPosition(index) {
      const total = this.players.length;
      if (total === 2) {
        return index === this.myIndex ? 'bottom' : 'top';
      }
      // 其他情况简单处理，按 bottom right top left
      const positions = ['bottom', 'right', 'top', 'left'];
      // 让自己的位置永远是 bottom，其余依次排布
      const offset = this.myIndex;
      return positions[(index - offset + total) % total];
    },

    // 点击手牌，切换选中状态
    toggleSelect(index) {
      // 如果还没轮到我，直接返回
      if (!this.amICurrentPlayer) return;

      const pos = this.selectedCards.indexOf(index);
      if (pos === -1) {
        // 选中
        if (this.selectedCards.length < 3) {
          this.selectedCards.push(index);
        }
      } else {
        // 取消选中
        this.selectedCards.splice(pos, 1);
      }
    },

    // 出牌
    playSelected() {
      // 1. 先把选中的牌从本地的 hand 里移除
      const sortedIndexes = [...this.selectedCards].sort((a, b) => b - a);
      sortedIndexes.forEach(i => {
        this.hand.splice(i, 1);
      });
      this.selectedCards = [];

      // 2. 通知服务器出牌
      this.$socket.emit('playCards', {
        roomNumber: this.roomNumber,
        cardIndexes: sortedIndexes
      });
    },

    // 质疑
    challenge() {
      this.$socket.emit('challenge', {
        roomNumber: this.roomNumber
      });
    },

    getOverlapStyle(idx) {
      return {
        position: 'absolute',
        left: `${idx * 30}px`,
        top: '0px'
      };
    }
  },
  mounted() {
    // 获取当前客户端的 socket.id
    this.mySocketId = this.$socket.id;
    console.log('[Game] mySocketId=', this.mySocketId, ' roomNumber=', this.roomNumber);

    // gameStart：服务器通知每个玩家，游戏已开始
    this.$socket.on('gameStart', data => {
      // players: [{ username, cardCount }, ...]
      // myIndex: 当前玩家在 players 数组中的索引
      this.players = data.players.map((p, idx) => {
        // 前端也可以储存 socketId，如果服务器发送的话
        return {
          ...p,
          id: p.id || 'player_' + idx,
          isMe: idx === data.myIndex, // 这里可以根据服务器发送的标识来区分
          isOut: false
        }
      });

      this.trueCardType = data.trueCardType;
      this.myIndex = data.myIndex;
      this.currentPlayer = data.currentPlayer;
    });

    // dealCards：服务器发给特定玩家的手牌
    this.$socket.on('dealCards', data => {
      // 只有自己能收到自己的手牌
      this.hand = data.hand;
      // 更新本地 players 里自己的 cardCount
      if (this.myIndex !== -1 && this.players[this.myIndex]) {
        this.players[this.myIndex].cardCount = data.hand.length;
      } else {
        console.error('无法找到当前玩家索引');
      }
    });

    // cardsPlayed：服务器广播已出牌，更新对应玩家的 cardCount
    this.$socket.on('cardsPlayed', data => {
      // data.player：出牌玩家用户名
      // data.cardCount：打出了几张
      // data.nextPlayer：下一个玩家索引
      // data.cardCount：本次打出的牌数
      // 这里选择“只保留本次出的牌数”，因此先清空，然后写入新的背面牌
      this.centralCards = [];
      for (let i = 0; i < data.cardCount; i++) {
        this.centralCards.push({
          isFaceUp: false,
          type: ''
        });
      }

      const player = this.players.find(p => p.username === data.player);
      if (player) {
        player.cardCount -= data.cardCount;
      } else {
        console.warn('[cardsPlayed] 未找到对应的玩家:', data.player);
      }

      // 如果下一个玩家是自己，可以显示质疑按钮（自定义逻辑）
      if (data.nextPlayer === this.myIndex) {
        this.showChallenge = true;
      }
    });

    // turnChange：服务器广播轮次改变
    this.$socket.on('turnChange', newIndex => {
      this.currentPlayer = newIndex;
      this.showChallenge = false;
    });

    // challengeResult：服务器广播挑战结果
    this.$socket.on('challengeResult', data => {
      // data.loser：挑战失败者用户名
      console.log('[challengeResult] loser=', data.loser);
      this.centralCards = data.actualCards.map(type => ({
        isFaceUp: true,
        type
      }));
      const loser = this.players.find(p => p.username === data.loser);
      if (loser) loser.isOut = true;
    });

    // gameOver：服务器广播游戏结束
    this.$socket.on('gameOver', result => {
      console.log('[gameOver]', result);
      alert(`游戏结束！胜利者：${result.winner}`);
    });
  }
}
</script>

<style scoped>
.game-container {
  position: relative;
  height: 100vh;
  background: #2c3e50;
}
/* 中心区域，用于放背面牌 */
.central-pile {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}
.pile-label {
  color: white;
  margin-bottom: 10px;
}
.pile-cards {
  position: relative; /* 让里面的card用绝对定位叠放 */
  width: 200px;
  height: 120px;
  margin: 0 auto;
}
/* 叠放时使用过渡动画（可选） */
.pile-enter-active,
.pile-leave-active {
  transition: all 0.3s;
}
.pile-enter-from, .pile-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.true-card-container {
  position: absolute;
  right: 20px;
  top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.true-card-label {
  color: white;
  font-size: 16px;
}

.true-card {
  width: 80px;
  height: 120px;
  border-radius: 8px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  border: 2px solid #e74c3c;
  /* 添加红色边框突出显示 */
}

/* 玩家外框 */
.player {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.3s;
}

.player.pos-bottom {
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
}

.player.pos-top {
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
}

.player.pos-left {
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
}

.player.pos-right {
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
}

/* 卡牌容器 */
.cards {
  display: flex;
  justify-content: flex-start;
  /* 改成左对齐 */
  gap: 10px;
}

/* 过渡动画名叫 .card-* */
.card-enter-active,
.card-leave-active {
  transition: all 0.3s;
}

.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* 卡牌本体 */
.card {
  width: 80px;
  height: 120px;
  border-radius: 8px;
  /* 让卡片相对明显的白色边框 */
  border: 2px solid #fff;  
  /* 也可以加点阴影，让它更有层次 */
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  transition: transform 0.3s;
  text-align: center;
}

.card.selected {
  transform: translateY(-20px);
}

.card.back {
  /* 背面牌设置一个深色背景 */
  background: #003366;
  color: transparent;
  /* 同样保留白色边框、阴影 */
  border: 2px solid #fff;  
}

.action-buttons {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
}

.play-btn,
.challenge-btn {
  padding: 12px 24px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.challenge-btn {
  background: #e74c3c;
}

.eliminated {
  color: red;
  font-size: 24px;
}
</style>