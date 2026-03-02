function returnColor(col) {
  if (Array.isArray(col)) {
    return "linear-gradient(" + col.join(", ") + ")";
  }
  return col;
}

async function populateThemes() {
  const presetContainer = document.getElementById("themesContainer");
  const userContainer = document.getElementById("userThemesContainer");

  const url = chrome.runtime.getURL("../themes.json");
  const res = await fetch(url);
  const json = await res.json();
  const currentTheme = await retrieveSetting("currentTheme");
  const userThemes = await retrieveSetting("userThemes");

  presetContainer.innerHTML = "";
  userContainer.innerHTML = "";

  //Preset themes
  for (const theme of json) {
    const clone = await loadTemplate("themePreview");

    clone.style.setProperty("--primary", theme.primary);
    clone.style.setProperty("--secondary", theme.secondary);
    clone.style.setProperty("--background", returnColor(theme.background));

    clone.querySelector(".themePreviewLabel").textContent = theme.name;

    clone.addEventListener("click", function () {
      [...userContainer.querySelectorAll(".themePreviewSelected")]
        .concat([...presetContainer.querySelectorAll(".themePreviewSelected")])
        .forEach((node) => node.classList.remove("themePreviewSelected"));
      clone.classList.add("themePreviewSelected");
      setSetting("currentTheme", theme);
    });

    if (theme.name == currentTheme.name && (!currentTheme.userMade ?? true)) {
      clone.classList.add("themePreviewSelected");
    }

    presetContainer.appendChild(clone);
  }

  //user themes
  for (const theme of userThemes) {
    const clone = await loadTemplate("themePreview");

    clone.style.setProperty("--primary", theme.primary);
    clone.style.setProperty("--secondary", theme.secondary);
    clone.style.setProperty("--background", returnColor(theme.background));

    clone.querySelector(".themePreviewLabel").textContent = theme.name;

    clone
      .querySelector(".themeDeleteBtn")
      .addEventListener("click", (event) => {
        event.stopPropagation();
        const newThemes = userThemes.filter((item) => item.name !== theme.name);
        setSetting("userThemes", newThemes);
        populateThemes();
      });

    clone.addEventListener("click", function () {
      [...userContainer.querySelectorAll(".themePreviewSelected")]
        .concat([...presetContainer.querySelectorAll(".themePreviewSelected")])
        .forEach((node) => node.classList.remove("themePreviewSelected"));
      clone.classList.add("themePreviewSelected");
      setSetting("currentTheme", theme);
    });

    if (theme.name == currentTheme.name && (currentTheme.userMade ?? false)) {
      clone.classList.add("themePreviewSelected");
    }

    clone.classList.add("userMadeTheme");

    userContainer.appendChild(clone);
  }
  const addButton = await loadTemplate("customThemeAddButton");
  addButton.onclick = async () => {
    const menu = await loadTemplate("customThemeMenu");
    menu.querySelector(".blookedex-closeBtn").onclick = () => {
      menu.remove();
    };
    menu.querySelector(".blookedex-closeBtnLarge").onclick = async () => {
      if (
        Array.isArray(
          JSON.parse(menu.querySelector(".customThemeMenuInput").value),
        )
      ) {
        for (const obj of JSON.parse(
          menu.querySelector(".customThemeMenuInput").value,
        )) {
          const parsed = validateTheme(JSON.stringify(obj));
          if (parsed.valid) {
            const userThemes = await retrieveSetting("userThemes");
            if (userThemes.some((theme) => theme.name == parsed.value.name)) {
              alert("Name Already In Use");
              return;
            }
            parsed.value.userMade = true;
            const newThemes = [...userThemes, parsed.value];
            await setSetting("userThemes", newThemes);
            populateThemes();
          } else {
            alert("Invalid format.");
          }
        }
        menu.remove();
        return;
      }
      const parsed = validateTheme(
        menu.querySelector(".customThemeMenuInput").value,
      );
      if (parsed.valid) {
        const userThemes = await retrieveSetting("userThemes");
        if (userThemes.some((theme) => theme.name == parsed.value.name)) {
          alert("Name Already In Use");
          return;
        }
        parsed.value.userMade = true;
        const newThemes = [...userThemes, parsed.value];
        await setSetting("userThemes", newThemes);
        populateThemes();
        menu.remove();
      } else {
        alert("Invalid format.");
      }
    };
    document.body.appendChild(menu);
  };
  userContainer.appendChild(addButton);
}

