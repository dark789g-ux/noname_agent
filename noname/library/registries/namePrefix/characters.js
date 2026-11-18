function createNamePrefixCharacters() {
  return [
    [
      "雁翎",
      {
        getSpan: () => {
          const span = document.createElement("span");
          span.style.fontFamily = "NonameSuits";
          span.textContent = "🪶";
          return span.outerHTML;
        }
      }
    ],
    [
      "缘",
      {
        color: "#e8a0b7",
        nature: "woodmm"
      }
    ],
    [
      "虎牢",
      {
        color: "#5A2A1C",
        nature: "firemm"
      }
    ]
  ];
}
export {
  createNamePrefixCharacters
};
