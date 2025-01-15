let fs = {
  name: "Root",
  type: "folder",
  children: [],
  id: 1,
};

// Initialize the file system
function initializeFS() {
  // Add some default data
  fs.children.push({
    name: "Foods",
    type: "folder",
    children: [
      {
        name: "Snacks",
        type: "folder",
        children: [
          {
            name: "Snack Menu.txt",
            type: "file",
            content: "Chips, Popcorn, Nachos",
          },
        ],
      },
      {
        name: "Dinner",
        type: "folder",
        children: [
          {
            name: "Dinner Recipes.txt",
            type: "file",
            content: "Pasta, Pizza, Steak",
          },
        ],
      },
    ],
  });
}

initializeFS();
