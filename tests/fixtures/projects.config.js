export default {
  concurrency: 2,
  historyDir: './.perf-history-test',
  projects: [
    { name: 'vue-fixture', path: './vue-app' },
    { name: 'react-fixture', path: './react-app' },
  ],
};
