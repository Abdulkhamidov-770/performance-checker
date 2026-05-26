<template>
  <div>
    <!-- multi-line v-for — key 4 qator narida (regex window=2 topa olmaydi) -->
    <li
      v-for="user in users"
      class="user-row"
      data-test="user-row"
    >
      {{ user.name }}
    </li>
  </div>
</template>

<script>
export default {
  methods: {
    // Comment ichida: this.x = 1 (regex bunda false positive bo'lardi)
    fakeMethod() {
      // bu computed emas, oddiy method
      this.foo = 1;
    },
  },
};
</script>
