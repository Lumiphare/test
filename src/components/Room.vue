<template>
  <div v-if="!inGame" class="room-container">

    <div v-if="countdown > 0" class="countdown-overlay"></div>
    <h1>房间系统</h1>
    <input v-model="username" placeholder="输入用户名" class="room-input username-input" :disabled="countdown > 0" />
    <input v-model="roomNumber" placeholder="输入房间号" class="room-input" :disabled="inRoom || countdown > 0" />
    <button 
      @click="roomNumber ? (inRoom ? leaveRoom() : joinRoom()) : createRoom()" 
      class="room-button"
      :disabled="countdown > 0"
    >
      {{ roomNumber ? (inRoom ? '退出房间' : '加入房间') : '创建房间' }}
    </button>
    
    <div v-if="inRoom" class="room-info">
      <h2>房间号: {{ roomNumber }}</h2>
      <p>玩家: {{ players.length }}/4</p>
      <ul>
        <li v-for="player in players" :key="player.id">{{ player.username }} - {{ player.isReady ? '准备' : '未准备' }}</li>
      </ul>
      <button 
        v-if="countdown === 0"
        @click="toggleReady" 
        class="room-button" 
        :disabled="players.length < 2"
      >
        {{ isReady ? '取消准备' : '准备' }}
      </button>

      <div v-if="countdown > 0" class="countdown">
        <p class="countdown-number">{{ countdown }}</p>
        <p class="countdown-text">游戏即将开始！</p>
        <button 
          @click="toggleReady"
          class="room-button cancel-ready-btn"
          :disabled="false"
        >
          取消准备
        </button>
      </div>
    </div>
    
    <div v-if="!inRoom" class="room-lobby">
      <h2>房间大厅</h2>
      <ul>
        <li v-for="room in roomList" :key="room">
          房间号: {{ room }}
          <button @click="joinRoomFromLobby(room)" class="room-button" :disabled="countdown > 0">加入</button>
        </li>
      </ul>
    </div>
  </div>
  <GameScreen v-else :room-number="roomNumber"/>
</template>

<script>
import GameScreen from './Game.vue'; // 导入Game组件

export default {
  name: 'GameRoom',
  components: {
    GameScreen
  },
  data() {
    return {
      username: '',
      roomNumber: '',
      players: [],
      isReady: false,
      inRoom: false,
      inGame: false,
      countdown: 0,
      roomList: [],
      socket: null,
    };
  },
  mounted() {
    // this.socket = io('http://192.168.50.34:4000');
    this.username = this.generateRandomUsername();
    this.$socket.on('roomUpdate', (players) => {
      this.players = players;
      this.inRoom = players.some(player => player.id === this.$socket.id);
      
      if (this.canStartGame && this.countdown === 0) {
        this.startCountdown();
      }
    });
    this.$socket.on('cancelCountdown', () => {
      this.countdown = 0;
      console.log('cancelCountdown');
      clearInterval(this.countdownTimer);
    });
    this.$socket.on('roomFull', (message) => {
      alert(message);
    });
    this.$socket.on('roomCreated', (roomNumber) => {
      this.roomNumber = roomNumber;
      this.joinRoom();
    });
    this.$socket.on('roomListUpdate', (rooms) => {
      this.roomList = rooms;
    });
    this.$socket.on('readyStart', ()=> {
      this.inGame = true;
      this.$socket.emit('goStart', (this.roomNumber));
    });
  },
  computed: {
    canStartGame() {
      return this.players.length >= 2 && this.players.every(player => player.isReady);
    }
  },
  methods: {
    generateRandomUsername() {
      const adjectives = ['快速', '聪明', '勇敢', '快乐', '神秘'];
      const nouns = ['狐狸', '狮子', '猫头鹰', '海豚', '熊猫'];
      const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      return `${adjective}${noun}${Math.floor(Math.random() * 100)}`;
    },
    joinRoom() {
      if (this.roomNumber) {
        this.$socket.emit('joinRoom', { roomNumber: this.roomNumber, username: this.username });
      }
    },
    joinRoomFromLobby(roomNumber) {
      this.roomNumber = roomNumber;
      this.joinRoom();
    },
    leaveRoom() {
      this.$socket.emit('leaveRoom', this.roomNumber);
      this.inRoom = false;
      this.roomNumber = '';
      this.players = [];
      this.isReady = false;
    },
    toggleReady() {
      
      this.$socket.emit('toggleReady', {
        roomNumber: this.roomNumber,
        isReady: this.countdown > 0 ? false : !this.isReady
      });
      this.isReady = !this.isReady;
      // 如果是取消准备，立即清除本地倒计时
      if (this.countdown > 0) {
        this.countdown = 0;
        clearInterval(this.countdownTimer);
      }
    },
    createRoom() {
      const generateRoomNumber = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 4; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      let newRoomNumber = generateRoomNumber();
      this.$socket.emit('createRoom', newRoomNumber);
    },
    startCountdown() {
      // 修改为从服务器获取统一状态
      this.countdown = 3;
      this.countdownTimer = setInterval(() => {
        if (this.countdown > 0) {
          this.countdown--;
        } else {
          clearInterval(this.countdownTimer);
          // this.inGame = true;
        }
      }, 1000);
    }
  }
};
</script>

