// chat-memory.js

// Initialize IndexedDB for chat memory
const chatMemoryDBName = "ChatMemoryDB";
const chatStoreName = "ChatStore";
let db;

// Open (or create) the IndexedDB
function initMemoryDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(chatMemoryDBName, 1);

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      if (!db.objectStoreNames.contains(chatStoreName)) {
        const store = db.createObjectStore(chatStoreName, {
          keyPath: "id",
          autoIncrement: true,
        });
        // Create indexes if needed
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.errorCode);
      reject(event.target.errorCode);
    };
  });
}

// Add a new chat entry to the DB
async function addChatEntry(userMessage, botResponse) {
  // Ensure the database connection is open
  if (!db) {
    await initMemoryDB();
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([chatStoreName], "readwrite");
      const store = transaction.objectStore(chatStoreName);
      const timestamp = new Date().toISOString();

      const entry = {
        userMessage,
        botResponse,
        timestamp,
      };

      const request = store.add(entry);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        console.error("Error adding chat entry:", event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error("Transaction error in addChatEntry:", error);
      reject(error);
    }
  });
}

// Retrieve all chat entries from the DB
async function getAllChatEntries() {
  // Ensure the database connection is open
  if (!db) {
    await initMemoryDB();
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([chatStoreName], "readonly");
      const store = transaction.objectStore(chatStoreName);
      const request = store.getAll();

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error("Error retrieving chat entries:", event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error("Transaction error in getAllChatEntries:", error);
      reject(error);
    }
  });
}

// Populate chat history from DB
async function populateChatHistory() {
  const chatHistoryDiv = document.getElementById("chatHistory");
  chatHistoryDiv.innerHTML = ""; // Clear existing history

  try {
    const entries = await getAllChatEntries();
    // Remove the first entry
    const filteredEntries = entries.slice(1);

    filteredEntries.forEach((entry) => {
      // Create user message element
      const userMsg = document.createElement("div");
      userMsg.className = "user-message";
      userMsg.innerHTML = `<strong>User:</strong> ${convertMarkdown(
        entry.userMessage
      )}`;
      chatHistoryDiv.appendChild(userMsg);

      // Create bot message element
      const botMsg = document.createElement("div");
      botMsg.className = "bot-message";
      botMsg.innerHTML = `<strong>Bot:</strong> ${convertMarkdown(
        entry.botResponse
      )}`;
      chatHistoryDiv.appendChild(botMsg);
    });

    // Scroll to the bottom
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
  } catch (error) {
    console.error("Error populating chat history:", error);
  }
}

// Initialize the chat memory on script load
document.addEventListener("DOMContentLoaded", () => {
  initMemoryDB()
    .then(() => {
      // Optionally, populate chat history if the modal is already open
      const chatModal = document.getElementById("chatModal");
      if (chatModal.style.display === "flex") {
        populateChatHistory();
      }
    })
    .catch((error) => {
      console.error("Failed to initialize chat memory DB:", error);
    });
});

// Expose functions to be used by chat.js
window.chatMemory = {
  addChatEntry,
  populateChatHistory,
  getChatHistory: async function () {
    return await getAllChatEntries();
  },
};
