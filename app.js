let fs;
let expandedFolders = new Set();
let nextId = 1;
window._selectedFolders = [];
window._contextSwitch = false;

function generateId() {
  return nextId++;
}

function assignIds(node) {
  if (!node.id) node.id = generateId();
  if (node.children) node.children.forEach((child) => assignIds(child));
}

function initializeFS() {
  let root = { name: "Root", type: "folder", children: [], id: generateId() };
  let trainingSchedule = {
    name: "Training Schedule",
    type: "folder",
    children: [],
    id: generateId(),
  };
  root.children.push(trainingSchedule);

  // Week 1 - Basic Techniques
  let week1 = {
    name: "Week 1 - Basic Techniques",
    type: "folder",
    children: [],
    id: generateId(),
  };
  trainingSchedule.children.push(week1);
  week1.children.push({
    name: "Monday.txt",
    type: "file",
    content: "Stance drills, basic jab and cross practice (1 hour)",
    id: generateId(),
  });
  week1.children.push({
    name: "Tuesday.txt",
    type: "file",
    content: "Core strength exercises, balance drills (1 hour)",
    id: generateId(),
  });
  week1.children.push({
    name: "Wednesday.txt",
    type: "file",
    content: "Basic combinations, shadowboxing (1 hour)",
    id: generateId(),
  });
  week1.children.push({
    name: "Thursday.txt",
    type: "file",
    content: "Partner drills on timing and rhythm (1 hour)",
    id: generateId(),
  });
  week1.children.push({
    name: "Friday.txt",
    type: "file",
    content: "Pad work focusing on form (1.5 hours)",
    id: generateId(),
  });

  // Additional weeks can be added in a similar fashion.
  return root;
}

function initDB(callback) {
  let request = indexedDB.open("PlaygroundOSDB", 1);
  request.onupgradeneeded = function (event) {
    let db = event.target.result;
    db.createObjectStore("filesystem");
  };
  request.onsuccess = function (event) {
    let db = event.target.result;
    let tx = db.transaction("filesystem", "readonly");
    let store = tx.objectStore("filesystem");
    let getReq = store.get("root");
    getReq.onsuccess = function () {
      if (getReq.result) {
        fs = getReq.result;
        assignIds(fs);
      } else {
        fs = initializeFS();
      }
      callback();
    };
    tx.oncomplete = function () {
      db.close();
    };
  };
}

function saveFS() {
  let request = indexedDB.open("PlaygroundOSDB", 1);
  request.onsuccess = function (event) {
    let db = event.target.result;
    let tx = db.transaction("filesystem", "readwrite");
    let store = tx.objectStore("filesystem");
    store.put(fs, "root");
    tx.oncomplete = function () {
      db.close();
    };
  };
}

function getNodeByPath(indices) {
  let node = fs;
  for (let idx of indices) {
    if (!node.children || node.children.length < idx) return null;
    node = node.children[idx - 1];
  }
  return node;
}

function outputMessage(msg) {
  const output = document.getElementById("output");
  if (output) {
    output.textContent += msg + "\n";
  } else {
    console.log(msg);
  }
}

function outputError(msg) {
  outputMessage("Error: " + msg);
}

function renderNode(node, depth, index) {
  const output = document.getElementById("output");
  let indent = "  ".repeat(depth);
  if (node.type === "folder") {
    output.textContent += `${indent}[${index}] ${node.name}\n`;
    if (expandedFolders.has(node.id)) {
      node.children.forEach((child, i) => renderNode(child, depth + 1, i + 1));
    }
  } else {
    output.textContent += `${indent}- ${node.name}\n`;
  }
}

function render() {
  if (document.getElementById("fileExplorer")) {
    renderUI();
    return;
  }
  const output = document.getElementById("output");
  output.textContent =
    "Playground OS\n-------------------\nMuay Thai Training Scheduler\n\nCommands:\n" +
    "    - Open Folder: [index].o or {folder name/subfolder}.o\n" +
    "    - Close Folder: [index].close\n" +
    "    - Create Folder: [index].create\n" +
    "    - Open File: [folder index].o.[file index] or {folder name}.o.{file name}\n" +
    "    - Add File: [index].add.{file name}\n" +
    "    - Delete File: [index].d\n" +
    "    - Rename File: [index].rn.{new name}\n" +
    "    - Search: s.{search term}\n\nFolders:\n";
  fs.children.forEach((child, i) => renderNode(child, 0, i + 1));
}

