const tabs = [
  {
    label: "Blookedex",
    pageSource: "../pages/blookedex-tab.html",
  },
  {
    label: "Index",
    pageSource: "../pages/index-tab.html",
  },
];

//function for if the page uses react (blooks and discover page) because this changes the page layouts
function isReact() {
  if (findElement("__variable_")) {
    document.body.classList.add("blookedex-react");
    return true;
  }
  return false;
}

async function retrieveJSON(url) {
  const u = chrome.runtime.getURL(url);
  const res = await fetch(u);
  const json = await res.json();
  return json;
}

//returns the elements which has a class that contains the argument
function findElement(str, parent = document) {
  const els = parent.querySelectorAll(`[class*="${str}"]`);
  if (els.length === 0) return null;
  return els.length === 1 ? els[0] : [...els];
}
//makes Element.findElement(str) usable
Element.prototype.findElement = function (str) {
  return findElement(str, this);
};

//removes the class from an element if the class of the element contains string classn
function removeClass(el, classn) {
  for (const Iclass of Array.from(el.classList)) {
    if (Iclass.includes(classn)) el.classList.remove(Iclass);
  }
}
//makes Element.removeClass(str) usable
Element.prototype.removeClass = function (str) {
  return removeClass(this, str);
};

//retrieves setting from chrome storage api
async function retrieveSettings() {
  if (window.blookedexSettingsStore) {
    return window.blookedexSettingsStore;
  }

  const defaultSettings = {
    tabBlacklist: ["Index"],
    currentTheme: {
      name: "Blooket",
      primary: "#9A48AA",
      secondary: "#08C2D0",
      background: ["#0bc2cf", "#349aef"],
    },
    userThemes: [],
    useMarketMenu: true,
    useBouncyAnims: true,
    useTitanHeaders: true,
    adminCodes: [],
  };

  const { userSettings = {} } = await chrome.storage.sync.get("userSettings");

  const settings = {
    ...defaultSettings,
    ...userSettings,
  };

  window.blookedexSettingsStore = settings;
  return settings;
}

async function retrieveSetting(setting) {
  const settings = await retrieveSettings();
  return settings[setting];
}

async function setSetting(key, value) {
  const settings = await retrieveSettings();
  settings[key] = value;

  await chrome.storage.sync.set({
    userSettings: settings,
  });

  window.blookedexSettingsStore = settings;
}

async function removeSetting(key) {
  const settings = await retrieveSettings();
  delete settings[key];

  await chrome.storage.sync.set({
    userSettings: settings,
  });

  window.blookedexSettingsStore = settings;
}

function safeSetImage(node, src) {
  if (node.tagName != "IMG") return;
  node.src = src;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === "src") {
        const newImg = node.cloneNode(true);
        newImg.src = src;

        node.parentElement.insertBefore(newImg, node);
        node.style.display = "none";
        observer.disconnect();
      }
    }
  });

  observer.observe(node, {
    attributes: true,
    attributeFilter: ["src"],
  });
}

