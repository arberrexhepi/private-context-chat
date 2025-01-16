document.addEventListener("DOMContentLoaded", () => {
  const chatBtn = document.getElementById("chatBtn");
  const chatModal = document.getElementById("chatModal");
  const chatCloseBtn = document.getElementById("chatCloseBtn");
  const chatSendBtn = document.getElementById("chatSendBtn");
  const chatInput = document.getElementById("chatInput");
  const chatHistory = document.getElementById("chatHistory");
  const chatContext = document.getElementById("chatContext");
  let selectedFolders = []; // Array to hold references to selected folder nodes

  // Function to generate Markdown context from a folder node
  function generateFolderContext(folderNode, depth = 3) {
    if (!folderNode || folderNode.type !== "folder") {
      return "No folder selected or folder has no data.";
    }

    let md = "";
    // Use different header levels based on depth (capped at 6)
    const headerPrefix = "#".repeat(Math.min(depth, 6));

    folderNode.children.forEach((child) => {
      if (child.type === "folder") {
        md += `${headerPrefix} Folder: ${child.name}\n\n`;
        // Recursively gather contents of nested folders
        md += generateFolderContext(child, depth + 1);
      } else if (child.type === "file") {
        md += `${headerPrefix}# File: ${child.name}\n`;
        let content = Array.isArray(child.content)
          ? child.content.join("")
          : child.content;
        md += content + "\n\n";
      }
    });

    return md || "Folder is empty.";
  }

  function getFolderById(id, node = fs) {
    console.log("Searching for ID:", id, "in node:", node);
    if (node.id === id) return node;
    if (node.type === "folder") {
      for (let child of node.children) {
        let result = getFolderById(id, child);
        if (result) return result;
      }
    }
    return null;
  }

  function openChatModal() {
    let combinedContext = "";

    // Check if there are multiple selected folders
    if (window._selectedFolders.length > 0) {
      window._selectedFolders.forEach((folderId) => {
        // Use getFolderById to retrieve a folder node by its ID
        let folderNode = getFolderById(folderId);
        if (folderNode) {
          let contextText = generateFolderContext(folderNode);
          combinedContext += contextText + "\n\n";
        }
      });
    } else {
      // Fallback: use current folder if no multi-selection
      let currentFolderIndices =
        JSON.parse(localStorage.getItem("currentFolderIndices")) || [];
      let currentFolder = getNodeByPath(currentFolderIndices);
      combinedContext = generateFolderContext(currentFolder);
    }

    let contextFormatted = convertMarkdown(combinedContext);
    chatContext.innerHTML = contextFormatted;

    // Populate chat history from memory
    if (
      window.chatMemory &&
      typeof window.chatMemory.populateChatHistory === "function"
    ) {
      window.chatMemory.populateChatHistory();
    }
    chatModal.style.display = "flex";
  }

  function closeChatModal() {
    chatModal.style.display = "none";
  }

  chatBtn.addEventListener("click", openChatModal);
  chatCloseBtn.addEventListener("click", closeChatModal);

  chatSendBtn.addEventListener("click", async () => {
    const prompt = document.getElementById("chatInput").value;
    const chatHistoryElement = document.getElementById("chatHistory");
    if (!prompt.trim()) return;

    // Append user message to chat history in the UI
    let userMsg = document.createElement("div");
    userMsg.textContent = "User: " + prompt;
    chatHistoryElement.appendChild(userMsg);
    chatInput.value = "";

    // Check if there are previous messages
    let chatHistory = [];
    if (
      window.chatMemory &&
      typeof window.chatMemory.getChatHistory === "function"
    ) {
      chatHistory = await window.chatMemory.getChatHistory();
    }

    // If no previous history, set up an initial simulation
    if (!chatHistory || chatHistory.length === 0) {
      const initialUserInput =
        "Consider THIS Context to the user's query, using relevant parts of Context to respond to user. Context: " +
        chatContext.textContent;
      const initialBotResponse =
        "I will maintain this context as the ground truth for the responses I provide throughout our conversation";

      // Simulate initial interaction
      if (
        window.chatMemory &&
        typeof window.chatMemory.addChatEntry === "function"
      ) {
        await window.chatMemory.addChatEntry(
          initialUserInput,
          initialBotResponse
        );
      }

      // Display the initial interaction
      const initialUserMsg = document.createElement("div");
      initialUserMsg.textContent = "User: " + initialUserInput;
      //chatHistoryElement.appendChild(initialUserMsg);

      const initialBotMsg = document.createElement("div");
      initialBotMsg.textContent = "Bot: " + initialBotResponse;
      //chatHistoryElement.appendChild(initialBotMsg);

      // Update chat history after initial simulation
      if (
        window.chatMemory &&
        typeof window.chatMemory.getChatHistory === "function"
      ) {
        chatHistory = await window.chatMemory.getChatHistory();
      }
    }

    // Prepare messages for the fetch request using the full chat history
    let messages = [];
    let isFirstMessage = false;
    if (chatHistory && chatHistory.length > 0) {
      messages = chatHistory
        .map((entry) => [
          { role: "user", content: entry.userMessage },
          { role: "assistant", content: entry.botResponse },
        ])
        .flat();

      if (window._contextSwitch === true) {
        messages = [
          { role: "system", content: "System: " + chatContext.textContent },
          ...messages,
        ];
        window._contextSwitch = false; // Reset the context switch flag
      }
    } else {
      isFirstMessage = true;
    }

    // Add the current user input to the messages
    messages.push({ role: "user", content: prompt });
    console.log(messages);

    try {
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3.2:3b",
          messages: messages,
          num_ctx: 50000,
          stream: false,
          format: {
            type: "object",
            properties: {
              response: { type: "string" },
            },
            required: ["response"],
          },
          repeat_penalty: 1.1,
          temperature: 1.1,
          keep_alive: "1s",
          top_k: 40,
          num_predict: 128,
        }),
      });

      const data = await response.json();
      const parsedContent = JSON.parse(data.message.content);
      const formattedText = convertMarkdown(parsedContent.response);

      // Store the new chat entry in memory
      if (
        window.chatMemory &&
        typeof window.chatMemory.addChatEntry === "function"
      ) {
        await window.chatMemory.addChatEntry(prompt, parsedContent.response);
        // Re-populate chat history for consistent styling
        if (isFirstMessage !== true) {
          window.chatMemory.populateChatHistory();
        }
      }

      chatHistoryElement.scrollTop = chatHistoryElement.scrollHeight;
    } catch (error) {
      const errorMsg = document.createElement("div");
      errorMsg.textContent = "Error: " + error.message;
      chatHistoryElement.appendChild(errorMsg);
    }
  });
});