function openFolder(indices) {
  // Expand all folders along the given path
  let current = fs;
  for (let idx of indices) {
    if (!current.children) break;
    let child = current.children[idx - 1];
    if (child && child.type === "folder") {
      expandedFolders.add(child.id);
    }
    current = child;
  }

  let node = getNodeByPath(indices);
  if (node && node.type === "folder") {
    // Update the current folder context and persist it
    currentFolderIndices = indices;
    localStorage.setItem(
      "currentFolderIndices",
      JSON.stringify(currentFolderIndices)
    );

    outputMessage("Opened folder " + node.name);

    // Refresh display for CLI
    render();
  } else {
    outputError("Folder not found");
  }
}

function closeFolder(indices) {
  let node = getNodeByPath(indices);
  if (node && node.type === "folder") {
    expandedFolders.delete(node.id);
    outputMessage("Closed folder " + node.name);
    render();
  } else {
    outputError("Folder not found");
  }
}

function createFolder(indices, folderName) {
  let parent = getNodeByPath(indices);
  if ((parent && parent.type === "folder") || indices.length === 0) {
    if (!folderName) folderName = prompt("Enter folder name:");
    if (folderName) {
      // Open IndexedDB to get the highest existing ID
      let request = indexedDB.open("PlaygroundOSDB", 1);
      request.onsuccess = function (event) {
        let db = event.target.result;
        let tx = db.transaction("filesystem", "readonly");
        let store = tx.objectStore("filesystem");
        let getAllReq = store.getAll();

        getAllReq.onsuccess = function () {
          let allItems = getAllReq.result;
          let maxId = allItems.reduce((max, item) => Math.max(max, item.id), 0);
          let newId = maxId + 1;

          // Create the new folder with the new ID
          let newFolder = {
            name: folderName,
            type: "folder",
            children: [],
            id: newId,
          };
          parent.children.push(newFolder);
          outputMessage("Folder created: " + folderName);
          saveFS();
          render();
        };

        tx.oncomplete = function () {
          db.close();
        };
      };
    }
  } else {
    outputError("Parent folder not found");
  }
}

function addFile(indices, fileName, content) {
  let parent = getNodeByPath(indices);
  if (parent && parent.type === "folder") {
    let newFile = {
      name: fileName,
      type: "file",
      content: content || "",
      id: generateId(),
    };
    parent.children.push(newFile);
    outputMessage("File added: " + fileName);
    saveFS();
    render();
  } else {
    outputError("Parent folder not found");
  }
}

function openFile(indices) {
  let node = getNodeByPath(indices);
  if (node && node.type === "file") {
    outputMessage(`Content of ${node.name}:`);
    let content = node.content;
    // Handle array content if needed
    if (Array.isArray(content)) {
      content = content.join("");
    }
    outputMessage(content);
  } else {
    outputError("File not found");
  }
}

function deleteItem(indices) {
  if (indices.length === 0) return outputError("No item specified");
  let parentPath = indices.slice(0, -1);
  let indexToDelete = indices[indices.length - 1] - 1;
  let parent = getNodeByPath(parentPath);
  if (
    parent &&
    parent.type === "folder" &&
    parent.children.length > indexToDelete
  ) {
    let removed = parent.children.splice(indexToDelete, 1);
    outputMessage("Deleted " + removed[0].name);
    saveFS();
    render();
  } else {
    outputError("Item not found");
  }
}

function renameItem(indices, newName) {
  let node = getNodeByPath(indices);
  if (node) {
    node.name = newName;
    outputMessage("Renamed to " + newName);
    saveFS();
    render();
  } else {
    outputError("Item not found");
  }
}

function search(term) {
  let results = [];
  function traverse(node, path) {
    if (node.name.includes(term)) {
      results.push(path + node.name);
    }
    if (node.type === "folder") {
      node.children.forEach((child) => traverse(child, path + node.name + "/"));
    }
  }
  traverse(fs, "/");
  outputMessage("Search results for '" + term + "':\n" + results.join("\n"));
}