function loadCustomPage(src) {
  const page = document.getElementById("blookedex-page");
  const newSrc = src.includes("://") ? src : chrome.runtime.getURL(src);
  if (page) {
    page.src = newSrc;
    return;
  }

  const pageBody = document.createElement("div");
  pageBody.id = "blookedex-custom-body";

  const customPage = document.createElement("iframe");
  customPage.style.visibility = "hidden";
  customPage.id = "blookedex-page";
  customPage.src = newSrc;

  customPage.addEventListener("load", (e) => {
    customPage.style.removeProperty("visibility");
    e.target.animate(
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
  });

  const customBackground = document.createElement("div");
  customBackground.style =
    "position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;";
  customBackground.className = "blookedex-custom-background";

  pageBody.append(customBackground);
  pageBody.appendChild(customPage);

  if (isReact()) {
    const main = document.querySelector("main");
    //Hides all elements from previous page
    Array.from(main.children).forEach((El) => {
      El.classList.add("blookedex-hidden");
    });
    main.appendChild(pageBody);
  } else {
    //Hides all elements from previous page
    let profileBody = findElement("_profileBody_");
    //stats page fix
    if (!profileBody) profileBody = findElement("_profileBodyMax_");

    profileBody.classList.add("blookedex-hidden");

    if (findElement("_topRightRow_")) {
      for (const child of Array.from(findElement("_topRightRow_").children)) {
        if (!child.className.includes("_profileContainer_"))
          child.classList.add("blookedex-hidden");
      }
    }
    //appends to body element, does it this way to account for stats page
    profileBody.parentElement.appendChild(pageBody);
  }
}

//inserts blookedex tab into page sidebar
async function insertSidebarTabs(footer) {
  const react = isReact();

  const sidebar = react
    ? (findElement("Sidebar_list_")[0] ?? findElement("Sidebar_list_"))
    : findElement("_sidebar_");

  if (sidebar.dataset.tabsInserted == "true") return;

  let tabBlacklist = await retrieveSetting("tabBlacklist");

  for (const tab of tabs) {
    if (tabBlacklist.includes(tab.label)) continue;
    const tabElement = await loadTemplate("sidebarTab");
    tabElement.onclick = () => {
      loadCustomPage(tab.pageSource);
      correctTabs(footer);
      tabElement.classList.add("blookedex-sidebarTab-selected");
    };

    tabElement.querySelector(".blookedex-sidebarTab-label").textContent =
      tab.label;
    tabElement
      .querySelector(".blookedex-sidebarTab-icon")
      .appendChild(
        await loadTemplate("tabIcon-" + tab.label.replace(" ", "-")),
      );

    if (isReact()) {
      const li = document.createElement("li");
      li.appendChild(tabElement);
      sidebar.appendChild(li);
    } else {
      sidebar.insertBefore(
        tabElement,
        sidebar.children[sidebar.children.length - 1],
      );
    }
  }
  sidebar.dataset.tabsInserted = "true";
}

function colorBlacklisted(node, color_blacklist) {
  for (let el = node; el && el instanceof Element; el = el.parentElement) {
    for (const cls of el.classList) {
      for (const bad of color_blacklist) {
        if (cls.includes(bad)) return true;
      }
    }
  }
  return false;
}

function correctColor(el) {
  if (!(el instanceof Element)) return;

  const color_blacklist = ["Sidebar_link_", "ButtonPicker_radio_"];
  if (colorBlacklisted(el, color_blacklist)) return;

  const style = getComputedStyle(el);
  ["color", "backgroundColor", "borderColor"].forEach((prop) => {
    const val = style[prop];
    if (val === "rgb(154, 73, 170)") {
      el.style[prop] = "var(--blookedex-primary)";
    }
    if (val === "rgb(64, 17, 95)") {
      el.style[prop] = "var(--blookedex-primaryDark)";
    }
    if (val === "rgb(11, 194, 207)" || val === "rgb(122, 3, 157)") {
      el.style[prop] = "var(--blookedex-secondary)";
    }
    if (val === "rgb(154, 73, 170)" && el.className.includes("statContainer")) {
      el.style[prop] = "var(--blookedex-secondary)";
    }
  });
}

function returnColor(col) {
  if (Array.isArray(col)) {
    return "linear-gradient(" + col.join(", ") + ")";
  }
  return col;
}

//function that updates the classes of the sidebar tabs for visual correctness
function correctTabs(footer) {
  const link = isReact() ? "Sidebar_link_" : "_pageSelected_";
  const active = isReact() ? "Sidebar_active" : "_pageSelected_";
  for (const tab of document.querySelectorAll("[class*=" + link + "]")) {
    tab.removeClass(active);
    tab.addEventListener("click", function () {
      location.href = this.href;
      return false;
    });
  }
  for (const tab of document.querySelectorAll(
    ".blookedex-sidebarTab-selected",
  )) {
    tab.classList.remove("blookedex-sidebarTab-selected");
  }
  for (const tab of footer.querySelectorAll("a")) {
    if (tab.href.includes("?news")) continue;
    tab.addEventListener("click", function () {
      location.href = this.href;
      return false;
    });
  }
}

//function to apply the theme to the page
async function applyTheme(theme) {
  if (!theme) theme = await retrieveSetting("currentTheme");

  const inject = () => {
    let themeStyles = document.getElementById("blookedex-theme-style");
    if (!themeStyles) {
      const style = document.createElement("style");
      style.id = "blookedex-theme-style";
      document.head.appendChild(style);
      themeStyles = style;
    }
    themeStyles.innerHTML = `:root{--blookedex-primary:${returnColor(theme.primary)};--blookedex-secondary:${returnColor(theme.secondary)};--blookedex-background:${returnColor(theme.background)}}`;
  };

  inject();
}

let templateDoc;
async function loadTemplateFile() {
  if (templateDoc) return;
  const res = await fetch(chrome.runtime.getURL("../pages/templates.html"));
  const text = await res.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  templateDoc = doc;
}

async function loadTemplate(id) {
  if (!templateDoc) {
    await loadTemplateFile();
  }

  const template = templateDoc.getElementById(id);
  if (!template) {
    console.error("Template not found:", id);
    return null;
  }

  return template.content.firstElementChild.cloneNode(true);
}

async function settingsCSS() {
  const useBouncyAnims = await retrieveSetting("useBouncyAnims");
  if (useBouncyAnims) {
    const bouncyStyles = document.getElementById("blookedex-bouncy-style");
    if (!bouncyStyles) {
      const link = document.createElement("link");
      link.id = "blookedex-bouncy-style";
      link.rel = "stylesheet";
      link.href = chrome.runtime.getURL("../styles/settings/bouncyAnims.css");
      document.head.appendChild(link);
    }
  }

  const useTitanHeaders = await retrieveSetting("useTitanHeaders");
  if (useTitanHeaders) {
    const headersStyles = document.getElementById("blookedex-headers-style");
    if (!headersStyles) {
      const link = document.createElement("link");
      link.id = "blookedex-headers-style";
      link.rel = "stylesheet";
      link.href = chrome.runtime.getURL("../styles/settings/titanHeaders.css");
      document.head.appendChild(link);
    }
  }
}

async function handleSettingChange(changes, area) {
  applyTheme(changes.userSettings.newValue.currentTheme);
}

//set blooks to custom blook
async function setToCustomBlook(node) {
  const { customBlook = {} } = await chrome.storage.local.get("customBlook");
  if (Object.keys(customBlook).length === 0) return;

  let src = customBlook.url;
  src = src.includes(":") ? src : chrome.runtime.getURL(src);
  safeSetImage(node, src);
}

function injectBG() {
  const bg = document.createElement("div");
  bg.className = "blookedex-custom-background blookedex-injected-background";
  if (isReact() && !document.querySelector(".blookedex-injected-background")) {
    findElement("layout_main_").prepend(bg);
  }
}

function enableCloseBtns(menu) {
  if (menu.querySelector(".blookedex-closeBtn")) {
    menu.querySelector(".blookedex-closeBtn").onclick = () => menu.remove();
  }
  if (
    menu.querySelector(".blookedex-closeBtnLarge") &&
    menu
      .querySelector(".blookedex-closeBtnLarge")
      .textContent.toLowerCase()
      .includes("close")
  ) {
    menu.querySelector(".blookedex-closeBtnLarge").onclick = () =>
      menu.remove();
  }
}

//
// Market
//

//handles and creates the new shop buy blooks page
async function handleShopMenu(node) {
  const useMarketMenu = await retrieveSetting("useMarketMenu");
  if (!useMarketMenu) return;
  //original close button to reuse logic
  const closeButtonOriginal = node.findElement("_button_");
  const menuNoTokens = await loadTemplate("shopMenuNoTokens");
  menuNoTokens.querySelector(".blookedex-closeBtn").onclick = () => {
    closeButtonOriginal.click();
  };
  menuNoTokens.querySelector(".blookedex-closeBtnLarge").onclick = () => {
    closeButtonOriginal.click();
  };

  async function buyMenuLoaded() {
    const menu = await loadTemplate("shopMenu");
    try {
      const originalButtons = Array.from(node.findElement("_button_"));
      const packName =
        node.firstChild.firstChild.childNodes[1].textContent.substr(13);
      const packCost =
        node.firstChild.firstChild.childNodes[3].textContent.match(/\d+/);
      let packImgSrc;
      Array.from(findElement("_packImg_")).forEach((pack) => {
        if (packName.includes(pack.alt)) {
          packImgSrc = pack.src;
        }
      });

      menu.querySelector(".blookedex-closeBtn").onclick = () => {
        originalButtons[0].click();
      };
      menu.querySelector(".blookedex-shopMenu-buyBtn").onclick = () => {
        originalButtons[1].click();
      };
      menu.querySelector(".blookedex-shopMenu-packName").textContent = packName;
      menu.querySelector(".blookedex-shopMenu-cost").textContent = packCost;
      const packImg = menu.querySelector(".blookedex-shopMenu-packImg");
      if (packImgSrc)
        packImg.style.setProperty("background-image", `url(${packImgSrc})`);
      menu.addEventListener("mousemove", (e) => {
        const rect = packImg.getBoundingClientRect();
        const x = e.clientX - rect.left + 100;
        const y = e.clientY - rect.top;

        let rotateX = (y / rect.height - 0.5) * -10;
        let rotateY = (x / rect.width - 0.5) * 10;

        rotateX = Math.max(-7, Math.min(7, rotateX));
        rotateY = Math.max(-19, Math.min(19, rotateY));

        packImg.style.transform = `translateY(-50%) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });

      menu.addEventListener("mouseleave", () => {
        packImg
          .animate(
            { transform: "translateY(-50%) rotateX(0deg) rotateY(20deg)" },
            { duration: 200, easing: "ease" },
          )
          .finished.then(() => packImg.style.removeProperty("transform"));
      });

      let chances = node
        .querySelector("i")
        .dataset.tip.replace("Ding: ", "Dink: ")
        .split("</div><div>");
      chances.splice(0, 1);
      chances[chances.length - 1] = chances[chances.length - 1].slice(0, -12);

      const chancesObject = chances.map((entry) => {
        const [name, chanceStr] = entry.split(": ");
        return {
          name,
          chance: parseFloat(chanceStr.replace("%", "")),
        };
      });

      const previewScoller = menu.querySelector(
        ".blookedex-shopMenu-chancesPreviewScroller",
      );

      const chancesPreview = menu.querySelector(
        ".blookedex-shopMenu-chancesPreview",
      );

      chancesPreview.onclick = () => {
        const chancesMenu = menu.querySelector(".blookedex-chancesMenu");
        if (chancesMenu) {
          removeMenu(chancesMenu, menu);
        } else {
          openChancesMenu(chancesObject, menu);
          chancesPreview.classList.add(
            "blookedex-shopMenu-chancesPreviewSelected",
          );
          menu.classList.add("blookedex-shopMenu-previewShifted");
        }
      };

      for (let i = 0; i < 2; i++) {
        chancesObject.forEach((obj) =>
          previewScoller.appendChild(
            Object.assign(document.createElement("img"), {
              src:
                "https://ac.blooket.com/marketassets/blooks/" +
                obj.name.replace(/\s+/g, "").toLowerCase() +
                ".svg",
            }),
          ),
        );
      }

      menuNoTokens.remove();
      node.parentNode.appendChild(menu);
    } catch (err) {
      menu.remove();
      node.classList.remove("blookedex-hidden");
    }
  }

  async function removeMenu(chancesMenu, menu) {
    const useBouncyAnims = await retrieveSetting("useBouncyAnims");

    const chancesPreview = menu.querySelector(
      ".blookedex-shopMenu-chancesPreview",
    );
    if (useBouncyAnims) {
      chancesMenu
        .animate(
          {
            transform: "translateY(-50%) scale(0)",
            left: "100px",
            opacity: "0",
          },
          {
            duration: 500,
            easing: "cubic-bezier(0.68, -0.1, 0.27, 1.55)",
          },
        )
        .finished.then(() => chancesMenu.remove());
    } else chancesMenu.remove();
    chancesPreview.classList.remove(
      "blookedex-shopMenu-chancesPreviewSelected",
    );
    menu.classList.remove("blookedex-shopMenu-previewShifted");
  }

  async function openChancesMenu(chancesObject, menu) {
    const chancesMenu = await loadTemplate("chancesMenu");
    chancesMenu
      .querySelector(".blookedex-closeBtn")
      .addEventListener("click", () => removeMenu(chancesMenu, menu));
    const container = chancesMenu.querySelector(
      ".blookedex-chancesMenuContainer",
    );
    chancesObject.forEach(async (chance) => {
      const row = await loadTemplate("chancesMenuRow");
      row.querySelector("img").src =
        "https://ac.blooket.com/marketassets/blooks/" +
        chance.name.replace(/\s+/g, "").toLowerCase() +
        ".svg";
      row.querySelector(".blookedex-chancesMenuRowLabel").textContent =
        chance.name;
      row.querySelector(".blookedex-chancesMenuRowChance").textContent =
        chance.chance + "%";
      container.appendChild(row);
    });
    menu.appendChild(chancesMenu);
  }

  //handles if the player initially doesn't have enough tokens, but then does
  const menuButtons = Array.from(node.findElement("_button_"));
  node.classList.add("blookedex-hidden");
  if (menuButtons.length === 2) {
    buyMenuLoaded();
  } else {
    node.parentNode.appendChild(menuNoTokens);

    const observer = new MutationObserver(() => {
      const updatedButtons = Array.from(node.findElement("_button_"));
      if (updatedButtons.length === 2) {
        observer.disconnect();
        buyMenuLoaded();
      }
    });
    observer.observe(node, { childList: true, subtree: true });
  }
}

function marketWAF(node) {
  //buy blook pack ui
  if (node.tagName == "FORM" && node.parentNode.className.includes("_modal_")) {
    handleShopMenu(node);
  }

  //custom cashiers/stores
  if (
    node.className.includes("_cashierBlook_") ||
    node.className.includes("_storeImg_")
  ) {
    (async () => {
      const currentTheme = await retrieveSetting("currentTheme");

      if (
        currentTheme.customShopkeeper &&
        node.className.includes("_cashierBlook_")
      ) {
        const link = currentTheme.customShopkeeper[0];
        const src = link.includes("://") ? link : chrome.runtime.getURL(link);
        safeSetImage(node, src);
        node.style.scale = currentTheme.customShopkeeper[1];
      }
      if (currentTheme.customStore && node.className.includes("_storeImg_")) {
        const link = currentTheme.customStore;
        const src = link.includes("://") ? link : chrome.runtime.getURL(link);
        safeSetImage(node, src);
      }
    })();
  }
}

//
// Stats
//

async function statsWAF(node) {
  //custom blookedex player icons
  if (node.className.includes("_blooksHolder_")) {
    //remove custom blook functionality
    node.querySelectorAll("[class*=_blookContainer_]").forEach((blook) => {
      blook.addEventListener("click", () => {
        chrome.storage.local.set({
          customBlook: {},
        });
      });
    });

    const userTitle = await loadTemplate("playerIconTitle");
    userTitle.textContent = "Blooket Icons-";
    node.prepend(userTitle);

    //blookedex custom blooks
    const url = chrome.runtime.getURL("../blooks.json");
    const res = await fetch(url);
    const json = await res.json();
    let customBlooks = [...json];
    if (customBlooks.length == 0) {
      const noBlooks = await loadTemplate("iconsNoBlooks");
      node.prepend(noBlooks);
    }

    const addCustom = await loadTemplate("customBlookAdd");
    addCustom
      .querySelector(".blookedex-customBlookAdd input")
      .addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result; // data:image/png;base64,...
          const { userIcons = [] } =
            await chrome.storage.local.get("userIcons");
          const newIcons = [...userIcons, { url: base64, isUserIcon: true }];
          await chrome.storage.local.set({ userIcons: newIcons });
          node.parentElement.parentElement.firstElementChild.click();
          findElement("_headerBlookContainer_").click();
        };
        reader.readAsDataURL(file);
      });
    node.prepend(addCustom);
    const { userIcons = [] } = await chrome.storage.local.get("userIcons");

    //append all the custom blook elements
    for (const blook of [...(userIcons || []), ...(customBlooks || [])]) {
      const newblook = await loadTemplate("customBlookIconList");
      const img = newblook.querySelector("img");

      if (blook.isUserIcon ?? false) {
        newblook.querySelector(".blookedex-iconDeleteBtn").style.display =
          "flex";
        newblook.querySelector(".blookedex-iconDeleteBtn").onclick = async (
          e,
        ) => {
          e.stopPropagation();

          const { userIcons = [] } =
            await chrome.storage.local.get("userIcons");
          const newIcons = userIcons.filter((item) => item.url !== blook.url);
          await chrome.storage.local.set({ userIcons: newIcons });
          newblook.remove();
        };
      }

      const src = blook.url.includes(":")
        ? blook.url
        : chrome.runtime.getURL(blook.url);
      img.src = src;
      img.addEventListener("click", (e) => {
        chrome.storage.local.set({ customBlook: blook });
        document
          .querySelectorAll(
            "[class*=_headerBlook_]:has([class*=_blook_]), [class*=rofile]:has([class*=_blook_])",
          )
          .forEach((el) => (el.querySelector("[class*=_blook_]").src = src));
        node.parentElement.parentElement.firstElementChild.click();
      });
      node.prepend(newblook);
    }
    const blookedexTitle = await loadTemplate("playerIconTitle");
    node.prepend(blookedexTitle);
  }

  //main blook fix
  if (
    node.className.includes("_blook_") &&
    node.parentElement.className.includes("_headerBlook_")
  ) {
    setToCustomBlook(node);
  }
}

//
// Runtime
//

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      WalkAndFix(node);
      node.querySelectorAll?.("*").forEach(WalkAndFix);
    }
  }
});

let previous_path;
function WalkAndFix(node) {
  if (
    !(node instanceof Element) ||
    typeof node.className !== "string" ||
    !node.className
  )
    return;

  if (previous_path != location.href) {
    previous_path = location.href;
    document.body.removeClass("page-");
    document.body.classList.add("page-" + location.pathname.split("/")[1]);
  }
  if (["/blooks", "/stats"].includes(window.location.pathname)) {
    //Backgrounds
    if (
      node.className.includes("_background_") &&
      !node.parentElement.className.includes("BlookScore_container_")
    ) {
      node.id = "blookedex-backgroundStatsBlooks";
    }
  } else if (
    node.className.includes("_body_") &&
    node.parentNode.parentNode.id == "app"
  ) {
    node.classList.add("blookedex-custom-background");
  }
  if (node.className.includes("page_wrapper_")) {
    if (isReact() && location.pathname !== "/blooks") {
      injectBG();
    }
  }

  correctColor(node);

  //sidebar
  if (
    (node.className.includes("_bottomRow_") &&
      node.parentNode.className.includes("_sidebar_")) ||
    node.className.includes("Sidebar_footerWrapper")
  ) {
    insertSidebarTabs(node);
  }

  //top right blook icon fix
  if (
    node.className.includes("_blook_") &&
    node.parentElement.parentElement.className.includes("rofile")
  ) {
    setToCustomBlook(node);
  }
  marketWAF(node);
  statsWAF(node);
}

if (!location.pathname.includes("/upgrade")) {
  observer.observe(document.body, { subtree: true, childList: true });

  loadTemplateFile();
  isReact();
  applyTheme();
  settingsCSS();

  Array.from(document.querySelectorAll("*")).forEach((node) => {
    WalkAndFix(node);
  });

  document.body.classList.add("page-" + location.pathname.split("/")[1]);
  previous_path = location.href;

  if (isReact() && location.pathname !== "/blooks") {
    injectBG();
  }

  //handles user updating their settings
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.userSettings) {
      handleSettingChange(changes, area);
    }
  });

  //handles first time install
  chrome.storage.sync.get({ firstInstall: false }).then(async (res) => {
    if (res.firstInstall) {
      const installMenu = await loadTemplate("installedMenu");
      installMenu.querySelector(".blookedex-closeBtn").onclick = () => {
        chrome.storage.sync.remove("firstInstall");
        installMenu.remove();
      };
      installMenu.querySelector(".blookedex-closeBtnLarge").onclick = () => {
        chrome.storage.sync.remove("firstInstall");
        installMenu.remove();
      };
      installMenu.querySelector(".sidebarimg").src = chrome.runtime.getURL(
        "/images/resources/sidebartab.png",
      );
      installMenu.querySelector(".normaltheme").onclick = () =>
        setSetting("currentTheme", {
          name: "Blooket",
          primary: "#9A48AA",
          secondary: "#08C2D0",
          background: ["#0bc2cf", "#349aef"],
        });
      installMenu.querySelector(".darktheme").onclick = () =>
        setSetting("currentTheme", {
          name: "Blooket Dark",
          primary: "hsl(0,0%,14%)",
          secondary: "hsl(0,0%,20%)",
          background: ["hsl(0,0%,9%)", "hsl(0,0%,5%)"],
        });
      installMenu.querySelector(".krakentheme").onclick = () =>
        setSetting("currentTheme", {
          name: "Kraken",
          primary: "rgba(0, 51, 102, 0.8)",
          secondary: "#1abc9c",
          background:
            "linear-gradient(to bottom, #7db9e8 -5%, #005073 10%, #003e58 25%, #002a3d 55%, #000022 80%)",
          customShopkeeper: [
            "https://ac.blooket.com/marketassets/blooks/kraken.svg",
            "1",
          ],
          customStore: "/images/blooks/krakenshop.png",
        });
      document.body.appendChild(installMenu);
    }
  });

  let editor;
  window.addEventListener("message", receiveMessage, false);
  async function receiveMessage(event) {
    // IMPORTANT: Verify the sender's origin for security
    if (!event.origin.includes(`chrome-extension://${chrome.runtime.id}`)) {
      return;
    }

    if (event.data == "openEditor") {
      editor = await loadTemplate("editorInitial");
      editor.querySelector(".editorIframe").src = chrome.runtime.getURL(
        "../../pages/customThemeEditor.html",
      );

      editor.querySelector(".editorIframe").addEventListener("load", (e) => {
        e.target.style.removeProperty("visibility");
        editor.querySelector("h1").remove();
      });

      editor.querySelector(".editorCloseBtn").onclick = () => {
        editor.remove();
      };

      document.body.appendChild(editor);
    } else if (event.data == "openEditor") {
      console.log("test");
      const editor = document.querySelector(".editorParent");
      editor.remove();
    }
    if (event.data == "closeEditor") {
      if (editor instanceof HTMLElement) {
        editor.remove();
        if (document.getElementById("blookedex-page")) {
          document.getElementById("blookedex-page").src =
            document.getElementById("blookedex-page").src;
        }
      }
    }
    if (event.data == "reloadTab") {
      if (document.getElementById("blookedex-page")) {
        document.getElementById("blookedex-page").src =
          document.getElementById("blookedex-page").src;
      }
    }
  }
}
