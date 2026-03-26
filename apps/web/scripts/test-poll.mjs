const res = await fetch("http://localhost:3002/api/gmail/poll", {
  method: "POST",
  headers: { "x-cron-secret": "dharma-cron-2026" },
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