function handleCommand(input) {
  let indices = [];
  let pathPart = "";

  // Check for name-based paths with curly braces
  if (input.trim().startsWith("{")) {
    let endBrace = input.indexOf("}");
    if (endBrace === -1) {
      outputError("Invalid path syntax: missing closing brace");
      return;
    }
    pathPart = input.slice(1, endBrace); // Extract path between braces
    let namePath = pathPart.split("/").filter((n) => n.trim() !== "");

    indices = findIndicesByNames(namePath);
    if (!indices) {
      outputError("Path not found: {" + pathPart + "}");
      return;
    }

    // Remove the processed path part from the input, leaving the command portion
    input = input.slice(endBrace + 1);
  } else {
    // Fallback to numeric index parsing with square brackets
    let i = 0;
    let squarePathPart = "";
    while (input[i] === "[") {
      let close = input.indexOf("]", i);
      if (close === -1) break;
      squarePathPart += input.substring(i, close + 1);
      i = close + 1;
    }
    pathPart = squarePathPart;
    let ip = /\[([0-9]+)\]/g;
    let res;
    while ((res = ip.exec(pathPart)) !== null) {
      indices.push(parseInt(res[1]));
    }
    input = input.slice(i);
  }

  // Trim and adjust command part after path parsing
  let commandPart = input.trim();
  if (commandPart.startsWith(".")) commandPart = commandPart.slice(1);

  // Use resolved indices to execute commands
  if (commandPart.startsWith("create")) {
    let folderName = null;
    let match = commandPart.match(/create\{(.*?)\}/);
    if (match) {
      folderName = match[1];
    }
    createFolder(indices, folderName);
  } else if (commandPart.startsWith("o.")) {
    let remainder = commandPart.slice(2).trim();
    let fileIdentifier = null;
    let fileIndices;

    // Check if the file identifier starts with a curly brace for names with special characters or spaces
    if (remainder.startsWith("{")) {
      let closeBrace = remainder.indexOf("}");
      if (closeBrace === -1) {
        outputError("Invalid file name syntax: missing closing brace");
        return;
      }
      fileIdentifier = remainder.slice(1, closeBrace);
    } else {
      // Attempt to treat the remainder as a numeric file index or a simple name
      if (!isNaN(parseInt(remainder))) {
        fileIdentifier = parseInt(remainder);
      } else {
        fileIdentifier = remainder;
      }
    }

    // Resolve fileIndices based on fileIdentifier type
    if (typeof fileIdentifier === "number") {
      fileIndices = [...indices, fileIdentifier];
    } else {
      let folder = getNodeByPath(indices);
      if (folder && folder.type === "folder") {
        let found = false;
        for (let j = 0; j < folder.children.length; j++) {
          if (folder.children[j].name === fileIdentifier) {
            fileIndices = [...indices, j + 1];
            found = true;
            break;
          }
        }
        if (!found) {
          outputError("File not found: " + fileIdentifier);
          return;
        }
      } else {
        outputError("Folder not found for open file");
        return;
      }
    }

    openFile(fileIndices);
  } else if (commandPart === "o") {
    openFolder(indices);
  } else if (commandPart === "close") {
    closeFolder(indices);
  } else if (commandPart.startsWith("add.")) {
    let fileName = commandPart.slice(4);
    let lines = input.split("\n");
    let contentLines = [];
    for (let j = 1; j < lines.length; j++) {
      if (lines[j].trim() === "{end content}") break;
      contentLines.push(lines[j]);
    }
    let content = contentLines.join("\n");
    addFile(indices, fileName, content);
  } else if (commandPart === "d") {
    deleteItem(indices);
  } else if (commandPart.startsWith("rn.")) {
    let newName = commandPart.slice(3);
    renameItem(indices, newName);
  } else {
    outputError("Unknown command");
  }
}

// Event listener for input commands
const commandInput = document.getElementById("commandInput");
if (commandInput) {
  commandInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      let input = e.target.value.trim();
      if (input) {
        handleCommand(input);
      }
      e.target.value = "";
    }
  });
}

