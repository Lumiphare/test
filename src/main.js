import { createApp } from 'vue'
import App from './App.vue'
import { io } from 'socket.io-client';

const app = createApp(App);

// 初始化 socket
const socket = io('http://192.168.50.34:4000');
app.config.globalProperties.$socket = socket;
app.mount('#app')
