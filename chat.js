document.addEventListener("DOMContentLoaded", () => {
  const chatBtn = document.getElementById("chatBtn");
  const chatModal = document.getElementById("chatModal");
  const chatCloseBtn = document.getElementById("chatCloseBtn");
  const chatSendBtn = document.getElementById("chatSendBtn");
  const chatInput = document.getElementById("chatInput");
  const chatHistory = document.getElementById("chatHistory");
  const chatContext = document.getElementById("chatContext");
  let selectedFolders = []; // Array to hold references to selected folder nodes

  function getFolderByPath(path, node = fs) {
    let currentNode = node;
    for (let index of path) {
      if (currentNode.children && currentNode.children[index - 1]) {
        currentNode = currentNode.children[index - 1];
      } else {
        return null;
      }
    }
    return currentNode;
  }

  function generateFolderContext(folderNode, depth = 3) {
    if (!folderNode || folderNode.type !== "folder") {
      return "No folder selected or folder has no data.";
    }

    let md = "";
    const headerPrefix = "#".repeat(Math.min(depth, 6));

    md += `[Start folder {${folderNode.name}}]\n\n`;
    md += `${headerPrefix} Folder: ${folderNode.name}\n\n`;

    folderNode.children.forEach((child) => {
      if (child.type === "folder") {
        md += generateFolderContext(child, depth + 1);
      } else if (child.type === "file") {
        md += `[Start file {${child.name}}]\n`;
        md += `${headerPrefix}# File: ${child.name}\n`;
        let content = Array.isArray(child.content)
          ? child.content.join("")
          : child.content;
        md += content + "\n";
        md += `[End file {${child.name}}]\n\n`;
      }
    });

    md += `[End folder {${folderNode.name}}]\n\n`;

    return md || "Folder is empty.";
  }
  async function openChatModal() {
    let combinedContext = "";

    // Retrieve selected folders from localStorage
    let selectedFolders =
      JSON.parse(localStorage.getItem("selectedFolders")) || [];

    // Check if there are multiple selected folders
    if (selectedFolders.length > 0) {
      for (const folderPath of selectedFolders) {
        let folderNode = getFolderByPath(folderPath);
        if (folderNode) {
          let contextText = generateFolderContext(folderNode);
          combinedContext += `[Selected folder {${folderNode.name}}]\n\n`;
          combinedContext += contextText + "\n\n";
        }
      }
    } else {
      // Fallback: use current folder if no multi-selection
      let currentFolderIndices =
        JSON.parse(localStorage.getItem("currentFolderIndices")) || [];
      let currentFolder = getFolderByPath(currentFolderIndices);
      combinedContext = generateFolderContext(currentFolder);
    }

    let contextFormatted = convertMarkdown(combinedContext);
    chatContext.innerHTML = contextFormatted;

    // Populate chat history from memory
    if (
      window.chatMemory &&
      typeof window.chatMemory.populateChatHistory === "function"
    ) {
      await window.chatMemory.populateChatHistory();
    }
    chatModal.style.display = "flex";
  }

  chatBtn.addEventListener("click", openChatModal);
  chatCloseBtn.addEventListener("click", () => {
    chatModal.style.display = "none";
  });
  chatBtn.addEventListener("click", openChatModal);
  chatCloseBtn.addEventListener("click", () => {
    chatModal.style.display = "none";
  });
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
        "I will maintain this context as the ground truth for the responses I provide throughout our conversation, additionally I will consider the conversation context as well to provide better responses. I will not hallucinate responses for things I do not know, as what I may know about a query may be in the context. If not in the context I will act as Q&A before responding. I will be intelligent, helpful, insightful, and will prove to be a valuable cognitive partner for the user.";

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
        alert(chatContext.textContent);
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