// Initialize the app
initDB(function () {
  if (document.getElementById("fileExplorer")) {
    renderUI();

    // Attach GUI-specific event listeners
    const newFolderBtn = document.getElementById("newFolderBtn");
    const newFileBtn = document.getElementById("newFileBtn");

    if (newFolderBtn) {
      newFolderBtn.addEventListener("click", () => {
        let folderName = prompt("Enter new folder name:");
        if (folderName) {
          // Use current folder context or root if none selected
          let indices = currentFolderIndices.length ? currentFolderIndices : [];
          createFolder(indices, folderName);
        }
      });
    }

    if (newFileBtn) {
      newFileBtn.addEventListener("click", () => {
        let fileName = prompt("Enter new file name:");
        if (!fileName) return;
        let content = prompt("Enter content for the file:");
        let indices = currentFolderIndices.length ? currentFolderIndices : [];
        addFile(indices, fileName, content);
      });
    }
  } else {
    render();
  }
});

let currentFolderIndices = [];

function findPathById(node, targetId, path = []) {
  if (node.id === targetId) return path;
  if (node.type === "folder") {
    for (let i = 0; i < node.children.length; i++) {
      let child = node.children[i];
      let result = findPathById(child, targetId, path.concat(i + 1));
      if (result) return result;
    }
  }
  return null;
}

function createTree(node, indices, expandedPathIds) {
  let el;
  if (node.type === "folder") {
    el = document.createElement("div");
    el.className = "folder";

    let title = document.createElement("div");
    title.className = "folder-title";
    title.textContent = node.name;
    title.dataset.indices = JSON.stringify(indices);
    el.appendChild(title);

    // Create and append delete button for folder
    let deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "🗑"; // icon for delete
    title.appendChild(deleteBtn);

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering folder selection
      let storedIndices = JSON.parse(title.dataset.indices);
      deleteItem(storedIndices);
    });

    let childrenContainer = document.createElement("div");
    childrenContainer.className = "folder-contents";

    node.children.forEach((child, childIndex) => {
      childrenContainer.appendChild(
        createTree(child, indices.concat(childIndex + 1), expandedPathIds)
      );
    });

    if (expandedPathIds.has(node.id)) {
      childrenContainer.style.display = "block";
    } else {
      childrenContainer.style.display = "none";
    }

    title.addEventListener("click", (event) => {
      const folderId = node.id; // Use 'node' instead of 'child'

      if (event.shiftKey) {
        // If Shift key is pressed, toggle selection
        if (window._selectedFolders.includes(folderId)) {
          // Deselect if already selected
          window._selectedFolders = window._selectedFolders.filter(
            (id) => id !== folderId
          );
          title.classList.remove("selected");
        } else {
          // Select the folder if not already selected
          window._selectedFolders.push(folderId);
          title.classList.add("selected");
          window._contextSwitch = true;
        }
      } else {
        // Regular click behavior: clear previous selections and select this folder only
        window._selectedFolders = [folderId];
        window._contextSwitch = true;
        // Clear selection from all folder titles and mark this folder as selected
        document
          .querySelectorAll(".folder-title")
          .forEach((el) => el.classList.remove("selected"));
        title.classList.add("selected");

        // Parse stored indices from the title's data attribute
        let storedIndices = JSON.parse(title.dataset.indices);

        // Toggle expansion and update currentFolderIndices accordingly
        if (childrenContainer.style.display === "none") {
          // Expanding the folder
          childrenContainer.style.display = "grid";
          currentFolderIndices = storedIndices;
        } else {
          // Collapsing the folder
          childrenContainer.style.display = "none";
          // Set current folder to parent by removing last index
          let parentPath = storedIndices.slice(0, -1);
          currentFolderIndices = parentPath;
        }

        // Persist the updated current folder path
        localStorage.setItem(
          "currentFolderIndices",
          JSON.stringify(currentFolderIndices)
        );
      }
    });

    el.appendChild(childrenContainer);
  } else {
    el = document.createElement("div");
    el.className = "file";
    el.textContent = node.name;
    el.dataset.indices = JSON.stringify(indices);

    // Create and append delete button for file
    let deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "🗑";
    el.appendChild(deleteBtn);

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      let storedIndices = JSON.parse(el.dataset.indices);
      deleteItem(storedIndices);
    });

    // File click opens modal to view content
    el.addEventListener("click", () => {
      openFileModal(node);
    });
  }
  return el;
}

