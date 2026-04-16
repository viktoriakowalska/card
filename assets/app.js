(function () {
  const body = document.body;
  const brandRoot = document.getElementById("brand-label");
  const contentRoot = document.getElementById("content");
  const eyebrowRoot = document.getElementById("eyebrow");
  const heroRoot = document.getElementById("hero-content");
  const langSwitcherRoot = document.getElementById("lang-switcher");
  const pageTitle = document.querySelector("title");
  const DEFAULT_LANG = "pl";
  let currentMarkdown = "";
  const url = new URL(window.location.href);
  let lang = DEFAULT_LANG;

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getLanguageName(code) {
    try {
      return new Intl.DisplayNames([code], { type: "language" }).of(code) || code.toUpperCase();
    } catch (error) {
      return code.toUpperCase();
    }
  }

  function normalizeLanguages(codes) {
    return [...new Set(codes.map((code) => code.toLowerCase()))].sort();
  }

  async function loadLanguageManifest() {
    try {
      const response = await fetch("./content/languages.json", { cache: "no-store" });

      if (response.ok) {
        const manifest = await response.json();
        const languages = normalizeLanguages(manifest.languages || []);

        if (languages.length) {
          return {
            defaultLang: languages.includes(manifest.default) ? manifest.default : languages[0],
            languages,
          };
        }
      }
    } catch (error) {
      // Fallback to local directory listing below.
    }

    try {
      const response = await fetch("./content/", { cache: "no-store" });

      if (response.ok) {
        const html = await response.text();
        const matches = [...html.matchAll(/content\.([a-z0-9-]+)\.md/gi)].map((match) => match[1]);
        const languages = normalizeLanguages(matches);

        if (languages.length) {
          return {
            defaultLang: languages.includes(DEFAULT_LANG) ? DEFAULT_LANG : languages[0],
            languages,
          };
        }
      }
    } catch (error) {
      // Ignore and use the hard fallback below.
    }

    return {
      defaultLang: DEFAULT_LANG,
      languages: [DEFAULT_LANG],
    };
  }

  function updateUrl(activeLang) {
    const nextUrl = new URL(window.location.href);

    nextUrl.searchParams.set("lang", activeLang);
    window.history.replaceState({}, "", nextUrl);
  }

  function renderLanguageSwitcher(languages, activeLang) {
    const activeLanguageName = getLanguageName(activeLang);

    langSwitcherRoot.innerHTML = `
      <div class="lang-switcher" aria-label="Language switcher">
        <a class="lang-current" href="./index.html?lang=${activeLang}" aria-current="page">
          <span class="lang-current-code">${escapeHtml(activeLang.toUpperCase())}</span>
          <span class="lang-current-name">${escapeHtml(activeLanguageName)}</span>
        </a>
        <button
          class="lang-toggle"
          type="button"
          aria-expanded="false"
          aria-haspopup="true"
          aria-label="Open language menu"
        >
          <span class="lang-toggle-lines" aria-hidden="true"></span>
        </button>
        <div class="lang-popover" hidden>
          ${languages
            .map((code) => {
              const isActive = code === activeLang;

              return `
                <a
                  class="lang-option${isActive ? " is-active" : ""}"
                  href="./index.html?lang=${code}"
                  ${isActive ? 'aria-current="page"' : ""}
                >
                  <span class="lang-option-code">${escapeHtml(code.toUpperCase())}</span>
                  <span class="lang-option-name">${escapeHtml(getLanguageName(code))}</span>
                </a>
              `;
            })
            .join("")}
        </div>
      </div>
    `;

    const toggle = langSwitcherRoot.querySelector(".lang-toggle");
    const popover = langSwitcherRoot.querySelector(".lang-popover");

    function closePopover() {
      toggle.setAttribute("aria-expanded", "false");
      popover.hidden = true;
      langSwitcherRoot.classList.remove("is-open");
    }

    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isOpen));
      popover.hidden = isOpen;
      langSwitcherRoot.classList.toggle("is-open", !isOpen);
    });

    document.addEventListener("click", (event) => {
      if (!langSwitcherRoot.contains(event.target)) {
        closePopover();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closePopover();
      }
    });
  }

  function renderInline(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
    );
  }

  function renderParagraph(text) {
    return text
      .split("\n")
      .map((line) => renderInline(line))
      .join("<br />");
  }

  function parseMarkdown(markdown) {
    const lines = markdown.replace(/\r/g, "").split("\n");
    const tokens = [];
    let listType = null;
    let listItems = [];
    let paragraph = [];

    function flushList() {
      if (listItems.length) {
        tokens.push({ type: listType === "ordered" ? "ordered-list" : "list", items: listItems });
        listItems = [];
        listType = null;
      }
    }

    function flushParagraph() {
      if (paragraph.length) {
        tokens.push({ type: "paragraph", text: paragraph.join("\n") });
        paragraph = [];
      }
    }

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        flushList();
        flushParagraph();
        return;
      }

      const orderedListMatch = trimmed.match(/^\d+\.\s+(.*)$/);

      if (trimmed.startsWith("- ")) {
        if (listType !== "unordered") {
          flushList();
        }

        flushParagraph();
        listType = "unordered";
        listItems.push(trimmed.slice(2));
        return;
      }

      if (orderedListMatch) {
        if (listType !== "ordered") {
          flushList();
        }

        flushParagraph();
        listType = "ordered";
        listItems.push(orderedListMatch[1]);
        return;
      }

      if (trimmed.startsWith("### ")) {
        flushList();
        flushParagraph();
        tokens.push({ type: "h3", text: trimmed.slice(4) });
        return;
      }

      if (trimmed.startsWith("## ")) {
        flushList();
        flushParagraph();
        tokens.push({ type: "h2", text: trimmed.slice(3) });
        return;
      }

      if (trimmed.startsWith("# ")) {
        flushList();
        flushParagraph();
        tokens.push({ type: "h1", text: trimmed.slice(2) });
        return;
      }

      paragraph.push(trimmed);
    });

    flushList();
    flushParagraph();
    return tokens;
  }

  function tokenToHtml(token) {
    if (token.type === "h2") {
      return `<h2>${renderInline(token.text)}</h2>`;
    }

    if (token.type === "h3") {
      return `<h3>${renderInline(token.text)}</h3>`;
    }

    if (token.type === "paragraph") {
      return `<p>${renderParagraph(token.text)}</p>`;
    }

    if (token.type === "list") {
      return `<ul>${token.items
        .map((item) => `<li>${renderInline(item)}</li>`)
        .join("")}</ul>`;
    }

    if (token.type === "ordered-list") {
      return `<ol>${token.items
        .map((item) => `<li>${renderInline(item)}</li>`)
        .join("")}</ol>`;
    }

    return "";
  }

  function slugifyHeading(value) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function buildSections(tokens) {
    const sections = [];
    let currentSection = null;

    tokens.forEach((token) => {
      if (token.type === "h2") {
        if (currentSection) {
          sections.push(currentSection);
        }

        currentSection = {
          heading: token.text,
          html: [tokenToHtml(token)],
        };
        return;
      }

      if (!currentSection) {
        return;
      }

      currentSection.html.push(tokenToHtml(token));
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  function extractHeroParts(tokens) {
    const heroIndex = tokens.findIndex((token) => token.type === "h1");
    const leadTokens = heroIndex > 0 ? tokens.slice(0, heroIndex) : [];
    const leadParagraphs = leadTokens.filter((token) => token.type === "paragraph");
    const heroTokens = heroIndex >= 0 ? tokens.slice(heroIndex) : tokens;
    const heroTitle = heroTokens.find((token) => token.type === "h1");
    const heroDescription = heroTokens.find((token) => token.type === "paragraph");
    const sectionTokens = heroIndex >= 0 ? tokens.slice(heroIndex + 1) : tokens;

    return {
      brandLabel: leadParagraphs[0]?.text || "",
      eyebrowLabel: leadParagraphs[1]?.text || "",
      heroDescription,
      heroTitle,
      sectionTokens,
    };
  }

  function applyContent(markdown) {
    currentMarkdown = markdown;
    const tokens = parseMarkdown(markdown);
    const { brandLabel, eyebrowLabel, heroDescription, heroTitle, sectionTokens } =
      extractHeroParts(tokens);
    const sections = buildSections(sectionTokens);
    const textLength = markdown.replace(/\s+/g, " ").trim().length;
    const isDesktop = window.matchMedia("(min-width: 980px)").matches;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    const isMediumDesktop = isDesktop && textLength <= 1250 && sections.length <= 6;
    const isShortMobile = isMobile && textLength <= 680 && sections.length <= 6;

    body.classList.toggle("layout-compact", isMediumDesktop || isShortMobile);
    body.classList.toggle("layout-mobile-fit", isShortMobile);

    if (pageTitle && heroTitle) {
      pageTitle.textContent = `${heroTitle.text} | Landing Page`;
    }

    if (brandRoot) {
      brandRoot.href = `./index.html?lang=${lang}`;
      brandRoot.innerHTML = brandLabel ? renderInline(brandLabel) : "";
    }

    if (eyebrowRoot) {
      eyebrowRoot.innerHTML = eyebrowLabel ? renderInline(eyebrowLabel) : "";
    }

    heroRoot.innerHTML = `
      <h1>${heroTitle ? renderInline(heroTitle.text) : ""}</h1>
      <p>${heroDescription ? renderInline(heroDescription.text) : ""}</p>
    `;

    contentRoot.innerHTML = sections
      .map((section) => {
        const isCta = section.heading.toLowerCase() === "cta";
        let html = section.html.join("");
        const sectionClass = `section section-${slugifyHeading(section.heading)}`;

        if (isCta) {
          html = html.replace(/<a /, '<a class="cta-link" ');
        }

        return `<section class="${sectionClass}">${html}</section>`;
      })
      .join("");
  }

  async function init() {
    const manifest = await loadLanguageManifest();
    const requestedLang = (url.searchParams.get("lang") || manifest.defaultLang).toLowerCase();

    lang = manifest.languages.includes(requestedLang) ? requestedLang : manifest.defaultLang;
    updateUrl(lang);
    body.dataset.lang = lang;
    document.documentElement.lang = lang;
    renderLanguageSwitcher(manifest.languages, lang);

    try {
      const response = await fetch(`./content/content.${lang}.md`);

      if (!response.ok) {
        throw new Error(`Failed to load ./content/content.${lang}.md`);
      }

      applyContent(await response.text());
    } catch (error) {
      heroRoot.innerHTML = "<h1>Content unavailable</h1><p>Please check the Markdown source.</p>";
      contentRoot.innerHTML = `<section class="section"><p>${escapeHtml(
        error.message
      )}</p></section>`;
    }
  }

  init();
  window.addEventListener("resize", () => {
    if (currentMarkdown) {
      applyContent(currentMarkdown);
    }
  });
})();