function convertMarkdown(mdText) {
  // Escape HTML tags to prevent injection
  mdText = mdText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Convert code blocks
  mdText = mdText.replace(
    /```(\w+)?([\s\S]*?)```/g,
    function (match, lang, code) {
      return `<pre><code class="${lang}">${code}</code></pre>`;
    }
  );

  // Convert inline code
  mdText = mdText.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // Convert headers
  mdText = mdText.replace(/^###### (.*)$/gm, "<h6>$1</h6>");
  mdText = mdText.replace(/^##### (.*)$/gm, "<h5>$1</h5>");
  mdText = mdText.replace(/^#### (.*)$/gm, "<h4>$1</h4>");
  mdText = mdText.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  mdText = mdText.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  mdText = mdText.replace(/^# (.*)$/gm, "<h1>$1</h1>");

  // Convert blockquotes
  mdText = mdText.replace(/^> (.*)$/gm, "<blockquote>$1</blockquote>");

  // Convert horizontal rules
  mdText = mdText.replace(/^---$/gm, "<hr>");

  // Convert unordered lists
  mdText = mdText.replace(/^\s*-\s+(.*)$/gm, "<ul>\n<li>$1</li>\n</ul>");
  mdText = mdText.replace(/<\/ul>\s*<ul>/g, "");

  // Convert ordered lists
  mdText = mdText.replace(/^\s*\d+\.\s+(.*)$/gm, "<ol>\n<li>$1</li>\n</ol>");
  mdText = mdText.replace(/<\/ol>\s*<ol>/g, "");

  // Convert images
  mdText = mdText.replace(
    /!\[([^\]\n]*)\]\(([^)\n]+)\)/g,
    '<img alt="$1" src="$2">'
  );

  // Convert links
  mdText = mdText.replace(
    /\[([^\]\n]+)\]\(([^)\n]+)\)/g,
    '<a href="$2">$1</a>'
  );

  // Convert bold and italic text
  mdText = mdText.replace(/\*\*\*(.+?)\*\*\*/g, "<b><i>$1</i></b>");
  mdText = mdText.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  mdText = mdText.replace(/\*(.+?)\*/g, "<i>$1</i>");
  mdText = mdText.replace(/___(.+?)___/g, "<b><i>$1</i></b>");
  mdText = mdText.replace(/__(.+?)__/g, "<b>$1</b>");
  mdText = mdText.replace(/_(.+?)_/g, "<i>$1</i>");

  // Split text into paragraphs based on double newlines
  const paragraphs = mdText.split(/\n\n+/);

  // Wrap each paragraph in <p> tags and replace single newlines with <br>
  mdText = paragraphs
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return mdText;
}
