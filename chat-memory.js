const dbName = "ChatMemoryDB";
const storeName = "ChatStore";
let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve();
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

function addChatEntry(userMessage, botResponse) {
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  store.add({ userMessage, botResponse, timestamp: Date.now() });
}

function getChatHistory() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initDB().then(() => console.log("Chat Memory Initialized"));
});
