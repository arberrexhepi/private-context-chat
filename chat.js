document.addEventListener("DOMContentLoaded", () => {
  const chatBtn = document.getElementById("chatBtn");
  const chatModal = document.getElementById("chatModal");
  const chatCloseBtn = document.getElementById("chatCloseBtn");
  const chatSendBtn = document.getElementById("chatSendBtn");
  const chatInput = document.getElementById("chatInput");
  const chatHistory = document.getElementById("chatHistory");
  const chatContext = document.getElementById("chatContext");

  window._selectedFolders = []; // To track selected folders

  // Open chat modal
  chatBtn.addEventListener("click", () => {
    if (window._selectedFolders.length === 0) {
      chatContext.textContent = "No folder selected.";
    } else {
      const context = window._selectedFolders
        .map((folderId) => generateFolderContext(findFolderById(folderId)))
        .join("\n\n");
      chatContext.textContent = context;
    }
    chatModal.style.display = "flex";
  });

  // Close chat modal
  chatCloseBtn.addEventListener("click", () => {
    chatModal.style.display = "none";
  });

  // Send chat message
  chatSendBtn.addEventListener("click", async () => {
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;
    chatHistory.innerHTML += `<div>User: ${userMessage}</div>`;

    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:3b",
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    const result = await response.json();
    chatHistory.innerHTML += `<div>Bot: ${result.response}</div>`;
    chatInput.value = "";
  });
});
