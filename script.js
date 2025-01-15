document.addEventListener("DOMContentLoaded", () => {
  const fileExplorer = document.getElementById("fileExplorer");
  const chatBtn = document.getElementById("chatBtn");
  const chatModal = document.getElementById("chatModal");
  const chatCloseBtn = document.getElementById("chatCloseBtn");
  const chatSendBtn = document.getElementById("chatSendBtn");
  const chatInput = document.getElementById("chatInput");
  const chatHistory = document.getElementById("chatHistory");
  const chatContext = document.getElementById("chatContext");

  let fs = {
    name: "Root",
    type: "folder",
    children: [
      { name: "Folder 1", type: "folder", children: [] },
      {
        name: "Folder 2",
        type: "folder",
        children: [
          { name: "File 1.txt", type: "file", content: "Content of File 1" },
        ],
      },
    ],
  };

  let currentFolderIndices = [];
  let selectedFolders = [];

  function getNodeByPath(indices) {
    let node = fs;
    for (const idx of indices) {
      node = node.children[idx];
    }
    return node;
  }

  function createTree(node, indices = []) {
    const el = document.createElement("div");
    el.className = node.type;

    if (node.type === "folder") {
      const title = document.createElement("div");
      title.className = "folder-title";
      title.textContent = node.name;
      title.dataset.indices = JSON.stringify(indices);
      el.appendChild(title);

      title.addEventListener("click", (e) => {
        if (e.shiftKey) {
          // Shift+Click to select multiple folders
          if (selectedFolders.includes(indices)) {
            selectedFolders = selectedFolders.filter((idx) => idx !== indices);
            title.classList.remove("selected");
          } else {
            selectedFolders.push(indices);
            title.classList.add("selected");
          }
        } else {
          selectedFolders = [indices];
          currentFolderIndices = indices;
        }
      });

      const childrenContainer = document.createElement("div");
      childrenContainer.className = "folder-contents";
      node.children.forEach((child, i) =>
        childrenContainer.appendChild(createTree(child, [...indices, i]))
      );
      el.appendChild(childrenContainer);
    } else if (node.type === "file") {
      const title = document.createElement("div");
      title.className = "file-title";
      title.textContent = node.name;
      el.appendChild(title);
    }
    return el;
  }

  function renderExplorer() {
    fileExplorer.innerHTML = "";
    fileExplorer.appendChild(createTree(fs));
  }

  function openChatModal() {
    let combinedContext = selectedFolders
      .map((indices) => generateFolderContext(getNodeByPath(indices)))
      .join("\n\n");

    chatContext.textContent = combinedContext || "No folder selected.";
    chatModal.style.display = "flex";
  }

  chatBtn.addEventListener("click", openChatModal);
  chatCloseBtn.addEventListener("click", () => {
    chatModal.style.display = "none";
  });

  renderExplorer();
});
