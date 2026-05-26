// RULE: common/no-full-library-import
import _ from 'lodash';
import moment from 'moment';

// RULE: common/no-console-in-prod
console.log('debug info');

export function processItems(items) {
  // RULE: common/await-in-loop
  const results = [];
  for (const item of items) {
    results.push(fetchItem(item.id));
  }
  return Promise.all(results);
}

export async function sequentialFetch(ids) {
  const out = [];
  // RULE: common/await-in-loop (true await in loop)
  for (const id of ids) {
    const r = await fetch('/api/' + id);
    out.push(r);
  }
  return out;
}

export function startPolling() {
  // RULE: common/uncleared-timer
  setInterval(() => {
    console.log('tick');
  }, 1000);
}

export function attachListeners() {
  // RULE: common/unremoved-event-listener
  window.addEventListener('scroll', () => {
    console.log('scrolled');
  });
}

export function heavyLoop(data) {
  for (const chunk of data) {
    // RULE: common/heavy-sync-computation
    const parsed = JSON.parse(chunk);
    JSON.stringify(parsed);
  }
}

async function fetchItem(id) {
  return fetch('/api/items/' + id);
}