//Settings
async function setTabEnabled(enabled, name) {
  const tabBlacklist = await retrieveSetting("tabBlacklist");

  const exists = tabBlacklist.includes(name);
  let newList = tabBlacklist;

  if (enabled && exists) {
    newList = tabBlacklist.filter((x) => x !== name);
  } else if (!enabled && !exists) {
    newList = [...tabBlacklist, name];
  }

  if (newList !== tabBlacklist) {
    await setSetting("tabBlacklist", newList);
  }
}

function validateTheme(jsonString) {
  try {
    const theme = JSON.parse(jsonString);

    if (!theme || typeof theme !== "object" || Array.isArray(theme)) {
      return { valid: false };
    }

    const allowedKeys = ["name", "primary", "secondary", "background"];
    const keys = Object.keys(theme);

    const hasExactKeys =
      keys.length === allowedKeys.length &&
      allowedKeys.every((key) => keys.includes(key));

    const hasValidTypes =
      typeof theme.name === "string" &&
      typeof theme.primary === "string" &&
      typeof theme.secondary === "string" &&
      (typeof theme.background === "string" ||
        (Array.isArray(theme.background) &&
          theme.background.length === 2 &&
          theme.background.every((value) => typeof value === "string")));

    return hasExactKeys && hasValidTypes
      ? { valid: true, value: theme }
      : { valid: false };
  } catch {
    return { valid: false };
  }
}

(async () => {
  const marketContainer = document.querySelector(".marketContainer");
  const url = chrome.runtime.getURL("../packs.json");
  const res = await fetch(url);
  const json = await res.json();

  for (const pack of json) {
    const packEl = await loadTemplate("marketPack");
    packEl.querySelector(".marketPackLabel").textContent = pack.name;
    packEl.querySelector(".marketPackCost").textContent =
      pack.cost == 0 ? "free" : pack.cost;
    packEl.querySelector(".marketPackDesc").textContent = pack.description;
    packEl.style.background = pack.background;
    marketContainer.appendChild(packEl);
  }
})();

populateThemes();

//for blookedex page info
document.getElementById("version").textContent =
  "Version " + chrome.runtime.getManifest().version;

(async () => {
  const settings = await retrieveSettings();

  console.log(settings);

  if (settings.tabBlacklist.includes("Blookedex")) {
    document.getElementById("setting-blookedextab").checked = false;
  }
  if (settings.tabBlacklist.includes("Index")) {
    document.getElementById("setting-indextab").checked = false;
  }
  if (!settings.useMarketMenu) {
    document.getElementById("setting-marketmenu").checked = false;
  }
  if (!settings.useBouncyAnims) {
    document.getElementById("setting-bouncyanims").checked = false;
  }
  if (!settings.useTitanHeaders) {
    document.getElementById("setting-titanheaders").checked = false;
  }
  for (const setting of document.querySelectorAll(".setting")) {
    setting
      .querySelector("input[type='checkbox']")
      .addEventListener("change", (event) => {
        document.querySelector(".settingsRefreshTip").style.opacity = "1";
        if (event.target.id == "setting-blookedextab") {
          if (!event.target.checked) {
            (async () => {
              const menu = await loadTemplate("popupMenu");
              menu.querySelector(".blookedex-closeBtn").onclick = () => {
                menu.remove();
              };
              menu.querySelector(".blookedex-closeBtnLarge").onclick = () => {
                menu.remove();
              };
              menu.querySelector(".blookedex-popupMenu-message").textContent =
                "To access themes and settings without the sidebar tab, click the extension icon while on Blooket.";
              document.body.appendChild(menu);
            })();
          }
          setTabEnabled(event.target.checked, "Blookedex");
        }
        if (event.target.id == "setting-indextab") {
          setTabEnabled(event.target.checked, "Index");
        }
        if (event.target.id == "setting-marketmenu") {
          setSetting("useMarketMenu", event.target.checked);
        }
        if (event.target.id == "setting-bouncyanims") {
          setSetting("useBouncyAnims", event.target.checked);
        }
        if (event.target.id == "setting-titanheaders") {
          setSetting("useTitanHeaders", event.target.checked);
        }
      });
  }
})();

document.getElementById("changelogBtn").onclick = async () => {
  const res = await fetch("../pages/changelog.html");
  const doc = await res.text();
  document.body.innerHTML = doc;
  document.body.animate(
    [
      {
        opacity: "0",
        transform: "translateX(100px)",
      },
      {
        opacity: "1",
        transform: "translateX(0)",
      },
    ],
    { duration: 300, easing: "cubic-bezier(0,.15,.5,1)" },
  );
};
