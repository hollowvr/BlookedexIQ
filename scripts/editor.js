// Make the DIV element draggable:
dragElement(document.getElementById("editor"));

function dragElement(elmnt) {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  if (elmnt.querySelector("#draggable")) {
    // if present, the header is where you move the DIV from:
    elmnt.querySelector("#draggable").onmousedown = dragMouseDown;
  } else {
    // otherwise, move the DIV from anywhere inside the DIV:
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = elmnt.offsetTop - pos2 + "px";
    elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

document.getElementById("primary").addEventListener("input", (e) => {
  document.body.style.setProperty("--primary", e.target.value);
  document.body.style.setProperty(
    "--primaryDark",
    "color-mix(in oklab, var(--primary), black 35%)",
  );
});

document.getElementById("secondary").addEventListener("input", (e) => {
  document.body.style.setProperty("--secondary", e.target.value);
});

document.getElementById("top").addEventListener("input", (e) => {
  document.body.style.setProperty(
    "--background",
    `linear-gradient(${e.target.value}, ${document.getElementById("bottom").value})`,
  );
});

document.getElementById("bottom").addEventListener("input", (e) => {
  document.body.style.setProperty(
    "--background",
    `linear-gradient(${document.getElementById("top").value}, ${e.target.value})`,
  );
});

document.getElementById("createBtn").onclick = async () => {
  const nameBox = await loadTemplate("editorName");

  nameBox.querySelector("#nameBtn").onclick = async () => {
    const name = document.getElementById("name").value;
    const userThemes = await retrieveSetting("userThemes");
    if (userThemes.some((theme) => name == theme.name)) {
      alert("Name is already in use! Please pick another.");
      return;
    }

    const themeObj = {
      name: document.getElementById("name").value,
      primary: document.getElementById("primary").value,
      secondary: document.getElementById("secondary").value,
      background: [
        document.getElementById("top").value,
        document.getElementById("bottom").value,
      ],
      userMade: true,
    };

    const newThemes = [...userThemes, themeObj];
    await setSetting("userThemes", newThemes);
    // tell parent to close
    window.parent.postMessage("closeEditor", "https://dashboard.blooket.com");
  };

  nameBox.querySelector(".blookedex-closeBtn").onclick = () => nameBox.remove();

  document.body.appendChild(nameBox);
};
