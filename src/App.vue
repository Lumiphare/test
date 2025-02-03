<template>
  <!-- <img alt="Vue logo" src="./assets/logo.png"> -->
  <GameRoom />
</template>

<script>
import GameRoom from './components/Room.vue'

export default {
  name: 'App',
  components: {
    GameRoom,
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  /* margin-top: 60px; */
}
.card-move {
  transition: all 0.5s;
}

.card-enter-active, .card-leave-active {
  transition: all 0.5s;
}
.card-enter, .card-leave-to {
  opacity: 0;
  transform: translateY(100px);
}
</style>
