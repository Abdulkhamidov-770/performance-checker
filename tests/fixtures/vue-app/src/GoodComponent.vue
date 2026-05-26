<template>
  <div>
    <li v-for="item in items" :key="item.id">{{ item.name }}</li>
    <div v-for="user in activeUsers" :key="user.id">{{ user.name }}</div>
    <span>{{ displayName }}</span>
  </div>
</template>

<script>
export default {
  name: 'GoodComponent',
  data() {
    return { items: [], users: [] };
  },
  computed: {
    activeUsers() {
      return this.users.filter(u => u.active);
    },
    displayName() {
      return this.user?.profile?.name ?? '';
    },
  },
};
</script>