function renderUI() {
  const explorer = document.getElementById("fileExplorer");
  if (!explorer) return;
  explorer.innerHTML = "";

  // Compute folder IDs along the current navigation path
  let expandedPathIds = new Set();
  let node = fs;
  for (let idx of currentFolderIndices) {
    if (!node.children) break;
    node = node.children[idx - 1];
    if (node) expandedPathIds.add(node.id);
  }

  fs.children.forEach((child, i) => {
    explorer.appendChild(createTree(child, [i + 1], expandedPathIds)); // Pass expandedPathIds
  });
}

function openFileModal(fileNode) {
  let modal = document.querySelector(".modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "modal";

    let header = document.createElement("div");
    header.className = "modal-header";

    let title = document.createElement("h2");
    title.className = "modal-title";
    header.appendChild(title);

    let buttons = document.createElement("div");
    buttons.className = "modal-buttons";

    let maximizeBtn = document.createElement("button");
    maximizeBtn.textContent = "🔳"; // maximize icon
    let closeBtn = document.createElement("button");
    closeBtn.textContent = "✖"; // close icon

    buttons.appendChild(maximizeBtn);
    buttons.appendChild(closeBtn);
    header.appendChild(buttons);

    let body = document.createElement("div");
    body.className = "modal-body";

    modal.appendChild(header);
    modal.appendChild(body);
    document.body.appendChild(modal);

    maximizeBtn.addEventListener("click", () => {
      modal.classList.toggle("maximized");
    });

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
      modal.classList.remove("maximized");
    });
  }

  // Update modal contents
  modal.querySelector(".modal-title").textContent = fileNode.name;

  // Handle file content if it's an array
  let content = fileNode.content;
  if (Array.isArray(content)) {
    content = content.join(""); // Join array elements without commas.
    // Optionally, use '\n' if each element should start on a new line:
    // content = content.join('\n');
  }

  modal.querySelector(".modal-body").textContent = content;
  modal.style.display = "flex";
}

function findIndicesByNames(names) {
  let indices = [];
  let current = fs;
  for (let name of names) {
    if (!current.children) return null;
    let found = false;
    for (let i = 0; i < current.children.length; i++) {
      if (current.children[i].name === name) {
        indices.push(i + 1);
        current = current.children[i];
        found = true;
        break;
      }
    }
    if (!found) return null; // Name not found in current level
  }
  return indices;
}
async function downloadData() {
  try {
    let chatEntries = [];
    if (
      window.chatMemory &&
      typeof window.chatMemory.getChatHistory === "function"
    ) {
      chatEntries = await window.chatMemory.getChatHistory();
    }

    const combinedData = {
      filesystem: fs,
      chatHistory: chatEntries,
    };

    const dataStr = JSON.stringify(combinedData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "combined_data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    outputError("Download failed: " + err.message);
  }
}

function importData() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // Restore filesystem
        if (importedData.filesystem) {
          fs = importedData.filesystem;
          assignIds(fs);
          saveFS();
          render(); // Rebuild OS interface after import
        }

        // Restore chat history
        if (
          window.chatMemory &&
          typeof window.chatMemory.addChatEntry === "function" &&
          importedData.chatHistory &&
          Array.isArray(importedData.chatHistory)
        ) {
          for (let entry of importedData.chatHistory) {
            try {
              await window.chatMemory.addChatEntry(
                entry.userMessage,
                entry.botResponse
              );
            } catch (err) {
              console.error("Error adding chat entry during import:", err);
            }
          }
        }
      } catch (err) {
        outputError("Import failed: " + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// After initializing the app and rendering UI or console
const downloadBtn = document.getElementById("downloadBtn");
const importBtn = document.getElementById("importBtn");

if (downloadBtn) {
  downloadBtn.addEventListener("click", downloadData);
}
if (importBtn) {
  importBtn.addEventListener("click", importData);
}