<style scoped>
.room-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background-color: #f5f5f5;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

/* 确保没有全局样式影响GameScreen */
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
}

h1 {
  font-size: 2em;
  margin-bottom: 20px;
  color: #333;
}

.room-input {
  width: 80%;
  padding: 10px;
  margin-bottom: 20px;
  border: 1px solid #ccc;
  border-radius: 5px;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.room-input:focus {
  border-color: #007bff;
  box-shadow: 0 0 5px rgba(0, 123, 255, 0.5);
}

.username-input {
  width: 60%;
  margin-bottom: 10px;
  background-color: #e9f7ff;
}

.room-button {
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.room-button:hover {
  background-color: #0056b3;
}

.room-info {
  margin-top: 20px;
  padding: 10px;
  background-color: #e9ecef;
  border-radius: 5px;
}

.game-start {
  margin-top: 20px;
  padding: 10px;
  background-color: #d4edda;
  border-radius: 5px;
  color: #155724;
}

.room-lobby {
  margin-top: 20px;
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 5px;
}

.room-lobby h2 {
  margin-bottom: 10px;
}

.room-lobby ul {
  list-style-type: none;
  padding: 0;
}

.room-lobby li {
  margin-bottom: 5px;
}

/* 遮罩层样式 */
.countdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 998;
}

/* 倒计时容器 */
.countdown {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto !important;
}

/* 倒计时数字 */
.countdown-number {
  font-size: 8em;
  color: #ff4444;
  text-shadow: 0 0 20px rgba(255, 68, 68, 0.5);
  margin: 0;
  animation: pulse 1s infinite;
  /* z-index: 1000;
  position: relative; */
}

/* 倒计时文字 */
.countdown-text {
  font-size: 2em;
  color: #fff;
  margin-top: -20px;
  z-index: 1000; /* 确保倒计时文字在所有元素之上 */
  position: relative; /* 确保z-index生效 */
}

/* 新的取消准备按钮样式 */
.cancel-ready-btn {
  margin-top: 20px;
  background-color: #666 !important;
  border: 2px solid #fff;
  font-size: 1.2em;
  padding: 12px 30px;
  transition: transform 0.2s, background 0.3s;
}

.cancel-ready-btn:hover {
  background-color: #555 !important;
  transform: translateY(-2px);
}

.cancel-ready-btn:active {
  transform: scale(0.95);
}

/* 脉冲动画 */
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* 其他元素变暗效果 */
.room-container > *:not(.countdown):not(.cancel-ready-btn) {
  transition: opacity 0.3s;
}
.countdown-overlay + .room-container > *:not(.countdown):not(.cancel-ready-btn) {
  opacity: 0.3;
  pointer-events: none;
  transition: opacity 0.3s;
}
</style> 