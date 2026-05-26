<template>
  <div>
    <!-- RULE: vue/v-for-no-key (no :key) -->
    <li v-for="item in items">{{ item.name }}</li>

    <!-- RULE: vue/no-v-if-v-for-same-element -->
    <div v-for="user in users" v-if="user.active">{{ user.name }}</div>

    <!-- RULE: vue/no-inline-object-in-template -->
    <MyChild :style="{ color: 'red', fontSize: '14px' }" />

    <!-- RULE: vue/prefer-v-show-for-toggle (use v-show for frequent toggles) -->
    <div v-if="isVisible">Toggle me</div>
    <div v-if="isMenuOpen">Menu</div>

    <!-- RULE: vue/no-complex-expression-in-template -->
    <span>{{ user.role === 'admin' ? user.profile.name.toUpperCase() : user.profile.guestName }}</span>
  </div>
</template>

<script>
export default {
  name: 'BadComponent',
  data() {
    return { items: [], users: [], isOpen: false };
  },
  computed: {
    // RULE: vue/no-side-effect-in-computed
    activeUsers() {
      this.lastCheck = Date.now();
      return this.users.filter(u => u.active);
    },
  },
  watch: {
    // RULE: vue/watch-deep-immediate
    bigObject: {
      handler() { this.recompute(); },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    notifyAll() {
      // RULE: vue/no-emit-in-loop
      for (const item of this.items) {
        this.$emit('processed', item);
      }
    },
  },
};
</script>
