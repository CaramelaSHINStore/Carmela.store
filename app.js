const WHATSAPP_NUMBER = "201055436305";

function buildWhatsAppDeepLink(url) {
    try {
        const parsed = new URL(url);
        const pathPhone = parsed.pathname.replace(/^\/+/, "").trim();
        const queryPhone = (parsed.searchParams.get("phone") || "").trim();
        const phone = (pathPhone || queryPhone || WHATSAPP_NUMBER || "").replace(/\D/g, "");
        const text = parsed.searchParams.get("text") || "";

        const apiParams = new URLSearchParams();
        if (phone) apiParams.set("phone", phone);
        if (text) apiParams.set("text", text);
        const apiUrl = `https://api.whatsapp.com/send?${apiParams.toString()}`;

        const schemeParams = new URLSearchParams();
        if (phone) schemeParams.set("phone", phone);
        if (text) schemeParams.set("text", text);
        const schemeUrl = `whatsapp://send?${schemeParams.toString()}`;

        const intentQuery = schemeParams.toString() ? `?${schemeParams.toString()}` : "";
        const intentUrl = `intent://send${intentQuery}#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=${encodeURIComponent(apiUrl)};end`;

        return { phone, text, apiUrl, schemeUrl, intentUrl };
    } catch (e) {
        return {
            phone: WHATSAPP_NUMBER,
            text: "",
            apiUrl: url,
            schemeUrl: url,
            intentUrl: url
        };
    }
}

function launchWhatsAppTarget(url) {
    const { schemeUrl, apiUrl } = buildWhatsAppDeepLink(url);
    const isAndroid = /Android/i.test(navigator.userAgent || "");

    if (isAndroid) {
        try {
            window.location.href = schemeUrl;
            setTimeout(() => {
                if (document.visibilityState === "visible") {
                    window.open(apiUrl, "_blank", "noopener,noreferrer");
                }
            }, 900);
            return;
        } catch (e) {}
    }

    const waWin = window.open(apiUrl, "_blank", "noopener,noreferrer");
    if (!waWin) {
        window.location.href = apiUrl;
    }
}

const STORE_URL = "https://caramelstoresuez.github.io/Carmelastore/";
const CART_STORAGE_KEY = "caramel_store_cart_v1";
const INTEREST_STORAGE_KEY = "caramel_smart_interest_v1";
const THEME_STORAGE_KEY = "caramel_store_theme_mode_v1";
const BATCH_SIZE = 12;
const CONTINUATION_STEP = 8;

const GITHUB_MERCHANTS_CONFIG = {
    owner: "Caramelstoresuez",
    repo: "Carmelastore",
    branch: "main",
    folder: "merchants"
};

const KNOWN_MERCHANT_SLUGS = {
    "mohamed-ghareeb": "محمد غريب",
    "shireen-ghareeb": "شيرين غريب",
    "umm-ammar": "أم عمار",
    "umm-waleed": "أم وليد",
    "products": "متجر كارامل",
    "catalog": "متجر كارامل",
    "store": "متجر كارامل"
};

const FALLBACK_MERCHANT_FILES = [
    "merchants/mohamed-ghareeb.json",
    "merchants/shireen-ghareeb.json",
    "merchants/umm-ammar.json",
    "merchants/umm-waleed.json",
    "products.json",
    "data/products.json"
];

const DEFAULT_APPAREL_SIZES = ["S", "M", "L", "XL", "XXL"];
const PRODUCT_VARIANTS = {};

let deferredInstallPrompt = null;
let toastTimer = null;
let currentFeedMode = "for-you";
let isLoadingJsonProducts = true;
let pendingOptionSelection = {
    productId: null,
    clickedBtnId: null,
    selectedSize: "",
    selectedColor: "",
    selectedImg: "",
    currentPrice: 0,
    qty: 1
};

let trendSlideList = [];
let dealSlideList = [];
let trendSlideIdx = 0;
let dealSlideIdx = 0;
let pausedMotionKind = { trends: false, deals: false };
let autoHoverSlideTimer = null;
let activeHoveredCard = null;
let previewModalState = { productId: null, imgs: [], idx: 0 };

function syncHeaderStickyOffsets() {
    const header = document.querySelector(".top-app-bar");
    if (!header) return;
    const h = Math.round(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--header-offset", `${h}px`);
    document.querySelectorAll(".section-heading").forEach(el => {
        el.style.scrollMarginTop = `${h + 62}px`;
    });
}

function syncThemeIcon() {
    const isDark = document.body.classList.contains("dark-theme");
    const iconSvg = document.getElementById("themeIconSvg");
    if (!iconSvg) return;
    if (isDark) {
        iconSvg.innerHTML = `<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l1.41 1.41M19.07 4.93l1.41 1.41"></path>`;
    } else {
        iconSvg.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
    }
}

function initThemeMode() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "dark") {
            document.body.classList.add("dark-theme");
        }
    } catch (e) {}
    syncThemeIcon();
}

function toggleThemeMode() {
    const isDark = document.body.classList.toggle("dark-theme");
    try { localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light"); } catch (e) {}
    syncThemeIcon();
    renderSideCategoriesList();
    showCaramelToast(isDark ? "تم تفعيل المظهر الليلي" : "تم تفعيل المظهر النهاري");
}

function toggleHeaderSearchBar(forceOpen = null) {
    const wrap = document.getElementById("collapsibleSearchWrap");
    const toggleBtn = document.getElementById("headerSearchToggleBtn");
    const input = document.getElementById("homeSearchInput");
    if (!wrap) return;
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !wrap.classList.contains("open");
    wrap.classList.toggle("open", shouldOpen);
    if (toggleBtn) toggleBtn.classList.toggle("active", shouldOpen);
    renderSmartSearchSuggestions();
    setTimeout(syncHeaderStickyOffsets, 220);
    if (shouldOpen && input) {
        setTimeout(() => {
            input.focus();
            try { input.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
        }, 60);
    }
}

function openGlobalSearchBar() {
    closeAllOverlays();
    toggleHeaderSearchBar(true);
}

function openServiceInfoModal(type) {
    const titleEl = document.getElementById("serviceInfoModalTitle");
    const bodyEl = document.getElementById("serviceInfoModalBody");
    const modal = document.getElementById("serviceInfoModal");
    if (!titleEl || !bodyEl || !modal) return;

    if (type === "payment") {
        titleEl.textContent = "طرق الدفع في متجر كارامل";
        bodyEl.innerHTML = `
            <div class="service-info-list">
                <div class="service-info-item"><strong>السويس:</strong> الدفع عند الاستلام.</div>
                <div class="service-info-item"><strong>المحافظات الأخرى:</strong> الدفع إنستا باي أو فوري أو كاش.</div>
            </div>
        `;
    } else if (type === "delivery") {
        titleEl.textContent = "مواعيد التوصيل";
        bodyEl.innerHTML = `
            <div class="service-info-list">
                <div class="service-info-item"><strong>التوصيل:</strong> التوصيل خلال يوم عمل.</div>
            </div>
        `;
    } else if (type === "return") {
        titleEl.textContent = "سياسة الاسترجاع";
        bodyEl.innerHTML = `
            <div class="service-info-list">
                <div class="service-info-item"><strong>سياسة الاسترجاع:</strong> خلال أسبوع لو المنتج تالف / به عيوب / أو غير الوصف.</div>
            </div>
        `;
    }

    modal.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("serviceInfo");
}

function closeServiceInfoModal(fromPopState = false) {
    const modal = document.getElementById("serviceInfoModal");
    if (modal) modal.classList.remove("open");
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("serviceInfo");
}

window.addEventListener("scroll", () => {
    const fill = document.getElementById("scrollProgressFill");
    const btt = document.getElementById("backToTopFab");
    const y = window.scrollY;
    if (fill) {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? Math.min(100, Math.max(0, (y / docHeight) * 100)) : 0;
        fill.style.width = `${pct}%`;
    }
    if (btt) {
        btt.classList.toggle("visible", y > 420);
    }
}, { passive: true });

document.addEventListener("keydown", e => {
    if (e.key === "Escape" && overlayStack.length > 0) {
        closeAllOverlays();
    }
});

window.addEventListener("resize", syncHeaderStickyOffsets, { passive: true });

function escapeHtmlAttr(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function normalizeProductImageUrl(rawImg) {
    if (!rawImg || typeof rawImg !== "string") return "";
    let cleaned = rawImg.trim().replace(/\\/g, "/");
    if (!cleaned) return "";
    if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith("data:") || cleaned.startsWith("blob:")) {
        return cleaned;
    }
    cleaned = cleaned.replace(/^\.\//, "").replace(/^\/+/, "");
    try {
        cleaned = decodeURI(cleaned);
    } catch (e) {}
    return encodeURI(cleaned);
}

function extractImagesFromRawProduct(rawItem) {
    if (!rawItem || typeof rawItem !== "object") return [];
    const candidates = [];
    const fields = [
        rawItem.img, rawItem.image, rawItem.photo, rawItem.imgUrl, rawItem.imageUrl,
        rawItem.thumbnail, rawItem.thumb, rawItem.picture, rawItem.pic,
        rawItem.images, rawItem.photos, rawItem.imgs, rawItem.gallery
    ];

    fields.forEach(val => {
        if (!val) return;
        if (Array.isArray(val)) {
            val.forEach(v => {
                if (typeof v === "string") candidates.push(v);
                else if (v && typeof v === "object") {
                    const nested = v.url || v.src || v.img || v.image || v.link;
                    if (nested) candidates.push(nested);
                }
            });
        } else if (typeof val === "string") {
            if (val.includes(",") || val.includes("\n") || val.includes("|")) {
                val.split(/[\n,|]+/).forEach(part => candidates.push(part));
            } else {
                candidates.push(val);
            }
        } else if (typeof val === "object") {
            const nested = val.url || val.src || val.img || val.image;
            if (nested) candidates.push(nested);
        }
    });

    return Array.from(new Set(candidates.map(u => normalizeProductImageUrl(u)).filter(Boolean)));
}

function getProductImagesList(product) {
    if (!product) return [];
    const rawList = [];
    if (Array.isArray(product.images)) rawList.push(...product.images);
    if (product.img) rawList.unshift(product.img);

    const normalized = rawList
        .map(u => normalizeProductImageUrl(u))
        .filter(Boolean);

    return Array.from(new Set(normalized));
}

function getActiveCardImageSrc(cardEl, product) {
    const imgs = getProductImagesList(product);
    if (cardEl) {
        const imgEl = cardEl.querySelector(".product-img-box img");
        const idxAttr = imgEl?.getAttribute("data-img-idx");
        if (idxAttr !== null && imgs.length) {
            const idx = Number(idxAttr);
            if (!Number.isNaN(idx) && imgs[idx]) return imgs[idx];
        }
        const currentDomSrc = imgEl?.getAttribute("src") || "";
        if (currentDomSrc && imgEl?.getAttribute("data-broken") !== "1") {
            return normalizeProductImageUrl(currentDomSrc);
        }
    }
    return imgs[0] || "";
}

function buildProductWhatsAppUrl(product, activeImgSrc = "") {
    if (!product) return `https://wa.me/${WHATSAPP_NUMBER}`;
    const displayPrice = product.priceLabel || product.price;
    const merchantName = product.merchant || "متجر كارامل";
    const imgs = getProductImagesList(product);
    const chosenImg = normalizeProductImageUrl(activeImgSrc) || (imgs[0] || "");
    const imgIndex = chosenImg && imgs.length ? imgs.indexOf(chosenImg) : -1;
    const imgLabel = chosenImg
        ? ` — الصورة المختارة${imgIndex >= 0 && imgs.length > 1 ? ` (${imgIndex + 1}/${imgs.length})` : ""}: ${chosenImg}`
        : "";
    const waText = encodeURIComponent(`أريد طلب ${product.title} بسعر ${displayPrice} جنيه (التاجر: ${merchantName})${imgLabel} من متجر كارامل`);
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;
}

function setCardImageByIndex(card, product, targetIdx) {
    if (!card || !product) return;
    const imgs = getProductImagesList(product);
    if (!imgs.length) return;
    const safeIdx = ((targetIdx % imgs.length) + imgs.length) % imgs.length;

    const imgEl = card.querySelector(".product-img-box img");
    const counterEl = card.querySelector(".card-img-counter");
    const dots = card.querySelectorAll(".card-img-dot");
    const waLinkEl = card.querySelector(".direct-wa-link");

    if (imgEl) {
        imgEl.setAttribute("data-img-idx", String(safeIdx));
        imgEl.setAttribute("data-retry-step", "0");
        imgEl.style.opacity = "1";
        imgEl.removeAttribute("data-broken");
        imgEl.src = imgs[safeIdx];
    }
    if (counterEl && imgs.length > 1) {
        counterEl.textContent = `${safeIdx + 1}/${imgs.length}`;
    }
    if (dots && dots.length) {
        dots.forEach((d, idx) => d.classList.toggle("active", idx === safeIdx));
    }
    if (waLinkEl) {
        waLinkEl.href = buildProductWhatsAppUrl(product, imgs[safeIdx]);
    }
}

function cycleCardImage(btnEl, productId, delta, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const card = btnEl ? btnEl.closest(".product-card") : null;
    const id = productId || card?.dataset?.productId;
    const product = PRODUCTS.find(p => p.id === id);
    if (!card || !product) return;

    const imgs = getProductImagesList(product);
    if (imgs.length <= 1) return;

    const imgEl = card.querySelector(".product-img-box img");
    const currentIdx = Number(imgEl?.getAttribute("data-img-idx") || "0");
    setCardImageByIndex(card, product, currentIdx + delta);
}

function jumpCardImage(dotEl, productId, targetIdx, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const card = dotEl ? dotEl.closest(".product-card") : null;
    const id = productId || card?.dataset?.productId;
    const product = PRODUCTS.find(p => p.id === id);
    if (!card || !product) return;
    setCardImageByIndex(card, product, Number(targetIdx) || 0);
}

function startCardAutoSlide(cardEl, productId) {
    const id = productId || cardEl?.dataset?.productId;
    const product = PRODUCTS.find(p => p.id === id);
    if (!product || !cardEl) return;
    const imgs = getProductImagesList(product);
    if (imgs.length <= 1) return;

    stopCardAutoSlide();
    activeHoveredCard = cardEl;

    autoHoverSlideTimer = setInterval(() => {
        if (!activeHoveredCard || !document.body.contains(activeHoveredCard)) {
            stopCardAutoSlide();
            return;
        }
        const imgEl = activeHoveredCard.querySelector(".product-img-box img");
        const currentIdx = Number(imgEl?.getAttribute("data-img-idx") || "0");
        setCardImageByIndex(activeHoveredCard, product, currentIdx + 1);
    }, 1300);
}

function stopCardAutoSlide() {
    if (autoHoverSlideTimer) {
        clearInterval(autoHoverSlideTimer);
        autoHoverSlideTimer = null;
    }
    activeHoveredCard = null;
}

function isBagOrNonApparelProduct(product) {
    if (!product) return false;
    const text = normalizeText(`${product.title || ""} ${product.desc || ""} ${product.category || ""}`);
    return /(شنطه|شنط|حقيبه|حقائب|باك|كروس|توت|محفظه|مقلمه|بوكس|مج|كوب|كوبايات|كاس|كاسات|عطر|برفان|سبلاش|اسبلش|مخمرية|ساعه|اكسسوار|انسيال|سلسله|خاتم|مكرميه|مفارش|مفرش|سجاده|منشر|شماعه|صينيه|صواني)/.test(text);
}

function isApparelProduct(product) {
    if (!product) return false;
    if (Array.isArray(product.sizes) && product.sizes.length) return true;
    if (isBagOrNonApparelProduct(product)) return false;
    const apparelCats = ["women", "men", "kids"];
    if (apparelCats.includes(product.category)) return true;
    if (Array.isArray(product.categories) && product.categories.some(c => apparelCats.includes(c))) return true;
    return false;
}

function extractJsonPriceOptions(product) {
    if (!product || typeof product !== "object") return [];
    const fallbackPrice = Number(product.price) || 0;
    const collected = [];

    const pushChoice = (lbl, prc) => {
        const label = String(lbl || "").trim();
        if (!label) return;
        const parsedP = parseNumericPrice(prc);
        const finalPrice = parsedP > 0 ? parsedP : fallbackPrice;
        const formattedLabel = /جنيه|\bج\b|EGP/i.test(label)
            ? label
            : (finalPrice > 0 ? `${label} (${finalPrice} جنيه)` : label);
        collected.push({ label: formattedLabel, price: finalPrice });
    };

    if (Array.isArray(product.priceOptions)) {
        product.priceOptions.forEach(item => {
            if (typeof item === "string") pushChoice(item, item);
            else if (item && typeof item === "object") {
                pushChoice(item.label || item.name || item.title || item.value, item.price ?? item.cost ?? item.amount);
            }
        });
    }

    if (!collected.length && Array.isArray(product.variants)) {
        product.variants.forEach(item => {
            if (typeof item === "string") pushChoice(item, item);
            else if (item && typeof item === "object") {
                pushChoice(item.label || item.name || item.title || item.value, item.price ?? item.cost ?? item.amount);
            }
        });
    }

    if (!collected.length && Array.isArray(product.options)) {
        product.options.forEach(opt => {
            if (!opt || typeof opt !== "object") return;
            const priceMap = (opt.prices && typeof opt.prices === "object") ? opt.prices : null;
            if (Array.isArray(opt.values)) {
                opt.values.forEach(v => {
                    if (typeof v === "string") {
                        const mappedPrice = priceMap && v in priceMap ? priceMap[v] : v;
                        pushChoice(v, mappedPrice);
                    } else if (v && typeof v === "object") {
                        pushChoice(v.label || v.name || v.value, v.price ?? v.cost ?? v.amount);
                    }
                });
            } else if (priceMap) {
                Object.entries(priceMap).forEach(([k, val]) => pushChoice(k, val));
            }
        });
    }

    return collected;
}

function normalizeSizeOrOptionEntry(entry, fallbackPrice = 0) {
    if (!entry) return null;
    if (typeof entry === "string") {
        const label = entry.trim();
        if (!label) return null;
        const priceMatch = label.match(/(\d+(?:\.\d+)?)\s*(?:جنيه|\bج\b|egp)/i);
        const parsed = priceMatch ? parseNumericPrice(priceMatch[1]) : 0;
        return { label, price: parsed > 0 ? parsed : (Number(fallbackPrice) || 0) };
    }
    if (typeof entry === "object") {
        const label = String(entry.label || entry.name || entry.title || entry.value || entry.size || "").trim();
        if (!label) return null;
        const rawP = entry.price ?? entry.cost ?? entry.amount ?? entry.salePrice;
        const parsed = rawP !== undefined && rawP !== null && String(rawP).trim() !== "" ? parseNumericPrice(rawP) : 0;
        const finalPrice = parsed > 0 ? parsed : (Number(fallbackPrice) || 0);
        const formattedLabel = (parsed > 0 && !/جنيه|\bج\b|egp/i.test(label))
            ? `${label} (${finalPrice} جنيه)`
            : label;
        return { label: formattedLabel, price: finalPrice };
    }
    return null;
}

function getProductVariantConfig(product) {
    if (!product) return null;
    const explicit = PRODUCT_VARIANTS[product.id] || {};
    const config = {};
    const fallbackPrice = Number(product.price) || 0;

    if (Array.isArray(product.colors) && product.colors.length) {
        config.colors = product.colors.map(c => typeof c === "string" ? c.trim() : String(c?.label || c?.name || "").trim()).filter(Boolean);
    } else if (Array.isArray(explicit.colors) && explicit.colors.length) {
        config.colors = explicit.colors;
    }

    const jsonPriceOpts = extractJsonPriceOptions(product);
    if (jsonPriceOpts.length) {
        config.sizes = jsonPriceOpts;
    } else if (Array.isArray(product.sizes) && product.sizes.length) {
        const normalizedSizes = product.sizes.map(s => normalizeSizeOrOptionEntry(s, fallbackPrice)).filter(Boolean);
        if (normalizedSizes.length) config.sizes = normalizedSizes;
    } else if (Array.isArray(explicit.sizes) && explicit.sizes.length) {
        config.sizes = explicit.sizes;
    } else if (isApparelProduct(product)) {
        config.sizes = DEFAULT_APPAREL_SIZES;
    }

    return ((config.colors && config.colors.length) || (config.sizes && config.sizes.length)) ? config : null;
}

function showCaramelToast(message) {
    const toastEl = document.getElementById("caramelToast");
    if (!toastEl || !message) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.classList.remove("show"); }, 3200);
}

function setInstallButtonsVisible(show) {
    const headerBtn = document.getElementById("headerInstallBtn");
    if (headerBtn) headerBtn.classList.toggle("visible", Boolean(show));
}

window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    setInstallButtonsVisible(true);
});

async function triggerInstallApp() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch (e) {}
    deferredInstallPrompt = null;
    setInstallButtonsVisible(false);
}

window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    setInstallButtonsVisible(false);
    showCaramelToast("تم تثبيت تطبيق متجر كارامل بنجاح!");
});

async function shareStoreApp() {
    const shareTitle = "متجر كارامل - Caramel Store";
    const shareText = "حمّل متجر كارامل على موبايلك واطلب كل اللي تحتاجه بأرخص الأسعار:\n" + STORE_URL;
    if (navigator.share) {
        try {
            await navigator.share({ title: shareTitle, text: shareText, url: STORE_URL });
            return;
        } catch (err) {
            if (err && err.name === "AbortError") return;
        }
    }
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(STORE_URL);
        }
        showCaramelToast("تم نسخ رابط متجر كارامل بنجاح!");
    } catch (e) {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
    }
}

(function initAutoPageSwitchRefresh() {
    const RELOAD_GUARD_KEY = "caramel_auto_reload_ts_v1";
    const INITIAL_HTML_LEN = document.documentElement.outerHTML.length;
    let swRegistration = null;
    let lastAwayTime = 0;

    function canSafelyReloadNow() {
        try {
            const lastTs = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || "0");
            if (Date.now() - lastTs < 6000) return false;
            sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
        } catch (e) {}
        return true;
    }

    function triggerCleanPageReload() {
        if (!canSafelyReloadNow()) return;
        window.location.reload();
    }

    function activateWaitingWorker(reg) {
        if (reg && reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    async function checkRemoteUpdatesIfChanged() {
        if (swRegistration) {
            swRegistration.update().catch(() => {});
            activateWaitingWorker(swRegistration);
        }
        try {
            const resp = await fetch(`./index.html?ts=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
            if (resp && resp.ok) {
                const freshHtml = await resp.text();
                if (Math.abs(freshHtml.length - INITIAL_HTML_LEN) > 120) triggerCleanPageReload();
            }
        } catch (e) {}
    }

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", async () => {
            try {
                const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" });
                swRegistration = reg;
                activateWaitingWorker(reg);
                reg.update().catch(() => {});
                setInterval(() => { reg.update().catch(() => {}); activateWaitingWorker(reg); }, 120000);
                reg.addEventListener("updatefound", () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener("statechange", () => {
                        if (newWorker.state === "installed") activateWaitingWorker(reg);
                    });
                });
                navigator.serviceWorker.addEventListener("controllerchange", () => triggerCleanPageReload());
            } catch (e) {}
        });
    }

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") lastAwayTime = Date.now();
        else if (document.visibilityState === "visible") {
            const awayMs = lastAwayTime ? (Date.now() - lastAwayTime) : 0;
            if (awayMs >= 15000) checkRemoteUpdatesIfChanged();
        }
    });

    window.addEventListener("pageshow", event => {
        if (event.persisted) triggerCleanPageReload();
    });
})();

const CATEGORY_NAMES = {
    all: "الكل",
    home: "المنزل",
    appliances: "الأدوات الكهربائية",
    phones: "الهواتف والإكسسوارات",
    jewelry: "مجوهرات وإكسسوارات",
    perfume: "الجمال والصحة",
    school: "اللوازم المكتبية والمدرسة",
    gifts: "الهدايا",
    tafse: "هاند ميد",
    women: "النساء",
    men: "الرجال",
    kids: "الأطفال"
};

const CATEGORY_SUBTITLES = {
    all: "تشكيلة المتجر بالكامل من كل التجار",
    home: "تنظيم، مطبخ، ومفروشات",
    appliances: "أجهزة وأدوات كهربائية منزلية",
    phones: "هواتف، شواحن، وسماعات",
    jewelry: "إكسسوارات، سلاسل، وخواتم",
    perfume: "عطور، عناية شخصية، وصحة",
    school: "كشاكيل، أقلام، وأدوات دراسة",
    gifts: "هدايا مخصصة وذكريات",
    tafse: "شغل يدوي ومكرميات",
    women: "أزياء وعناية نسائية",
    men: "اختيارات عملية للرجال",
    kids: "مستلزمات وتفاصيل للأطفال"
};

const CATEGORY_THEME_META = {
    all:        { bar: "#e5be96", bg: "rgba(200, 150, 102, 0.18)", stroke: "#c89666" },
    home:       { bar: "#d4a373", bg: "#faefe3", stroke: "#996738" },
    appliances: { bar: "#38bdf8", bg: "#e0f2fe", stroke: "#0284c7" },
    phones:     { bar: "#818cf8", bg: "#e0e7ff", stroke: "#4338ca" },
    jewelry:    { bar: "#fb7185", bg: "#ffe4e6", stroke: "#be123c" },
    perfume:    { bar: "#60a5fa", bg: "#dbeafe", stroke: "#1d4ed8" },
    school:     { bar: "#0ea5e9", bg: "#e0f2fe", stroke: "#0369a1" },
    gifts:      { bar: "#f472b6", bg: "#fce7f3", stroke: "#be185d" },
    tafse:      { bar: "#84a98c", bg: "#e8f0ea", stroke: "#354f52" },
    women:      { bar: "#fbbf24", bg: "#fef3c7", stroke: "#b45309" },
    men:        { bar: "#94a3b8", bg: "#e2e8f0", stroke: "#1e293b" },
    kids:       { bar: "#22d3ee", bg: "#cffafe", stroke: "#0e7490" }
};

function buildCategoryGraphicSvg(catKey, customStroke = "") {
    const s = customStroke || (CATEGORY_THEME_META[catKey]?.stroke || "#996738");
    switch (catKey) {
        case "appliances":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 4L8 18h8l-2 10 10-14h-8l2-10z"></path>
            </svg>`;
        case "phones":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="9.5" y="4.5" width="13" height="23" rx="2.8"></rect>
                <path d="M14 7.5h4"></path>
                <circle cx="16" cy="24" r="1" fill="${s}" stroke="none"></circle>
            </svg>`;
        case "jewelry":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 7l7 5 7-5"></path>
                <circle cx="16" cy="18.5" r="7"></circle>
                <path d="M16 14.5l2.2 2.2-2.2 2.2-2.2-2.2 2.2-2.2z"></path>
            </svg>`;
        case "school":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="6" y="5" width="16" height="22" rx="2.5"></rect>
                <path d="M10 11h8M10 15h6"></path>
                <path d="M22 8l4 4-8 8-4 1 1-4 7-9z"></path>
            </svg>`;
        case "home":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 14.5L16 5.5l11 9V26a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 5 26V14.5z"></path>
                <path d="M13 27.5v-8h6v8"></path>
            </svg>`;
        case "kids":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="16" cy="17" r="9.5"></circle>
                <circle cx="13" cy="15.5" r="1.2" fill="${s}" stroke="none"></circle>
                <circle cx="19" cy="15.5" r="1.2" fill="${s}" stroke="none"></circle>
                <path d="M12.5 19.5c1.1 1.5 2.2 2.2 3.5 2.2s2.4-.7 3.5-2.2"></path>
                <path d="M16 7.5c1.2-2 3-2 3.8-0.8"></path>
            </svg>`;
        case "tafse":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 7h16"></path>
                <path d="M11 7v10c0 3 2.2 4.5 5 4.5s5-1.5 5-4.5V7"></path>
                <path d="M12.5 21.5v5.5M16 21.5v6M19.5 21.5v5.5"></path>
            </svg>`;
        case "men":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M11 7l5 3 5-3 4 4.5-3.5 3.5V26h-11V15L7 11.5 11 7z"></path>
            </svg>`;
        case "women":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="16" cy="13" r="6.5"></circle>
                <path d="M16 19.5v8M12.5 24.5h7"></path>
            </svg>`;
        case "perfume":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="13" y="4.5" width="6" height="3.5" rx="1"></rect>
                <rect x="9.5" y="10.5" width="13" height="16.5" rx="4.5"></rect>
                <path d="M13 18.5h6"></path>
            </svg>`;
        case "gifts":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="6.5" y="14" width="19" height="12.5" rx="2"></rect>
                <rect x="5" y="10.5" width="22" height="4" rx="1.5"></rect>
                <path d="M16 10.5v16"></path>
                <path d="M16 10.5c-1.8-3.5-6.2-3.8-6.2-1 0 1.8 3.5 1.4 6.2 1zm0 0c1.8-3.5 6.2-3.8 6.2-1 0 1.8-3.5 1.4-6.2 1z"></path>
            </svg>`;
        default:
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="5.5" y="5.5" width="8.5" height="8.5" rx="2"></rect>
                <rect x="18" y="5.5" width="8.5" height="8.5" rx="2"></rect>
                <rect x="5.5" y="18" width="8.5" height="8.5" rx="2"></rect>
                <rect x="18" y="18" width="8.5" height="8.5" rx="2"></rect>
            </svg>`;
    }
}

function applyCategoryPageMood(category) {
    const validModes = ["all", "home", "appliances", "phones", "jewelry", "school", "tafse", "kids", "women", "men", "gifts", "perfume"];
    const mode = validModes.includes(category) ? category : "all";
    document.body.className = document.body.className
        .split(/\s+/)
        .filter(cls => cls && !cls.startsWith("cat-mode-"))
        .concat(`cat-mode-${mode}`)
        .join(" ");
}

const SHIREEN_PRODUCT_IDS = new Set([
    "hm-1", "hm-32", "hm-33", "hm-35", "hm-36", "hm-37", "hm-39",
    "hm-40", "hm-41", "hm-42", "hm-43", "hm-44", "hm-45", "hm-46", "hm-47",
    "hm-48", "hm-49", "hm-50", "hm-51", "hm-52", "hm-53", "hm-54", "hm-55",
    "hm-56", "hm-57", "hm-58", "hm-59", "hm-60", "hm-61",
    "hm-62", "hm-63", "hm-64", "hm-65", "hm-66", "hm-67",
    "tafse-1", "tafse-2", "tafse-3", "tafse-4", "tafse-5", "tafse-23",
    "wmn-1", "wmn-2", "wmn-3",
    "htm-5", "htm-6", "htm-7", "htm-8", "htm-9", "htm-10", "htm-11", "htm-12",
    "htm-13", "htm-14", "htm-15", "libr-29",
    "brf-1", "brf-2", "brf-3", "brf-4", "brf-5", "brf-6", "brf-7", "brf-8",
    "brf-9", "brf-10", "brf-11", "brf-12", "brf-13", "brf-14", "brf-16"
]);

const UMM_WALEED_PRODUCT_IDS = new Set([
    "amn-1", "amn-2", "amn-3", "amn-4", "amn-5", "amn-6", "amn-7", "amn-8", "amn-9", "amn-10",
    "hm-2", "hm-3", "hm-4", "hm-5", "hm-6", "hm-7", "hm-8", "hm-19",
    "hm-9", "hm-10", "hm-11", "hm-12", "hm-34", "hm-38",
    "hm-14", "hm-15", "hm-16", "hm-17",
    "hm-22", "hm-23", "hm-26", "hm-28", "hm-29", "hm-30", "hm-31"
]);

const UMM_AMMAR_PRODUCT_IDS = new Set([
    "tafse-6", "tafse-7", "tafse-8", "tafse-9", "tafse-10", "tafse-11", "tafse-12",
    "tafse-13", "tafse-14", "tafse-15", "tafse-16", "tafse-17", "tafse-18", "tafse-19",
    "tafse-20", "tafse-21", "tafse-22",
    "om-ammar-1", "om-ammar-2", "om-ammar-3", "om-ammar-pearl-bag-350"
]);

function resolveMerchantNameFromFile(fileNameOrUrl) {
    const cleanBase = String(fileNameOrUrl || "")
        .split("/").pop()
        .replace(/\.json$/i, "")
        .toLowerCase()
        .trim();
    if (KNOWN_MERCHANT_SLUGS[cleanBase]) return KNOWN_MERCHANT_SLUGS[cleanBase];
    if (!cleanBase) return "";
    return cleanBase
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, ch => ch.toUpperCase());
}

function inferCategorySmartly(rawCat, title = "", desc = "") {
    const validKeys = Object.keys(CATEGORY_NAMES).filter(k => k !== "all");
    const normCat = normalizeText(rawCat || "");
    if (validKeys.includes(normCat)) return normCat;

    const catAliases = {
        "المنزل": "home", "منزل": "home", "مطبخ": "home", "ادوات منزليه": "home", "ديكور": "home",
        "الادوات الكهربائيه": "appliances", "ادوات كهربائيه": "appliances", "كهربائيات": "appliances", "اجهزه كهربائيه": "appliances", "كهرباء": "appliances",
        "الهواتف والاكسسوارات": "phones", "هواتف": "phones", "موبايل": "phones", "موبايلات": "phones", "اكسسوارات موبايل": "phones", "شواحن": "phones", "سماعات": "phones",
        "مجوهرات واكسسوارات": "jewelry", "مجوهرات": "jewelry", "اكسسوارات": "jewelry", "حلي": "jewelry", "سلاسل": "jewelry", "خواتم": "jewelry", "اساور": "jewelry",
        "الجمال والصحه": "perfume", "الجمال": "perfume", "الصحه": "perfume", "صحه": "perfume", "تجميل": "perfume",
        "اللوازم المكتبيه والمدرسه": "school", "لوازم مكتبيه": "school", "مكتبيه": "school",
        "المدرسه": "school", "مدرسه": "school", "مكتبه": "school", "ادوات مدرسيه": "school", "قرطاسيه": "school",
        "هاند ميد": "tafse", "هاندميد": "tafse", "يدوي": "tafse", "مكرميه": "tafse", "تفصيل": "tafse",
        "الاطفال": "kids", "اطفال": "kids", "بيبي": "kids", "العاب": "kids",
        "النساء": "women", "نساء": "women", "حريمي": "women", "بناتي": "women", "ملابس حريمي": "women",
        "الرجال": "men", "رجال": "men", "رجالي": "men", "شبابي": "men",
        "العنايه والعطور": "perfume", "عطور": "perfume", "برفان": "perfume", "برفانات": "perfume", "عنايه": "perfume", "سبلاش": "perfume",
        "الهدايا": "gifts", "هدايا": "gifts", "هديه": "gifts", "طباعه": "gifts"
    };
    if (catAliases[normCat]) return catAliases[normCat];

    const combined = normalizeText(`${rawCat || ""} ${title} ${desc}`);
    if (/(موبايل|هاتف|تليفون|ايفون|سامسونج|ريلمي|شاومي|انفنكس|شاحن|باور بنك|كفر|سكرينه|سماعه بلوتوث|ايربودز|وصله|كابل)/.test(combined)) return "phones";
    if (/(خلاط|مكواه|مكواة|كاتل|غلايه|مضرب|هاند بلندر|ميكروويف|سشوار|مجفف شعر|مروحه|لمبه|ليد|فيشه|مشترك|كهربائيه|كهربائي)/.test(combined)) return "appliances";
    if (/(مجوهرات|ذهب|فضه|فضة|انسيال|سلسله|سلسلة|خاتم|حلق|اسوره|اسواره|خلخال|دبله|تعليقه|اكسسوارات حريمي|اكسسوار)/.test(combined)) return "jewelry";
    if (/(عطر|برفان|سبلاش|اسبلش|مخمريه|بادي|لوشن|كريم|شامبو|ماسك|تجميل|ميك اب|مكياج|روج|واقي شمس|سيروم|صحه|طبي|عنايه)/.test(combined)) return "perfume";
    if (/(كشكول|نوت بوك|قلم|اقلام|استيكه|برايه|مسطره|كراسه|دفتر|ملف|مكتب|سبوره|الوان|مدرس|مكتبي|قرطاسيه)/.test(combined)) return "school";
    if (/(هاند ميد|مكرميه|خرز|لولي|كروشيه|تطريز|عبايه|ملحفه)/.test(combined)) return "tafse";
    if (/(هديه|هدايا|بوكس|مرايا سحريه|طباعه|مج حراري)/.test(combined)) return "gifts";
    if (/(اطفال|طفل|بيبي|لعبه|العاب)/.test(combined)) return "kids";
    if (/(حريمي|نسائي|طرحه|بلوزه|دريس|فستان|بيجامه حريمي)/.test(combined)) return "women";
    if (/(رجالي|شبابي|محفظه رجالي|تيشيرت رجالي)/.test(combined)) return "men";
    return "home";
}

function inferAdditionalCategoriesSmartly(primaryCat, title = "", desc = "") {
    const combined = normalizeText(`${title} ${desc}`);
    const extras = new Set();
    if (primaryCat) extras.add(primaryCat);
    if (/(هديه|هدية|هدايا|بوكس|تغليف)/.test(combined)) extras.add("gifts");
    if (/(شاحن|سماعه|كفر|موبايل|هاتف)/.test(combined)) extras.add("phones");
    if (/(خلاط|مكواه|مكواة|كاتل|غلايه|مروحه|كهربائيه)/.test(combined)) extras.add("appliances");
    if (/(سلسله|خاتم|اسوره|حلق|مجوهرات|اكسسوار)/.test(combined)) extras.add("jewelry");
    if (/(عطر|برفان|سبلاش|كريم|تجميل|عنايه|صحه)/.test(combined)) extras.add("perfume");
    if (/(كشكول|قلم|دفتر|مكتب|مدرسه|مكتبيه)/.test(combined)) extras.add("school");
    return Array.from(extras);
}

function inferMerchantForProduct(product, fallbackMerchant = "") {
    if (!product) return fallbackMerchant || "متجر كارامل";
    const directMerchant = product.merchant || product.seller || product.vendor || product.store || product.owner;
    if (directMerchant && String(directMerchant).trim()) return String(directMerchant).trim();
    if (SHIREEN_PRODUCT_IDS.has(product.id)) return "شيرين غريب";
    if (UMM_AMMAR_PRODUCT_IDS.has(product.id)) return "أم عمار";
    if (UMM_WALEED_PRODUCT_IDS.has(product.id) || (product.id && product.id.startsWith("amn-"))) return "أم وليد";
    if (product.id && product.id.startsWith("libr-")) return "محمد غريب";
    if (product.id && product.id.startsWith("tafse-")) return "كارامل للهاند ميد";
    if (product.id && product.id.startsWith("wmn-")) return "أم عمار";
    if (fallbackMerchant) return fallbackMerchant;
    return "متجر كارامل";
}

function parseNumericPrice(rawPrice) {
    if (typeof rawPrice === "number" && !Number.isNaN(rawPrice)) return rawPrice;
    const cleaned = normalizeArabicDigits(String(rawPrice || "")).replace(/[^\d.]/g, "");
    const num = parseFloat(cleaned);
    return Number.isNaN(num) ? 0 : num;
}

function extractRawItemsFromJsonPayload(payload, fileMerchantName = "") {
    if (!payload) return { items: [], fileMerchant: fileMerchantName, fileStyle: "" };
    let detectedMerchant = fileMerchantName;
    let detectedStyle = "";

    if (Array.isArray(payload)) {
        return { items: payload, fileMerchant: detectedMerchant, fileStyle: detectedStyle };
    }

    if (typeof payload === "object") {
        if (payload.merchant || payload.merchantName || payload.seller || payload.name) {
            const topName = payload.merchant || payload.merchantName || payload.seller || (!payload.price && !payload.img ? payload.name : "");
            if (topName && typeof topName === "string") detectedMerchant = topName.trim();
        }
        if (payload.style || payload.theme || payload.cardStyle) {
            detectedStyle = String(payload.style || payload.theme || payload.cardStyle).trim();
        }

        const arrayKeys = ["products", "items", "data", "catalog", "list", "offers", "goods"];
        for (const key of arrayKeys) {
            if (Array.isArray(payload[key])) {
                return { items: payload[key], fileMerchant: detectedMerchant, fileStyle: detectedStyle };
            }
        }

        const collected = [];
        Object.entries(payload).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                val.forEach(entry => {
                    if (entry && typeof entry === "object") {
                        collected.push({ category: entry.category || key, ...entry });
                    }
                });
            } else if (val && typeof val === "object" && (val.title || val.name || val.price || val.img || val.image)) {
                collected.push({ id: val.id || key, ...val });
            }
        });
        if (collected.length) {
            return { items: collected, fileMerchant: detectedMerchant, fileStyle: detectedStyle };
        }
    }

    return { items: [], fileMerchant: detectedMerchant, fileStyle: detectedStyle };
}

function collectExtraSearchableTextFromRaw(rawItem) {
    const skipKeys = new Set(["id", "code", "sku", "img", "image", "photo", "imgUrl", "imageUrl", "thumbnail", "thumb", "picture", "pic", "images", "photos", "imgs", "gallery", "url", "link", "download_url"]);
    const parts = [];
    const walk = (v, depth = 0) => {
        if (depth > 3 || v === null || v === undefined) return;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            const s = String(v).trim();
            if (s && !/^https?:\/\//i.test(s)) parts.push(s);
        } else if (Array.isArray(v)) {
            v.forEach(item => walk(item, depth + 1));
        } else if (typeof v === "object") {
            Object.entries(v).forEach(([k, val]) => {
                if (!skipKeys.has(k)) {
                    parts.push(k);
                    walk(val, depth + 1);
                }
            });
        }
    };
    walk(rawItem, 0);
    return parts.join(" ");
}

function normalizeRawJsonProduct(rawItem, index, slugPrefix, fileMerchant, fileStyle) {
    if (!rawItem || typeof rawItem !== "object") return null;
    const itemTitle = String(rawItem.title || rawItem.name || rawItem.product_name || rawItem.productName || "").trim();
    if (!itemTitle) return null;

    const itemId = String(rawItem.id || rawItem.code || rawItem.sku || `${slugPrefix}-${index + 1}`).trim();
    const itemDesc = String(rawItem.desc || rawItem.description || rawItem.details || rawItem.notes || "").trim();
    const extractedImgs = extractImagesFromRawProduct(rawItem);
    const rawPriceVal = rawItem.price ?? rawItem.cost ?? rawItem.amount ?? rawItem.salePrice ?? 0;
    const numericPrice = parseNumericPrice(rawPriceVal);
    const priceLabel = rawItem.priceLabel || (typeof rawPriceVal === "string" && /[a-zA-Z\u0600-\u06FF]/.test(rawPriceVal) ? rawPriceVal.trim() : "");
    const rawCategory = rawItem.category || rawItem.section || rawItem.department || rawItem.type || "";
    const resolvedCategory = inferCategorySmartly(rawCategory, itemTitle, itemDesc);
    const extraSearchText = collectExtraSearchableTextFromRaw(rawItem);

    const normalized = {
        ...rawItem,
        id: itemId,
        title: itemTitle,
        desc: itemDesc,
        img: extractedImgs[0] || "",
        images: extractedImgs,
        price: numericPrice,
        priceLabel: priceLabel || undefined,
        subPrice: rawItem.subPrice || rawItem.oldPrice || rawItem.unit || "",
        category: resolvedCategory,
        badge: String(rawItem.badge || rawItem.tag || rawItem.label || "").trim(),
        cardStyle: String(rawItem.style || rawItem.cardStyle || fileStyle || "").trim().toLowerCase(),
        _extraSearchText: extraSearchText
    };

    normalized.merchant = inferMerchantForProduct(normalized, fileMerchant);
    const existingExtraCats = Array.isArray(rawItem.categories) ? rawItem.categories.map(c => inferCategorySmartly(c, itemTitle, itemDesc)) : [];
    normalized.categories = Array.from(new Set([...existingExtraCats, ...inferAdditionalCategoriesSmartly(resolvedCategory, itemTitle, itemDesc)]));
    return normalized;
}

const PRODUCTS = [];

async function discoverMerchantJsonSources() {
    const sourcesMap = new Map();

    const registerJsonPath = (relPath, customDownloadUrl = "") => {
        const normalizedPath = String(relPath || "").replace(/^\.?\/+/, "").trim();
        if (!normalizedPath || !/\.json$/i.test(normalizedPath)) return;
        const key = normalizedPath.toLowerCase();
        if (!sourcesMap.has(key)) {
            const fileName = normalizedPath.split("/").pop();
            const slug = fileName.replace(/\.json$/i, "");
            sourcesMap.set(key, {
                slug,
                localUrl: normalizedPath,
                rawUrl: customDownloadUrl || `https://raw.githubusercontent.com/${GITHUB_MERCHANTS_CONFIG.owner}/${GITHUB_MERCHANTS_CONFIG.repo}/${GITHUB_MERCHANTS_CONFIG.branch}/${normalizedPath}`,
                defaultMerchant: resolveMerchantNameFromFile(fileName)
            });
        }
    };

    try {
        const indexJsonResp = await fetch(`./merchants/index.json?ts=${Date.now()}`, { cache: "no-store" });
        if (indexJsonResp && indexJsonResp.ok) {
            const idxData = await indexJsonResp.json();
            const fileEntries = Array.isArray(idxData) ? idxData : (Array.isArray(idxData?.files) ? idxData.files : []);
            fileEntries.forEach(entry => {
                if (typeof entry === "string") {
                    registerJsonPath(entry.includes("/") ? entry : `${GITHUB_MERCHANTS_CONFIG.folder}/${entry}`);
                } else if (entry && typeof entry === "object") {
                    const p = entry.path || entry.file || entry.name || "";
                    if (p) registerJsonPath(p.includes("/") ? p : `${GITHUB_MERCHANTS_CONFIG.folder}/${p}`, entry.url || "");
                }
            });
        }
    } catch (e) {}

    try {
        const apiUrl = `https://api.github.com/repos/${GITHUB_MERCHANTS_CONFIG.owner}/${GITHUB_MERCHANTS_CONFIG.repo}/contents/${GITHUB_MERCHANTS_CONFIG.folder}?ref=${GITHUB_MERCHANTS_CONFIG.branch}&ts=${Date.now()}`;
        const apiResp = await fetch(apiUrl, { cache: "no-store" });
        if (apiResp && apiResp.ok) {
            const filesList = await apiResp.json();
            if (Array.isArray(filesList)) {
                filesList.forEach(f => {
                    if (f && f.type === "file" && /\.json$/i.test(f.name) && f.name.toLowerCase() !== "index.json") {
                        registerJsonPath(`${GITHUB_MERCHANTS_CONFIG.folder}/${f.name}`, f.download_url || "");
                    }
                });
            }
        }
    } catch (e) {}

    FALLBACK_MERCHANT_FILES.forEach(path => registerJsonPath(path));

    return Array.from(sourcesMap.values());
}

async function fetchJsonWithFallback(source) {
    const urlsToTry = [
        `${source.localUrl}?ts=${Date.now()}`,
        `${source.rawUrl}?ts=${Date.now()}`
    ];
    for (const url of urlsToTry) {
        try {
            const resp = await fetch(url, { cache: "no-store" });
            if (resp && resp.ok) {
                const text = await resp.text();
                const cleanText = text.replace(/^\uFEFF/, "").trim();
                if (cleanText) return JSON.parse(cleanText);
            }
        } catch (e) {}
    }
    return null;
}

async function loadMerchantProductsFromJson() {
    isLoadingJsonProducts = true;
    renderProducts(currentCategory);

    const merchantSources = await discoverMerchantJsonSources();
    const jsonProductsById = new Map();

    const fetchedPayloads = await Promise.all(
        merchantSources.map(async source => ({
            source,
            payload: await fetchJsonWithFallback(source)
        }))
    );

    fetchedPayloads.forEach(({ source, payload }) => {
        if (!payload) return;
        const { items, fileMerchant, fileStyle } = extractRawItemsFromJsonPayload(payload, source.defaultMerchant);
        const slugPrefix = source.slug.replace(/[^a-z0-9\u0600-\u06FF]/gi, "-");

        items.forEach((rawItem, idx) => {
            const normalized = normalizeRawJsonProduct(rawItem, idx, slugPrefix, fileMerchant, fileStyle);
            if (!normalized) return;
            const uniqueKey = `${slugPrefix}::${normalized.id}`;
            jsonProductsById.set(uniqueKey, normalized);
        });
    });

    const loadedList = Array.from(jsonProductsById.values());
    PRODUCTS.splice(0, PRODUCTS.length, ...loadedList);
    rebuildSearchIndex();
    isLoadingJsonProducts = false;

    renderSmartSearchSuggestions();
    renderSpotlightBoxes();
    renderProducts(currentCategory);
    hydrateTopQuickTabIcons();
    renderSideCategoriesList();
    updateCartUI();
}

let currentCategory = "all";
let currentMerchant = "";
let currentMaxPrice = 0;

function setPriceFilter(maxPrice) {
    currentMaxPrice = Number(maxPrice) || 0;
    renderProducts(currentCategory);
    scrollToProductsTop();
}

function renderSmartPriceChips(baseList) {
    const container = document.getElementById("smartPriceChipsContainer");
    if (!container) return;

    const prices = (baseList || [])
        .map(p => Number(p.price) || 0)
        .filter(val => val > 0);

    const tiers = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const availableTiers = tiers.filter(tier => prices.some(pr => pr <= tier));
    const hasAbove1000 = prices.some(pr => pr > 1000);

    if (currentMaxPrice > 0 && currentMaxPrice <= 1000 && !availableTiers.includes(currentMaxPrice)) {
        currentMaxPrice = 0;
    }

    let html = `<button type="button" class="price-chip-btn ${currentMaxPrice === 0 ? "active" : ""}" onclick="setPriceFilter(0)">الكل</button>`;
    availableTiers.forEach(tier => {
        html += `<button type="button" class="price-chip-btn ${currentMaxPrice === tier ? "active" : ""}" onclick="setPriceFilter(${tier})">حتى ${tier} ج</button>`;
    });
    if (hasAbove1000) {
        html += `<button type="button" class="price-chip-btn ${currentMaxPrice === 1001 ? "active" : ""}" onclick="setPriceFilter(1001)">أكثر من 1000 ج</button>`;
    }
    container.innerHTML = html;
}

function renderSmartSearchSuggestions() {
    const container = document.getElementById("smartSearchSuggestions");
    if (!container) return;

    const defaults = ["عطر", "هاند ميد", "مطبخ", "كشكول", "هدية"];
    const freqMap = new Map();
    const stopWords = new Set(["من", "في", "على", "مع", "او", "و", "ال", "قطعه", "منتج", "جنيه", "مقاس", "لون"]);

    PRODUCTS.forEach(p => {
        const words = normalizeText(`${p.title || ""} ${p.badge || ""}`).split(" ");
        words.forEach(w => {
            if (w.length >= 3 && !stopWords.has(w)) {
                freqMap.set(w, (freqMap.get(w) || 0) + 1);
            }
        });
    });

    const dynamicChips = Array.from(freqMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([w]) => w)
        .filter(w => !defaults.some(d => normalizeText(d) === w));

    const chips = [...defaults, ...dynamicChips.slice(0, 4)];
    container.innerHTML = chips.map(term =>
        `<button type="button" class="search-suggest-chip" onclick="applyQuickSearch('${escapeHtmlAttr(term)}')">${escapeHtmlAttr(term)}</button>`
    ).join("");
}

function applyQuickSearch(term) {
    const input = document.getElementById("homeSearchInput");
    if (!input) return;
    input.value = term;
    handleSearchInput();
    scrollToProductsTop();
}

function shareCurrentMerchantPage() {
    if (!currentMerchant) return;
    const shareUrl = `${STORE_URL}?merchant=${encodeURIComponent(currentMerchant)}`;
    const shareText = `تصفح تشكيلة منتجات "${currentMerchant}" في متجر كارامل:\n${shareUrl}`;
    if (navigator.share) {
        navigator.share({ title: `${currentMerchant} - متجر كارامل`, text: shareText, url: shareUrl }).catch(() => {});
    } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
    }
}

let currentFeedItems = [];
let renderedCount = 0;
let feedCycle = 0;
let continuationItems = [];
let continuationBatchIndex = 0;
let cart = [];
let overlayStack = [];
let interestData = { categories: {}, keywords: {}, seenIds: [], sessionRoll: Math.random() };

function isFullSelectionMode() {
    return Boolean(currentMerchant) || Boolean(currentCategory && currentCategory !== "all");
}

function handleProductImageError(imgEl, productId) {
    if (!imgEl) return;
    const currentSrc = imgEl.getAttribute("src") || "";
    const retryStep = Number(imgEl.getAttribute("data-retry-step") || "0");

    if (retryStep === 0 && currentSrc && !/^https?:\/\//i.test(currentSrc)) {
        imgEl.setAttribute("data-retry-step", "1");
        const altSrc = currentSrc.startsWith("./") ? currentSrc.slice(2) : `./${currentSrc}`;
        if (altSrc !== currentSrc) {
            imgEl.src = altSrc;
            return;
        }
    }

    if (retryStep <= 1 && currentSrc && !/^https?:\/\//i.test(currentSrc)) {
        imgEl.setAttribute("data-retry-step", "2");
        const cleanPath = currentSrc.replace(/^\.?\//, "");
        imgEl.src = `https://raw.githubusercontent.com/${GITHUB_MERCHANTS_CONFIG.owner}/${GITHUB_MERCHANTS_CONFIG.repo}/${GITHUB_MERCHANTS_CONFIG.branch}/${cleanPath}`;
        return;
    }

    imgEl.style.opacity = "0.18";
    imgEl.setAttribute("data-broken", "1");
}

function loadCartFromStorage() {
    try {
        const savedCart = localStorage.getItem(CART_STORAGE_KEY);
        if (!savedCart) return [];
        const parsed = JSON.parse(savedCart);
        return Array.isArray(parsed) ? parsed.filter(item => item && item.id) : [];
    } catch (e) { return []; }
}

cart = loadCartFromStorage();

try {
    const savedInterest = localStorage.getItem(INTEREST_STORAGE_KEY);
    if (savedInterest) {
        const parsed = JSON.parse(savedInterest);
        interestData = {
            categories: parsed.categories || {},
            keywords: parsed.keywords || {},
            seenIds: Array.isArray(parsed.seenIds) ? parsed.seenIds : [],
            sessionRoll: Math.random()
        };
    }
} catch (e) {}

function saveCart() {
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch (e) {}
}

function saveInterest() {
    try {
        localStorage.setItem(INTEREST_STORAGE_KEY, JSON.stringify({
            categories: interestData.categories,
            keywords: interestData.keywords,
            seenIds: interestData.seenIds
        }));
    } catch (e) {}
}

function shuffleArray(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function interleaveMerchantsSmartly(list) {
    if (!Array.isArray(list) || list.length <= 2) return [...(list || [])];
    const remaining = [...list];
    const result = [];
    let lastMerchant = "";

    while (remaining.length > 0) {
        let candidateIdx = remaining.findIndex(item => (item.merchant || "") !== lastMerchant);
        if (candidateIdx === -1) candidateIdx = 0;
        const [picked] = remaining.splice(candidateIdx, 1);
        result.push(picked);
        lastMerchant = picked.merchant || "";
    }

    return result;
}

const SEARCH_SYNONYMS = {
    "كهرباء": ["كهربائيه", "كهربائية", "خلاط", "مكواه", "مكواة", "كاتل", "غلايه", "مروحه", "اجهزه"],
    "خلاط": ["كهربائيه", "مطبخ", "هاند بلندر", "كبه"],
    "موبايل": ["هاتف", "هواتف", "تليفون", "شاحن", "سماعه", "كفر", "باور بنك", "ايربودز"],
    "هاتف": ["موبايل", "هواتف", "تليفون", "شاحن", "سماعه", "كفر"],
    "شاحن": ["موبايل", "هواتف", "وصله", "كابل", "باور بنك"],
    "سماعه": ["سماعات", "ايربودز", "بلوتوث", "موبايل", "هواتف"],
    "مجوهرات": ["اكسسوارات", "سلسله", "خاتم", "اسوره", "انسيال", "حلق", "فضه", "ذهب"],
    "اكسسوارات": ["مجوهرات", "سلسله", "خاتم", "اسوره", "انسيال", "حلق", "موبايل"],
    "سلسله": ["مجوهرات", "اكسسوارات", "تعليقه", "عقد"],
    "خاتم": ["مجوهرات", "اكسسوارات", "دبله"],
    "اسوره": ["مجوهرات", "اكسسوارات", "انسيال", "حظاظه"],
    "جمال": ["صحه", "تجميل", "عنايه", "عطور", "برفان", "كريم", "ماسك", "مكياج"],
    "صحه": ["جمال", "عنايه", "طبي", "عطور", "كريم"],
    "مكتبيه": ["مدرسه", "لوازم مكتبيه", "كشكول", "قلم", "دفتر", "ملف", "مسطره"],
    "قلم": ["اقلام", "كشكول", "دفتر", "مدرسه", "مكتبيه"],
    "دفتر": ["كشكول", "نوت بوك", "كراسه", "مدرسه", "مكتبيه"],
    "كوبايات": ["كوب", "اكواب", "كاس", "كاسات", "مج", "مجات"],
    "كوب": ["كوبايات", "اكواب", "كاس", "كاسات", "مج", "مجات"],
    "اكواب": ["كوب", "كوبايات", "كاس", "كاسات", "مج", "مجات"],
    "كاسات": ["كاس", "كوب", "كوبايات", "اكواب", "مج"],
    "مجات": ["مج", "كوب", "كوبايات", "اكواب"],
    "برفان": ["عطر", "عطور", "اسبلش", "سبلاش", "معطر", "مخمرية", "بادي"],
    "عطر": ["برفان", "عطور", "اسبلش", "سبلاش", "مخمرية"],
    "عطور": ["برفان", "عطر", "اسبلش", "سبلاش", "مخمرية"],
    "سبلاش": ["اسبلش", "برفان", "عطر", "معطر"],
    "اسبلش": ["سبلاش", "برفان", "عطر", "معطر"],
    "كشكول": ["كشاكيل", "نوت بوك", "دفتر", "كراسة", "ورق"],
    "كشاكيل": ["كشكول", "نوت بوك", "دفتر", "كراسة"],
    "نوت": ["نوت بوك", "كشكول", "دفتر", "كراسة"],
    "هاند": ["هاند ميد", "يدوي", "مكرمية", "خرز", "لولي"],
    "لولي": ["خرز", "هاند ميد", "شنطة"],
    "شنطة": ["لولي", "خرز", "هاند ميد"],
    "مكرميه": ["مكرمية", "هاند ميد", "يدوي"],
    "صينيه": ["صواني", "صينية", "فرن", "خبز", "تقديم"],
    "صواني": ["صينية", "صينيه", "فرن", "خبز", "تقديم"],
    "حراري": ["حرارية", "حفظ", "ثرموس", "زمزمية", "مج حراري"],
    "شماعه": ["شماعة", "شماعات", "تعليقة", "دولاب"],
    "منشر": ["نشير", "غسيل", "فولاذ", "استانلس"],
    "هديه": ["هدية", "هدايا", "مفاجاة", "صورة", "طباعة"],
    "هدايا": ["هدية", "هديه", "مفاجاة", "صورة", "طباعة"],
    "مرايه": ["مرايا", "مراية", "مرآة", "سحرية"],
    "مرايا": ["مراية", "مرايه", "مرآة", "سحرية"]
};

function normalizeArabicDigits(str) {
    const arabicMap = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
    return String(str || "").replace(/[٠-٩۰-۹]/g, ch => arabicMap[ch] || ch);
}

function normalizeText(str) {
    return normalizeArabicDigits(str || "")
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670]/g, "")
        .replace(/[إأآاٱ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي")
        .replace(/[-_×*\/\\()\[\]{}.,،:؛!؟+]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function boundedLevenshtein(a, b, maxDist = 2) {
    if (a === b) return 0;
    const lenA = a.length;
    const lenB = b.length;
    if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;
    const prev = new Array(lenB + 1);
    const curr = new Array(lenB + 1);
    for (let j = 0; j <= lenB; j++) prev[j] = j;

    for (let i = 1; i <= lenA; i++) {
        curr[0] = i;
        let rowMin = curr[0];
        for (let j = 1; j <= lenB; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + cost
            );
            if (curr[j] < rowMin) rowMin = curr[j];
        }
        if (rowMin > maxDist) return maxDist + 1;
        for (let j = 0; j <= lenB; j++) prev[j] = curr[j];
    }
    return prev[lenB];
}

function termMatchesWord(term, word) {
    if (!term || !word) return false;
    if (word.includes(term) || term.includes(word)) return true;
    if (term.length >= 4 && word.length >= 4) {
        const maxAllowed = term.length >= 6 ? 2 : 1;
        if (boundedLevenshtein(term, word, maxAllowed) <= maxAllowed) return true;
    }
    return false;
}

function expandTermVariants(term) {
    const set = new Set([term]);
    const synList = SEARCH_SYNONYMS[term] || [];
    synList.forEach(s => {
        const ns = normalizeText(s);
        if (ns) set.add(ns);
    });
    return Array.from(set);
}

function buildDynamicSearchTextForProduct(product) {
    if (product._extraSearchText) return product._extraSearchText;
    const skipKeys = new Set(["id", "code", "sku", "img", "image", "photo", "imgUrl", "imageUrl", "thumbnail", "thumb", "picture", "pic", "images", "photos", "imgs", "gallery", "_extraSearchText"]);
    const parts = [];
    Object.entries(product).forEach(([k, v]) => {
        if (skipKeys.has(k) || v === null || v === undefined) return;
        if (typeof v === "string" || typeof v === "number") parts.push(String(v));
        else if (Array.isArray(v)) {
            parts.push(v.map(item => typeof item === "object" && item !== null ? Object.values(item).join(" ") : String(item)).join(" "));
        } else if (typeof v === "object") {
            parts.push(Object.values(v).join(" "));
        }
    });
    return parts.join(" ");
}

let SEARCH_INDEX_MAP = new Map();

function rebuildSearchIndex() {
    const nextMap = new Map();
    PRODUCTS.forEach(p => {
        if (!p || !p.id) return;
        const allCats = [p.category, ...(Array.isArray(p.categories) ? p.categories : [])];
        const catNames = allCats.map(c => CATEGORY_NAMES[c] || c || "").join(" ");
        const normTitle = normalizeText(p.title || "");
        const normDesc = normalizeText(p.desc || "");
        const normMerchant = normalizeText(p.merchant || "");
        const normCats = normalizeText(catNames);
        const normPrice = normalizeText(`${p.price || ""} ${p.priceLabel || ""} ${p.subPrice || ""}`);
        const normExtra = normalizeText(buildDynamicSearchTextForProduct(p));
        const fullHaystack = `${normTitle} ${normDesc} ${normMerchant} ${normCats} ${normPrice} ${normExtra}`;
        nextMap.set(p.id, {
            normTitle,
            normDesc,
            normMerchant,
            normCats,
            fullHaystack,
            words: fullHaystack.split(" ").filter(Boolean),
            titleWords: normTitle.split(" ").filter(Boolean),
            catSet: new Set(allCats.filter(Boolean))
        });
    });
    SEARCH_INDEX_MAP = nextMap;
}

function getProductSearchScore(product, rawQuery) {
    const normalizedQuery = normalizeText(rawQuery);
    if (!normalizedQuery) return 1;

    let idxEntry = SEARCH_INDEX_MAP.get(product.id);
    if (!idxEntry) {
        rebuildSearchIndex();
        idxEntry = SEARCH_INDEX_MAP.get(product.id);
    }

    const normTitle = idxEntry ? idxEntry.normTitle : normalizeText(product.title || "");
    const fullHaystack = idxEntry ? idxEntry.fullHaystack : normalizeText(`${product.title || ""} ${product.desc || ""} ${buildDynamicSearchTextForProduct(product)}`);
    const words = idxEntry ? idxEntry.words : fullHaystack.split(" ").filter(Boolean);
    const titleWords = idxEntry ? idxEntry.titleWords : normTitle.split(" ").filter(Boolean);

    const queryTerms = normalizedQuery.split(" ").filter(Boolean);
    let totalScore = 0;

    for (const term of queryTerms) {
        const variants = expandTermVariants(term);
        let termBestScore = 0;

        if (normTitle.includes(term)) {
            termBestScore = Math.max(termBestScore, normTitle.startsWith(term) ? 100 : 80);
        }

        for (const v of variants) {
            if (titleWords.some(tw => tw === v)) {
                termBestScore = Math.max(termBestScore, 75);
            } else if (titleWords.some(tw => tw.startsWith(v) || v.startsWith(tw))) {
                termBestScore = Math.max(termBestScore, 60);
            } else if (words.some(w => termMatchesWord(v, w))) {
                termBestScore = Math.max(termBestScore, 42);
            } else if (fullHaystack.includes(v)) {
                termBestScore = Math.max(termBestScore, 35);
            }
        }

        if (termBestScore === 0) return 0;
        totalScore += termBestScore;
    }

    return totalScore;
}

function getSmartQuerySuggestion(rawQuery) {
    const normQ = normalizeText(rawQuery);
    if (!normQ || normQ.length < 2 || !PRODUCTS.length) return "";
    const qTokens = normQ.split(" ").filter(Boolean);
    let bestCandidate = "";
    let bestScore = 0;

    for (const p of PRODUCTS) {
        const title = String(p.title || "").trim();
        const normT = normalizeText(title);
        if (!normT) continue;
        const tWords = normT.split(" ").filter(Boolean);
        let score = 0;
        for (const qt of qTokens) {
            const variants = expandTermVariants(qt);
            for (const v of variants) {
                if (tWords.some(w => w.startsWith(v) || v.startsWith(w))) {
                    score += 3;
                } else if (tWords.some(w => w.length >= 3 && v.length >= 3 && boundedLevenshtein(v, w, 2) <= 2)) {
                    score += 2;
                }
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestCandidate = tWords.slice(0, 2).join(" ") || title;
        }
    }
    return bestScore >= 2 ? bestCandidate : "";
}

function matchesSearchQuery(product, rawQuery) {
    return getProductSearchScore(product, rawQuery) > 0;
}

function extractTokens(text) {
    return normalizeText(text).split(/\s+/).map(t => t.trim()).filter(t => t.length >= 1);
}

function updateSearchCancelButton() {
    const input = document.getElementById("homeSearchInput");
    const btn = document.getElementById("searchCancelBtn");
    if (!input || !btn) return;
    btn.style.display = input.value.length > 0 ? "inline-flex" : "none";
}

function handleSearchInput() {
    updateSearchCancelButton();
    const val = document.getElementById("homeSearchInput")?.value || "";
    const tokens = extractTokens(val).filter(t => t.length >= 2);
    if (tokens.length > 0) {
        tokens.forEach(token => { interestData.keywords[token] = (interestData.keywords[token] || 0) + 0.5; });
        saveInterest();
        renderSpotlightBoxes();
    }
    renderProducts(currentCategory);
}

function handleSearchKeyDown(event) {
    if (event.key === "Enter") { event.preventDefault(); handleSearchInput(); scrollToProductsTop(); }
    else if (event.key === "Escape") { event.preventDefault(); cancelSearchMode(); }
}

function cancelSearchMode(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const input = document.getElementById("homeSearchInput");
    if (input) { input.value = ""; input.blur(); }
    updateSearchCancelButton();
    toggleHeaderSearchBar(false);
    renderProducts(currentCategory);
}

function trackProductInterest(product, weight = 1, markSeen = true) {
    if (!product) return;
    const cats = [product.category, ...(Array.isArray(product.categories) ? product.categories : [])];
    cats.forEach(c => {
        if (c) interestData.categories[c] = (interestData.categories[c] || 0) + weight;
    });
    extractTokens(product.title).filter(t => t.length >= 2).forEach(token => {
        interestData.keywords[token] = (interestData.keywords[token] || 0) + weight;
    });
    if (markSeen && !interestData.seenIds.includes(product.id)) {
        interestData.seenIds.push(product.id);
        if (interestData.seenIds.length > 140) interestData.seenIds.shift();
    }
    saveInterest();
    renderSpotlightBoxes();
    if (currentFeedMode === "for-you") {
        renderProducts(currentCategory);
    }
}

function scoreProductForUser(product, seedOffset = 0) {
    const cats = [product.category, ...(Array.isArray(product.categories) ? product.categories : [])];
    let catScore = 0;
    cats.forEach(c => {
        catScore = Math.max(catScore, (interestData.categories[c] || 0) * 12);
    });

    const inCartCat = cart.some(ci => {
        const match = PRODUCTS.find(p => p.id === ci.id);
        return match && cats.includes(match.category);
    });
    if (inCartCat) catScore += 14;

    const tokens = extractTokens(product.title).filter(t => t.length >= 2);
    let kwScore = 0;
    tokens.forEach(t => { kwScore += (interestData.keywords[t] || 0) * 5; });

    const isSeen = interestData.seenIds.includes(product.id);
    const freshnessBonus = isSeen ? -5 : 10;
    const dynamicJitter = ((product.id.charCodeAt(product.id.length - 1) * 13 + seedOffset * 17 + Math.floor(interestData.sessionRoll * 100)) % 9) * 0.8;
    return catScore + kwScore + freshnessBonus + dynamicJitter;
}

function buildEngagingHookForProduct(product) {
    if (!product) return "اختيار عملي ومناسب ليك من متجر كارامل.";
    if (product.category === "gifts") return "هدية بتفاصيل تلمس القلب وتفضل ذكرى مميزة مع صاحبها.";
    if (product.category === "perfume") return "لمسة حضور وراحة تدوم معاك في يومك بسعر مميز من كارامل.";
    if (product.category === "tafse") return "شغل وتفاصيل بتدي شكل مختلف ومميز — جاهزة للطلب فوراً.";
    if (product.category === "school") return "عملية وسهلة الاستخدام وتخدمك يومياً بأفضل قيمة مقابل السعر.";
    if (product.category === "women") return "راحة وأناقة تناسب يومك بسهولة من متجر كارامل.";
    return "قطعة عملية ومفيدة تسهل يومك وتضيف لمسة مرتبة من كارامل.";
}

function setMotionPaused(kind, paused) {
    pausedMotionKind[kind] = Boolean(paused);
}

function paintSpotlightSlide(kind) {
    const list = kind === "trends" ? trendSlideList : dealSlideList;
    const otherList = kind === "trends" ? dealSlideList : trendSlideList;
    const otherIdx = kind === "trends" ? dealSlideIdx : trendSlideIdx;
    const containerId = kind === "trends" ? "trendsSpotlightGrid" : "dealsSpotlightGrid";
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!list.length) {
        container.innerHTML = `<div class="visual-motion-card" style="display:flex;align-items:center;justify-content:center;padding:12px;text-align:center;font-size:0.78rem;font-weight:800;color:var(--text-muted);">${isLoadingJsonProducts ? "جاري التحميل..." : "لا توجد منتجات"}</div>`;
        return;
    }

    const forbiddenImg = (otherList && otherList.length) ? otherList[otherIdx % otherList.length].img : "";
    let idx = (kind === "trends" ? trendSlideIdx : dealSlideIdx) % list.length;

    if (list.length > 1 && list[idx].img === forbiddenImg) {
        const altIndex = list.findIndex((item, i) => i !== idx && item.img !== forbiddenImg);
        if (altIndex !== -1) {
            idx = altIndex;
            if (kind === "trends") trendSlideIdx = idx;
            else dealSlideIdx = idx;
        }
    }

    const p = list[idx];
    const displayPrice = p.priceLabel || p.price;
    const imgSrc = normalizeProductImageUrl(p.img);

    const dotsHTML = list.map((_, i) =>
        `<button type="button" class="showcase-dot ${i === idx ? "active" : ""}" onclick="event.stopPropagation(); jumpSpotlightSlide('${kind}', ${i})" aria-label="صورة ${i + 1}"></button>`
    ).join("");

    container.innerHTML = `
        <div class="visual-motion-card" onclick="openImageModal('${escapeHtmlAttr(imgSrc)}', '${escapeHtmlAttr(p.id)}')">
            <img key="${escapeHtmlAttr(p.id)}-${idx}" src="${escapeHtmlAttr(imgSrc)}" alt="${escapeHtmlAttr(p.title)}" onerror="handleProductImageError(this, '${escapeHtmlAttr(p.id)}')">
            <div class="visual-price-overlay">
                <div class="visual-price-pill">${displayPrice}<span>جنيه</span></div>
                <div class="showcase-dots-row" onclick="event.stopPropagation()">${dotsHTML}</div>
            </div>
        </div>
    `;
}

function jumpSpotlightSlide(kind, idx) {
    if (kind === "trends") trendSlideIdx = idx;
    else dealSlideIdx = idx;
    paintSpotlightSlide("trends");
    paintSpotlightSlide("deals");
}

function renderSpotlightBoxes() {
    if (!PRODUCTS.length) {
        trendSlideList = [];
        dealSlideList = [];
        paintSpotlightSlide("trends");
        paintSpotlightSlide("deals");
        return;
    }
    const hasTaste = Object.keys(interestData.categories).length > 0 || Object.keys(interestData.keywords).length > 0 || cart.length > 0;

    const lowStockCandidates = interleaveMerchantsSmartly([...PRODUCTS].sort((a, b) => {
        const scoreA = scoreProductForUser(a, 3) + (a.badge ? 8 : 0);
        const scoreB = scoreProductForUser(b, 3) + (b.badge ? 8 : 0);
        return scoreB - scoreA;
    }));

    const pickedLowStock = [];
    for (const p of lowStockCandidates) {
        if (!pickedLowStock.some(x => x.img === p.img)) pickedLowStock.push(p);
        if (pickedLowStock.length === 5) break;
    }
    trendSlideList = pickedLowStock.length ? pickedLowStock : lowStockCandidates.slice(0, 5);
    trendSlideIdx = trendSlideIdx % Math.max(1, trendSlideList.length);

    const usedLowStockImgs = new Set(trendSlideList.map(x => x.img));
    const dealRanked = interleaveMerchantsSmartly([...PRODUCTS]
        .filter(p => Number(p.price) > 0)
        .sort((a, b) => {
            const tasteA = scoreProductForUser(a, 5);
            const tasteB = scoreProductForUser(b, 5);
            const priceFactorA = 1000 / (Number(a.price) + 15);
            const priceFactorB = 1000 / (Number(b.price) + 15);
            const totalA = hasTaste ? (tasteA * 1.15 + priceFactorA * 2.2) : (priceFactorA * 3 + (interestData.sessionRoll * 5));
            const totalB = hasTaste ? (tasteB * 1.15 + priceFactorB * 2.2) : (priceFactorB * 3 + (interestData.sessionRoll * 5));
            return totalB - totalA;
        }));

    const pickedDeals = [];
    for (const p of dealRanked) {
        if (!usedLowStockImgs.has(p.img) && !pickedDeals.some(x => x.img === p.img)) {
            pickedDeals.push(p);
        }
        if (pickedDeals.length === 5) break;
    }
    dealSlideList = pickedDeals.length ? pickedDeals : dealRanked.slice(0, 5);
    dealSlideIdx = dealSlideIdx % Math.max(1, dealSlideList.length);

    paintSpotlightSlide("trends");
    paintSpotlightSlide("deals");
}

setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (!pausedMotionKind.trends && trendSlideList.length > 1) {
        trendSlideIdx = (trendSlideIdx + 1) % trendSlideList.length;
        paintSpotlightSlide("trends");
    }
    if (!pausedMotionKind.deals && dealSlideList.length > 1) {
        dealSlideIdx = (dealSlideIdx + 1) % dealSlideList.length;
        paintSpotlightSlide("deals");
    }
}, 3200);

function setFeedMode(mode, btnEl) {
    currentFeedMode = mode || "for-you";
    document.querySelectorAll("#feedFilterPills .feed-pill-btn").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    renderProducts(currentCategory);
}

function jumpToFeedMode(mode) {
    const targetBtn = document.querySelector(`#feedFilterPills .feed-pill-btn[data-mode="${mode}"]`);
    setFeedMode(mode, targetBtn);
    scrollToProductsTop();
}

function renderSideCategoriesList() {
    const container = document.getElementById("sideCategoriesList");
    if (!container) return;
    const keys = Object.keys(CATEGORY_NAMES);
    container.innerHTML = keys.map(catKey => {
        const isActive = !currentMerchant && currentCategory === catKey;
        const theme = CATEGORY_THEME_META[catKey] || CATEGORY_THEME_META.all;
        const iconSvg = buildCategoryGraphicSvg(catKey, theme.stroke);
        const descText = CATEGORY_SUBTITLES[catKey] || "";

        return `
            <button type="button"
                class="clean-cat-tile ${isActive ? "active" : ""}"
                onclick="selectCategoryFromDrawer('${catKey}')">
                <span class="clean-cat-top-row">
                    <span class="clean-cat-icon-badge" style="background:${theme.bg};" aria-hidden="true">${iconSvg}</span>
                    <span class="clean-cat-label">${escapeHtmlAttr(CATEGORY_NAMES[catKey])}</span>
                </span>
                ${descText ? `<span class="clean-cat-desc">${escapeHtmlAttr(descText)}</span>` : ""}
            </button>
        `;
    }).join("");
}

function selectCategoryFromDrawer(catKey) {
    closeCategoriesDrawer();
    const topTab = document.querySelector(`.quick-top-tabs .quick-tab-item[data-quick="${catKey}"]`);
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => el.classList.remove("active"));
    if (topTab) topTab.classList.add("active");
    filterByCategory(catKey, topTab || null, true);
}

function openCategoriesDrawer() {
    renderSideCategoriesList();
    const drawer = document.getElementById("catsDrawer");
    const backdrop = document.getElementById("catsBackdrop");
    if (drawer) drawer.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("cats");
}

function closeCategoriesDrawer(fromPopState = false) {
    const drawer = document.getElementById("catsDrawer");
    const backdrop = document.getElementById("catsBackdrop");
    if (drawer) drawer.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("cats");
}

function hydrateTopQuickTabIcons() {
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(btn => {
        const catKey = btn.getAttribute("data-quick");
        if (!catKey || btn.querySelector(".quick-tab-icon")) return;
        const labelText = btn.textContent.trim();
        const strokeColor = catKey === "all" ? "#e5be96" : (CATEGORY_THEME_META[catKey]?.stroke || "currentColor");
        const iconSvg = buildCategoryGraphicSvg(catKey, strokeColor);
        btn.innerHTML = `<span class="quick-tab-icon" aria-hidden="true">${iconSvg}</span><span>${escapeHtmlAttr(labelText)}</span>`;
    });
}

function selectTopQuickTab(cat, tabEl) {
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => el.classList.remove("active"));
    if (tabEl) {
        tabEl.classList.add("active");
        try { tabEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); } catch (e) {}
    }
    filterByCategory(cat, tabEl, true);
}

function buildOtherProductsWave(limit = CONTINUATION_STEP) {
    if (!PRODUCTS.length) return [];
    let pool = [];
    if (currentMerchant) {
        pool = PRODUCTS.filter(p => p.merchant !== currentMerchant);
    } else if (currentCategory && currentCategory !== "all") {
        pool = PRODUCTS.filter(p => {
            const cats = [p.category, ...(Array.isArray(p.categories) ? p.categories : [])];
            return !cats.includes(currentCategory);
        });
    }
    if (!pool.length) pool = [...PRODUCTS];
    return interleaveMerchantsSmartly(shuffleArray(pool)).slice(0, limit);
}

function appendMoreContinuationCards() {
    const grid = document.getElementById("continuationAfterGrid");
    if (!grid) return;
    continuationBatchIndex += 1;
    const nextWave = buildOtherProductsWave(CONTINUATION_STEP);
    continuationItems.push(...nextWave);
    grid.insertAdjacentHTML("beforeend", nextWave.map(p => buildProductCardHTML(p, `cont-${continuationBatchIndex}`)).join(""));
}

function renderContinuationAfterSection() {
    const container = document.getElementById("continuationAfterRecommendations");
    if (!container) return;
    if (!isFullSelectionMode() || !PRODUCTS.length) {
        continuationItems = [];
        continuationBatchIndex = 0;
        container.innerHTML = "";
        return;
    }
    continuationBatchIndex = 0;
    continuationItems = buildOtherProductsWave(CONTINUATION_STEP);
    if (!continuationItems.length) { container.innerHTML = ""; return; }

    const contextLabel = currentMerchant
        ? `بعد منتجات ${currentMerchant}.. منتجات أخرى متنوعة من المتجر`
        : `بعد قسم ${CATEGORY_NAMES[currentCategory] || "القسم"}.. منتجات أخرى متنوعة من المتجر`;

    container.innerHTML = `
        <section class="continuation-after-section">
            <div class="continuation-after-header">
                <h3>${escapeHtmlAttr(contextLabel)}</h3>
                <span class="smart-tag">منتجات متنوعة مستمرة</span>
            </div>
            <div class="continuation-after-grid" id="continuationAfterGrid">
                ${continuationItems.map(p => buildProductCardHTML(p, "cont-0")).join("")}
            </div>
            <div class="continuation-load-more-wrap">
                <button type="button" class="continuation-load-more-btn" onclick="appendMoreContinuationCards()">
                    <span>عرض المزيد من المنتجات المتنوعة</span>
                </button>
            </div>
        </section>
    `;
}

function filterByMerchant(merchantName, shouldScroll = true) {
    if (!merchantName) return;
    currentMerchant = merchantName;
    const input = document.getElementById("homeSearchInput");
    if (input) input.value = "";
    updateSearchCancelButton();
    currentCategory = "all";
    applyCategoryPageMood("all");
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-quick") === "all");
    });
    renderProducts("all");
    if (shouldScroll) scrollToProductsTop();
}

function clearMerchantFilter(shouldScroll = true) {
    currentMerchant = "";
    applyCategoryPageMood(currentCategory);
    renderProducts(currentCategory);
    if (shouldScroll) scrollToProductsTop();
}

function updateMerchantBanner(merchantProductsList) {
    const banner = document.getElementById("activeMerchantBanner");
    const nameEl = document.getElementById("merchantBannerName");
    const countEl = document.getElementById("merchantBannerCount");
    const avatarEl = document.getElementById("merchantAvatarInitial");
    if (!banner || !nameEl || !countEl) return;

    document.body.classList.toggle("merchant-storefront-mode", Boolean(currentMerchant));

    if (!currentMerchant) {
        banner.classList.remove("visible");
        nameEl.textContent = "";
        countEl.textContent = "";
        return;
    }

    const totalForMerchant = PRODUCTS.filter(p => p.merchant === currentMerchant).length;
    const visibleCount = Array.isArray(merchantProductsList) ? merchantProductsList.length : totalForMerchant;
    nameEl.textContent = currentMerchant;
    if (avatarEl) avatarEl.textContent = currentMerchant.trim().charAt(0) || "ك";
    countEl.textContent = visibleCount === totalForMerchant ? `${totalForMerchant} منتج متاح` : `${visibleCount} من ${totalForMerchant} منتج`;
    banner.classList.add("visible");
}

function buildSpecialRequestCardHTML() {
    const waMerchant = encodeURIComponent("مرحباً متجر كارامل، أرغب في الانضمام كتاجر");
    return `
        <article class="special-request-card">
            <div>
                <h3>كن تاجر</h3>
                <p>اعرض منتجاتك معنا ووصل لعملائك بسهولة عبر متجر كارامل.</p>
            </div>
            <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${waMerchant}" class="special-request-btn" target="_blank" rel="noopener noreferrer" onclick="event.preventDefault(); launchWhatsAppTarget(this.href);">
                تواصل كتاجر على واتساب
            </a>
        </article>
    `;
}

function buildProductCardHTML(product, instanceTag = "base") {
    const displayPrice = product.priceLabel || product.price;
    const merchantName = product.merchant || "متجر كارامل";
    const imgs = getProductImagesList(product);
    const imgSrc = imgs[0] || "";
    const hasMultiImgs = imgs.length > 1;
    const waUrl = buildProductWhatsAppUrl(product, imgSrc);
    const btnId = `btn-${instanceTag}-${product.id}`;

    const styleClass = product.cardStyle === "gold"
        ? "card-style-gold"
        : (product.cardStyle === "vip" ? "card-style-vip" : "");
    const badgeHtml = product.badge ? `<span class="card-json-badge">${escapeHtmlAttr(product.badge)}</span>` : "";

    const multiControlsHTML = hasMultiImgs ? `
        <button type="button" class="card-img-nav-btn prev" onclick="cycleCardImage(this, this.closest('.product-card').dataset.productId, -1, event)" aria-label="الصورة السابقة">›</button>
        <button type="button" class="card-img-nav-btn next" onclick="cycleCardImage(this, this.closest('.product-card').dataset.productId, 1, event)" aria-label="الصورة التالية">‹</button>
        <span class="card-img-counter">1/${imgs.length}</span>
        <div class="card-img-dots">
            ${imgs.map((_, idx) => `<button type="button" class="card-img-dot ${idx === 0 ? "active" : ""}" onclick="jumpCardImage(this, this.closest('.product-card').dataset.productId, ${idx}, event)" aria-label="صورة ${idx + 1}"></button>`).join("")}
        </div>
    ` : "";

    return `
        <article class="product-card ${styleClass}" data-product-id="${escapeHtmlAttr(product.id)}" data-merchant="${escapeHtmlAttr(merchantName)}">
            ${badgeHtml}
            <div class="product-img-box"
                 onmouseenter="startCardAutoSlide(this.closest('.product-card'), this.closest('.product-card').dataset.productId)"
                 onmouseleave="stopCardAutoSlide()"
                 ontouchstart="startCardAutoSlide(this.closest('.product-card'), this.closest('.product-card').dataset.productId)"
                 onclick="stopCardAutoSlide(); const _c = this.closest('.product-card'); openImageModal(this.querySelector('img')?.getAttribute('src') || '${escapeHtmlAttr(imgSrc)}', _c.dataset.productId)">
                <img src="${escapeHtmlAttr(imgSrc)}" data-img-idx="0" alt="${escapeHtmlAttr(product.title)}" loading="lazy" onerror="handleProductImageError(this, this.closest('.product-card').dataset.productId)">
                ${multiControlsHTML}
            </div>
            <div class="product-details">
                <div>
                    <div class="product-title">${escapeHtmlAttr(product.title)}</div>
                    <div class="product-price-row">
                        <div class="product-price">${displayPrice}<span>جنيه</span></div>
                        ${product.subPrice ? `<div class="product-sub">${escapeHtmlAttr(product.subPrice)}</div>` : ""}
                    </div>
                    ${product.desc ? `<div class="product-desc">${escapeHtmlAttr(product.desc)}</div>` : ""}
                    <button type="button" class="merchant-tag-btn" onclick="event.stopPropagation(); filterByMerchant(this.closest('.product-card').dataset.merchant)" title="عرض منتجات ${escapeHtmlAttr(merchantName)} فقط">
                        <span>التاجر:</span>
                        <span class="merchant-tag-name">${escapeHtmlAttr(merchantName)}</span>
                    </button>
                </div>
                <div class="card-btns">
                    <button type="button" class="add-cart-btn" id="${btnId}" onclick="const _c = this.closest('.product-card'); const _p = PRODUCTS.find(x => x.id === _c.dataset.productId); openProductOptionModal(_c.dataset.productId, '${btnId}', getActiveCardImageSrc(_c, _p))">
                        <span>+ للمشتريات</span>
                    </button>
                    <a href="${escapeHtmlAttr(waUrl)}" class="direct-wa-link" target="_blank" rel="noopener noreferrer" onclick="event.preventDefault(); const _c = this.closest('.product-card'); const _id = _c.dataset.productId; const _p = PRODUCTS.find(x => x.id === _id); const _u = buildProductWhatsAppUrl(_p, getActiveCardImageSrc(_c, _p)); this.href = _u; onDirectWhatsAppClick(_id); launchWhatsAppTarget(_u);">
                        <span>واتساب</span>
                    </a>
                </div>
            </div>
        </article>
    `;
}

function sortEconomicAcrossCategories(list) {
    const byPriceAsc = [...list].sort((a, b) => (Number(a.price) || 999999) - (Number(b.price) || 999999));
    const buckets = new Map();
    byPriceAsc.forEach(item => {
        const catKey = item.category || "other";
        if (!buckets.has(catKey)) buckets.set(catKey, []);
        buckets.get(catKey).push(item);
    });

    const interleaved = [];
    let added = true;
    while (added) {
        added = false;
        for (const [, queue] of buckets.entries()) {
            if (queue.length > 0) {
                interleaved.push(queue.shift());
                added = true;
            }
        }
    }
    return interleaveMerchantsSmartly(interleaved);
}

function getFilteredProducts(category, rawQuery) {
    const hasSearch = Boolean(normalizeText(rawQuery));
    let baseCategoryList = PRODUCTS.filter(p => {
        const catMatch = hasSearch || category === "all" || p.category === category || (Array.isArray(p.categories) && p.categories.includes(category));
        const merchantMatch = hasSearch || !currentMerchant || p.merchant === currentMerchant;
        return catMatch && merchantMatch && matchesSearchQuery(p, rawQuery);
    });

    renderSmartPriceChips(baseCategoryList);

    let list = baseCategoryList.filter(p => {
        if (!currentMaxPrice) return true;
        const pPrice = Number(p.price) || 0;
        if (currentMaxPrice === 1001) return pPrice > 1000;
        return pPrice > 0 && pPrice <= currentMaxPrice;
    });

    if (hasSearch) {
        return [...list].sort((a, b) => getProductSearchScore(b, rawQuery) - getProductSearchScore(a, rawQuery));
    }

    if (currentFeedMode === "deals") {
        list = sortEconomicAcrossCategories(list);
    } else if (currentFeedMode === "new") {
        list = interleaveMerchantsSmartly([...list].reverse());
    } else {
        const hasTaste = Object.keys(interestData.categories).length > 0 || Object.keys(interestData.keywords).length > 0 || cart.length > 0;
        const ranked = hasTaste
            ? [...list].sort((a, b) => scoreProductForUser(b, 2) - scoreProductForUser(a, 2))
            : shuffleArray(list);
        list = interleaveMerchantsSmartly(ranked);
    }

    return list;
}

function buildFeedPool(category, rawQuery) {
    const base = getFilteredProducts(category, rawQuery);
    if (base.length === 0) return [];

    const items = base.map(product => ({ type: "product", product, tag: "p0" }));
    if (!currentMerchant && !normalizeText(rawQuery)) {
        items.splice(Math.min(7, items.length), 0, { type: "special", id: "special-0" });
    }
    return items;
}

function appendContinuationWave(category, rawQuery) {
    const sourcePool = getFilteredProducts(category, rawQuery);
    if (sourcePool.length === 0) return;
    feedCycle += 1;
    const waveSorted = currentFeedMode === "for-you" ? interleaveMerchantsSmartly(shuffleArray(sourcePool)) : sourcePool;
    const waveItems = waveSorted.map(product => ({ type: "product", product, tag: `w${feedCycle}` }));
    waveItems.push({ type: "special", id: `special-${feedCycle}` });
    currentFeedItems.push(...waveItems);
}

function renderMoreFeedItems() {
    const grid = document.getElementById("productsGrid");
    const sentinel = document.getElementById("feedSentinel");
    if (!grid) return;

    const rawQuery = document.getElementById("homeSearchInput")?.value || "";
    if (currentFeedItems.length === 0) return;

    if (isFullSelectionMode()) {
        if (renderedCount < currentFeedItems.length) {
            const remainingSlice = currentFeedItems.slice(renderedCount);
            grid.insertAdjacentHTML("beforeend", remainingSlice.map(entry => entry.type === "special" ? buildSpecialRequestCardHTML() : buildProductCardHTML(entry.product, entry.tag)).join(""));
            renderedCount = currentFeedItems.length;
        }
        if (!document.getElementById("continuationAfterGrid")) renderContinuationAfterSection();
        else if (sentinel) appendMoreContinuationCards();
        if (sentinel) sentinel.textContent = "انزل للأسفل أو اضغط للمزيد من المنتجات المتنوعة";
        return;
    }

    if (renderedCount >= currentFeedItems.length) appendContinuationWave(currentCategory, rawQuery);

    const nextSlice = currentFeedItems.slice(renderedCount, renderedCount + BATCH_SIZE);
    if (!nextSlice.length) return;

    grid.insertAdjacentHTML("beforeend", nextSlice.map(entry => entry.type === "special" ? buildSpecialRequestCardHTML() : buildProductCardHTML(entry.product, entry.tag)).join(""));
    renderedCount += nextSlice.length;
    if (sentinel) sentinel.textContent = "اكتشف المزيد بالأسفل أو اطلب أي منتج خاص";
}

function renderProducts(category = currentCategory) {
    stopCardAutoSlide();
    currentCategory = category;
    applyCategoryPageMood(currentMerchant ? "all" : category);
    feedCycle = 0;
    renderedCount = 0;

    const grid = document.getElementById("productsGrid");
    const titleEl = document.getElementById("activeCategoryTitle");
    const countBadgeEl = document.getElementById("resultsCountBadge");
    const sentinel = document.getElementById("feedSentinel");
    const rawQuery = document.getElementById("homeSearchInput")?.value || "";
    const trimmedQuery = rawQuery.trim();

    const filteredList = getFilteredProducts(category, rawQuery);
    updateMerchantBanner(filteredList);

    const searchSummaryBar = document.getElementById("searchResultsSummaryBar");
    const searchSummaryText = document.getElementById("searchResultsSummaryText");
    if (searchSummaryBar && searchSummaryText) {
        if (trimmedQuery) {
            searchSummaryText.innerHTML = `نتائج البحث الذكي في كل المتجر عن "<strong>${escapeHtmlAttr(trimmedQuery)}</strong>": <strong>${filteredList.length}</strong> منتج`;
            searchSummaryBar.classList.add("visible");
        } else {
            searchSummaryBar.classList.remove("visible");
            searchSummaryText.textContent = "";
        }
    }

    const modeSuffix = currentFeedMode === "new"
        ? " — مدخلات جديدة"
        : (currentFeedMode === "deals" ? " — أسعار اقتصادية" : " — من أجلك");
    const baseCatTitle = currentMerchant ? `منتجات التاجر: ${currentMerchant}` : `${CATEGORY_NAMES[category] || "المنتجات"}${modeSuffix}`;
    titleEl.textContent = trimmedQuery ? `نتائج البحث: "${trimmedQuery}"` : baseCatTitle;

    if (countBadgeEl) {
        countBadgeEl.textContent = isLoadingJsonProducts && !PRODUCTS.length ? "جاري التحميل..." : `${filteredList.length} منتج`;
    }

    currentFeedItems = buildFeedPool(category, rawQuery);

    if (currentFeedItems.length === 0) {
        const afterEl = document.getElementById("continuationAfterRecommendations");
        if (afterEl) afterEl.innerHTML = "";
        if (sentinel) sentinel.textContent = "";

        if (isLoadingJsonProducts && !PRODUCTS.length) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; background: var(--surface-elevated); padding: 26px; border-radius: 20px; text-align: center; border: 1px solid var(--accent-glow);">
                    <p style="font-weight: 800; color: var(--text-main);">جاري تحميل منتجات التجار من ملفات الـ JSON...</p>
                </div>
            `;
            return;
        }

        const suggestionTerm = trimmedQuery ? getSmartQuerySuggestion(trimmedQuery) : "";
        const emptyMsg = trimmedQuery
            ? `ملقيناش نتيجة مطابقة لـ "${trimmedQuery}".. جرّب كلمة بحث أخرى أو تواصل معنا.`
            : (!PRODUCTS.length
                ? "لم يتم العثور على منتجات صالحة داخل ملفات الـ JSON حالياً."
                : "لا توجد منتجات مطابقة للتصفية الحالية.. جرّب قسماً آخر أو تواصل معنا.");

        const suggestionBtnHtml = suggestionTerm
            ? `<button type="button" class="add-cart-btn" style="max-width: 240px;" onclick="applyQuickSearch('${escapeHtmlAttr(suggestionTerm)}')">هل تقصد: ${escapeHtmlAttr(suggestionTerm)}؟</button>`
            : "";

        grid.innerHTML = `
            <div style="grid-column: 1 / -1; background: var(--surface-elevated); padding: 26px; border-radius: 20px; text-align: center; border: 1px solid var(--accent-glow);">
                <p style="font-weight: 800; margin-bottom: 12px;">${escapeHtmlAttr(emptyMsg)}</p>
                <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                    ${suggestionBtnHtml}
                    <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("أريد طلب منتج: " + (trimmedQuery || "منتج خاص"))}" class="add-cart-btn" style="max-width: 240px;" target="_blank" rel="noopener noreferrer" onclick="event.preventDefault(); launchWhatsAppTarget(this.href);">اطلب المنتج على واتساب</a>
                </div>
            </div>
        `;
        return;
    }

    const initialSlice = isFullSelectionMode() ? currentFeedItems : currentFeedItems.slice(0, BATCH_SIZE);
    grid.innerHTML = initialSlice.map(entry => entry.type === "special" ? buildSpecialRequestCardHTML() : buildProductCardHTML(entry.product, entry.tag)).join("");
    renderedCount = initialSlice.length;

    if (isFullSelectionMode()) {
        renderContinuationAfterSection();
        if (sentinel) sentinel.textContent = "انزل للأسفل أو اضغط للمزيد من المنتجات المتنوعة";
    } else {
        const afterEl = document.getElementById("continuationAfterRecommendations");
        if (afterEl) afterEl.innerHTML = "";
        if (sentinel) sentinel.textContent = "انزل للأسفل لعرض المزيد من المنتجات تلقائياً";
    }
}

const feedObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting && currentFeedItems.length > 0) renderMoreFeedItems();
    });
}, { rootMargin: "420px 0px" });

const sentinelEl = document.getElementById("feedSentinel");
if (sentinelEl) feedObserver.observe(sentinelEl);

function scrollToProductsTop() {
    const target = document.getElementById("activeMerchantBanner")?.classList.contains("visible")
        ? document.getElementById("activeMerchantBanner")
        : document.getElementById("productsSectionHeading");
    if (!target) return;
    const bar = document.querySelector(".top-app-bar");
    const quickTabs = document.querySelector(".quick-top-tabs");
    const priceBar = document.querySelector(".sticky-price-bar");
    const offset = (bar ? bar.offsetHeight : 0) + (quickTabs ? quickTabs.offsetHeight : 0) + (priceBar ? priceBar.offsetHeight : 0) + 12;
    const y = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

function filterByCategory(category, tabEl = null, shouldScroll = false) {
    currentMerchant = "";
    currentMaxPrice = 0;
    const searchInput = document.getElementById("homeSearchInput");
    if (searchInput && searchInput.value) {
        searchInput.value = "";
        updateSearchCancelButton();
    }
    if (tabEl) {
        document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => el.classList.remove("active"));
        tabEl.classList.add("active");
    } else {
        document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => {
            el.classList.toggle("active", el.getAttribute("data-quick") === category);
        });
    }
    if (category && category !== "all") {
        interestData.categories[category] = (interestData.categories[category] || 0) + 1.5;
        saveInterest();
    }
    renderProducts(category);
    if (shouldScroll) scrollToProductsTop();
}

function resetHomeFresh() {
    closeAllOverlays();
    currentMerchant = "";
    currentMaxPrice = 0;
    currentFeedMode = "for-you";
    document.querySelectorAll("#feedFilterPills .feed-pill-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === "for-you"));
    const searchInput = document.getElementById("homeSearchInput");
    if (searchInput) searchInput.value = "";
    updateSearchCancelButton();
    toggleHeaderSearchBar(false);
    interestData.sessionRoll = Math.random();
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => el.classList.toggle("active", el.getAttribute("data-quick") === "all"));
    renderSpotlightBoxes();
    renderProducts("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function pulseBottomNav(navId) {
    const btn = document.getElementById(navId);
    if (!btn) return;
    btn.classList.remove("pop");
    void btn.offsetWidth;
    btn.classList.add("pop");
    setTimeout(() => btn.classList.remove("pop"), 320);
}

function getCartItemKey(id, size, color, note, img) {
    return `${id}__${size || ""}__${color || ""}__${(note || "").trim()}__${img || ""}`;
}

function addProductToCartDirect(productId, btnId = null, customSize = "", customColor = "", customNote = "", customImg = "", customPrice = null, customQty = 1) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    const variantConfig = getProductVariantConfig(product);
    const firstSizeEntry = variantConfig && variantConfig.sizes ? variantConfig.sizes[0] : null;
    const defaultSize = typeof firstSizeEntry === "object" ? (firstSizeEntry.label || "") : (firstSizeEntry || "");
    const defaultSizePrice = typeof firstSizeEntry === "object" && Number(firstSizeEntry.price) > 0 ? Number(firstSizeEntry.price) : 0;
    const defaultColor = variantConfig && variantConfig.colors ? variantConfig.colors[0] : "";

    const finalSize = customSize || defaultSize;
    const finalColor = customColor || defaultColor;
    const finalNote = (customNote || "").trim();
    const imgs = getProductImagesList(product);
    const finalImg = normalizeProductImageUrl(customImg) || (imgs[0] || "");
    const unitPrice = (typeof customPrice === "number" && customPrice > 0)
        ? customPrice
        : (defaultSizePrice > 0 ? defaultSizePrice : (Number(product.price) || 0));
    const addQty = Math.max(1, parseInt(customQty, 10) || 1);

    const itemKey = getCartItemKey(product.id, finalSize, finalColor, finalNote, finalImg);
    const existing = cart.find(item => (item.cartKey || getCartItemKey(item.id, item.size, item.color, item.note, item.img)) === itemKey);

    if (existing) existing.qty += addQty;
    else {
        cart.push({
            cartKey: itemKey,
            id: product.id,
            title: product.title,
            price: unitPrice,
            img: finalImg,
            merchant: product.merchant || "متجر كارامل",
            qty: addQty,
            size: finalSize,
            color: finalColor,
            note: finalNote
        });
    }

    saveCart();
    updateCartUI();
    trackProductInterest(product, 2, true);
    pulseBottomNav("navCartBtn");

    if (btnId) {
        const btn = document.getElementById(btnId);
        if (btn) {
            const origHTML = btn.innerHTML;
            btn.classList.add("added");
            btn.innerHTML = `<span>تمت الإضافة</span>`;
            setTimeout(() => { btn.classList.remove("added"); btn.innerHTML = origHTML; }, 1100);
        }
    }
}

function changeModalQty(delta) {
    const nextQty = Math.max(1, (pendingOptionSelection.qty || 1) + delta);
    pendingOptionSelection.qty = nextQty;
    const valEl = document.getElementById("optionModalQtyVal");
    if (valEl) valEl.textContent = String(nextQty);
}

function selectModalPreviewThumb(thumbIdx) {
    const imgs = pendingOptionSelection.imgs || [];
    if (!imgs.length) return;
    const safeIdx = ((thumbIdx % imgs.length) + imgs.length) % imgs.length;
    pendingOptionSelection.selectedImg = imgs[safeIdx];
    const mainImg = document.getElementById("optionModalImg");
    if (mainImg) mainImg.src = imgs[safeIdx];
    const thumbsRow = document.getElementById("optionModalThumbsRow");
    if (thumbsRow) {
        thumbsRow.querySelectorAll(".preview-thumb-btn").forEach((b, idx) => b.classList.toggle("active", idx === safeIdx));
    }
}

function openProductOptionModal(productId, btnId = null, activeCardImg = "") {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    const variantConfig = getProductVariantConfig(product);
    const imgs = getProductImagesList(product);
    const chosenImg = normalizeProductImageUrl(activeCardImg) || (imgs[0] || "");
    const activeIdx = Math.max(0, imgs.indexOf(chosenImg));

    let initialSize = "";
    let initialPrice = Number(product.price) || 0;
    if (variantConfig && variantConfig.sizes && variantConfig.sizes.length) {
        const firstEntry = variantConfig.sizes[0];
        if (typeof firstEntry === "object") {
            initialSize = firstEntry.label || "";
            if (Number(firstEntry.price) > 0) initialPrice = Number(firstEntry.price);
        } else {
            initialSize = firstEntry;
        }
    }

    pendingOptionSelection = {
        productId: product.id,
        clickedBtnId: btnId,
        selectedSize: initialSize,
        selectedColor: variantConfig && variantConfig.colors ? variantConfig.colors[0] : "",
        selectedImg: chosenImg,
        currentPrice: initialPrice,
        imgs,
        qty: 1
    };

    const qtyValEl = document.getElementById("optionModalQtyVal");
    if (qtyValEl) qtyValEl.textContent = "1";

    document.getElementById("optionModalImg").src = chosenImg;
    document.getElementById("optionModalTitle").textContent = product.title;
    document.getElementById("optionModalPrice").innerHTML = `${pendingOptionSelection.currentPrice} <span>جنيه</span>`;

    const thumbsRow = document.getElementById("optionModalThumbsRow");
    if (thumbsRow) {
        if (imgs.length > 1) {
            thumbsRow.style.display = "flex";
            thumbsRow.innerHTML = imgs.map((u, i) => `
                <button type="button" class="preview-thumb-btn ${i === activeIdx ? "active" : ""}" onclick="selectModalPreviewThumb(${i})" aria-label="صورة ${i + 1}">
                    <img src="${escapeHtmlAttr(u)}" alt="${escapeHtmlAttr(product.title)} ${i + 1}">
                </button>
            `).join("");
        } else {
            thumbsRow.style.display = "none";
            thumbsRow.innerHTML = "";
        }
    }

    const sizeGroup = document.getElementById("optionModalSizeGroup");
    const sizePills = document.getElementById("optionModalSizePills");
    if (variantConfig && variantConfig.sizes && variantConfig.sizes.length) {
        sizeGroup.style.display = "flex";
        sizePills.innerHTML = variantConfig.sizes.map((sz, idx) => {
            const labelText = typeof sz === "object" ? sz.label : sz;
            const optPrice = typeof sz === "object" && Number(sz.price) > 0 ? Number(sz.price) : (Number(product.price) || 0);
            return `<button type="button" class="option-pill-btn ${idx === 0 ? "selected" : ""}" onclick="selectOptionPill('size', ${idx}, this)">${escapeHtmlAttr(labelText)}${typeof sz === "object" && optPrice > 0 && !labelText.includes("جنيه") ? ` — ${optPrice} ج` : ""}</button>`;
        }).join("");
    } else {
        sizeGroup.style.display = "none";
        sizePills.innerHTML = "";
    }

    const colorGroup = document.getElementById("optionModalColorGroup");
    const colorPills = document.getElementById("optionModalColorPills");
    if (variantConfig && variantConfig.colors && variantConfig.colors.length) {
        colorGroup.style.display = "flex";
        colorPills.innerHTML = variantConfig.colors.map((cl, idx) =>
            `<button type="button" class="option-pill-btn ${idx === 0 ? "selected" : ""}" onclick="selectOptionPill('color', ${idx}, this)">${escapeHtmlAttr(cl)}</button>`
        ).join("");
    } else {
        colorGroup.style.display = "none";
        colorPills.innerHTML = "";
    }

    document.getElementById("optionModalNoteInput").value = "";
    document.getElementById("productOptionModal").classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("optionModal");
}

function selectOptionPill(type, idx, btnEl) {
    const product = PRODUCTS.find(p => p.id === pendingOptionSelection.productId);
    const variantConfig = getProductVariantConfig(product);
    if (!variantConfig) return;

    if (type === "size" && variantConfig.sizes) {
        const chosen = variantConfig.sizes[idx];
        if (typeof chosen === "object") {
            pendingOptionSelection.selectedSize = chosen.label || "";
            if (Number(chosen.price) > 0) {
                pendingOptionSelection.currentPrice = Number(chosen.price);
            }
        } else {
            pendingOptionSelection.selectedSize = chosen;
            pendingOptionSelection.currentPrice = Number(product?.price) || pendingOptionSelection.currentPrice;
        }
        const priceEl = document.getElementById("optionModalPrice");
        if (priceEl) priceEl.innerHTML = `${pendingOptionSelection.currentPrice} <span>جنيه</span>`;
        document.querySelectorAll("#optionModalSizePills .option-pill-btn").forEach(b => b.classList.remove("selected"));
    } else if (type === "color" && variantConfig.colors) {
        pendingOptionSelection.selectedColor = variantConfig.colors[idx];
        document.querySelectorAll("#optionModalColorPills .option-pill-btn").forEach(b => b.classList.remove("selected"));
    }
    if (btnEl) btnEl.classList.add("selected");
}

function confirmAddProductWithOptions() {
    const noteVal = (document.getElementById("optionModalNoteInput")?.value || "").trim();
    const { productId, clickedBtnId, selectedSize, selectedColor, selectedImg, currentPrice, qty } = pendingOptionSelection;
    closeProductOptionModal();
    addProductToCartDirect(productId, clickedBtnId, selectedSize, selectedColor, noteVal, selectedImg, currentPrice, qty);
}

function closeProductOptionModal(fromPopState = false) {
    const modal = document.getElementById("productOptionModal");
    if (modal) modal.classList.remove("open");
    pendingOptionSelection.productId = null;
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("optionModal");
}

function onDirectWhatsAppClick(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (product) trackProductInterest(product, 2.5, true);
}

function updateCartItemOption(index, field, value) {
    if (!cart[index]) return;
    cart[index][field] = value;
    cart[index].cartKey = getCartItemKey(cart[index].id, cart[index].size, cart[index].color, cart[index].note, cart[index].img);
    saveCart();
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
    const distinctCount = cart.length;
    const totalPrice = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)), 0);

    const bottomBadge = document.getElementById("bottomCartCount");
    if (bottomBadge) {
        bottomBadge.textContent = totalItems;
        bottomBadge.classList.toggle("visible", totalItems > 0);
    }

    const distinctEl = document.getElementById("cartDistinctCount");
    const piecesEl = document.getElementById("cartTotalPieces");
    if (distinctEl) distinctEl.textContent = distinctCount;
    if (piecesEl) piecesEl.textContent = totalItems;

    document.getElementById("cartTotalAmount").textContent = `${totalPrice} جنيه`;

    const container = document.getElementById("cartItemsContainer");
    if (!cart.length) {
        container.innerHTML = `<div class="cart-empty">سلة المشتريات فارغة حالياً.. أضف أي منتج يعجبك بضغطة واحدة!</div>`;
        return;
    }

    container.innerHTML = cart.map((item, idx) => {
        const product = PRODUCTS.find(p => p.id === item.id);
        const variantConfig = getProductVariantConfig(product);
        const merchantName = item.merchant || product?.merchant || "متجر كارامل";
        const itemImg = normalizeProductImageUrl(item.img) || normalizeProductImageUrl(product?.img) || "";

        let sizeControlHTML = "";
        if (variantConfig && variantConfig.sizes && variantConfig.sizes.length) {
            const sizeLabels = variantConfig.sizes.map(s => typeof s === "object" ? s.label : s);
            const hasCurrent = !item.size || sizeLabels.includes(item.size);
            sizeControlHTML = `
                <select class="cart-option-select" aria-label="المقاس" onchange="updateCartItemOption(${idx}, 'size', this.value)">
                    ${!hasCurrent ? `<option value="${escapeHtmlAttr(item.size)}" selected>المقاس: ${escapeHtmlAttr(item.size)}</option>` : ""}
                    ${variantConfig.sizes.map(sz => {
                        const lbl = typeof sz === "object" ? sz.label : sz;
                        return `<option value="${escapeHtmlAttr(lbl)}" ${item.size === lbl ? "selected" : ""}>المقاس: ${escapeHtmlAttr(lbl)}</option>`;
                    }).join("")}
                </select>
            `;
        } else if (item.size) {
            sizeControlHTML = `<select class="cart-option-select" aria-label="المقاس" onchange="updateCartItemOption(${idx}, 'size', this.value)"><option value="${escapeHtmlAttr(item.size)}" selected>المقاس: ${escapeHtmlAttr(item.size)}</option></select>`;
        }

        let colorControlHTML = "";
        if (variantConfig && variantConfig.colors && variantConfig.colors.length) {
            const hasCurrentColor = !item.color || variantConfig.colors.includes(item.color);
            colorControlHTML = `
                <select class="cart-option-select" aria-label="اللون" onchange="updateCartItemOption(${idx}, 'color', this.value)">
                    ${!hasCurrentColor ? `<option value="${escapeHtmlAttr(item.color)}" selected>اللون: ${escapeHtmlAttr(item.color)}</option>` : ""}
                    ${variantConfig.colors.map(cl => `<option value="${escapeHtmlAttr(cl)}" ${item.color === cl ? "selected" : ""}>اللون: ${escapeHtmlAttr(cl)}</option>`).join("")}
                </select>
            `;
        } else if (item.color) {
            colorControlHTML = `<select class="cart-option-select" aria-label="اللون" onchange="updateCartItemOption(${idx}, 'color', this.value)"><option value="${escapeHtmlAttr(item.color)}" selected>اللون: ${escapeHtmlAttr(item.color)}</option></select>`;
        }

        return `
            <div class="cart-item">
                <div class="cart-item-top">
                    <img src="${escapeHtmlAttr(itemImg)}" alt="${escapeHtmlAttr(item.title)}" onerror="this.style.visibility='hidden'">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${escapeHtmlAttr(item.title)}</div>
                        <div class="cart-item-meta-line">
                            <span class="cart-item-price">${(Number(item.price) || 0) * (Number(item.qty) || 1)} جنيه</span>
                            <span class="cart-item-merchant">• ${escapeHtmlAttr(merchantName)}</span>
                        </div>
                    </div>
                    <div class="qty-controls">
                        <button type="button" class="qty-btn" onclick="changeQty(${idx}, 1)" aria-label="زيادة الكمية">+</button>
                        <span class="qty-val">${item.qty}</span>
                        <button type="button" class="qty-btn" onclick="changeQty(${idx}, -1)" aria-label="تقليل الكمية">-</button>
                        <button type="button" class="remove-item-btn" onclick="removeCartItem(${idx})" aria-label="حذف المنتج">&times;</button>
                    </div>
                </div>
                ${(sizeControlHTML || colorControlHTML) ? `<div class="cart-item-options">${sizeControlHTML}${colorControlHTML}</div>` : ""}
                <input type="text" class="cart-item-note-input" placeholder="ملاحظات إضافية لهذا المنتج (اختياري)..." value="${escapeHtmlAttr(item.note || "")}" oninput="updateCartItemOption(${idx}, 'note', this.value)">
            </div>
        `;
    }).join("");
}

function changeQty(index, delta) {
    if (!cart[index]) return;
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function removeCartItem(index) {
    if (!cart[index]) return;
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function clearCart() {
    cart = [];
    saveCart();
    updateCartUI();
}

function syncBodyScrollLock() {
    const cartOpen = document.getElementById("cartDrawer")?.classList.contains("open");
    const catsOpen = document.getElementById("catsDrawer")?.classList.contains("open");
    const imgOpen = document.getElementById("imageModal")?.classList.contains("open");
    const optOpen = document.getElementById("productOptionModal")?.classList.contains("open");
    const srvOpen = document.getElementById("serviceInfoModal")?.classList.contains("open");
    document.body.style.overflow = (cartOpen || catsOpen || imgOpen || optOpen || srvOpen) ? "hidden" : "";
}

function pushOverlayState(name) {
    if (overlayStack[overlayStack.length - 1] !== name) overlayStack.push(name);
    try { history.pushState({ caramelOverlay: name, ts: Date.now() }, "", window.location.href); } catch (e) {}
}

function removeOverlayState(name) {
    const idx = overlayStack.lastIndexOf(name);
    if (idx !== -1) overlayStack.splice(idx, 1);
}

function closeTopOverlayFromPopState() {
    const top = overlayStack.pop();
    if (top === "cart") closeCart(true);
    else if (top === "cats") closeCategoriesDrawer(true);
    else if (top === "image") closeImageModal(true);
    else if (top === "optionModal") closeProductOptionModal(true);
    else if (top === "serviceInfo") closeServiceInfoModal(true);
    else {
        closeCart(true);
        closeCategoriesDrawer(true);
        closeImageModal(true);
        closeProductOptionModal(true);
        closeServiceInfoModal(true);
    }
}

function closeAllOverlays() {
    overlayStack = [];
    closeCart(true);
    closeCategoriesDrawer(true);
    closeImageModal(true);
    closeProductOptionModal(true);
    closeServiceInfoModal(true);
}

window.addEventListener("popstate", () => { closeTopOverlayFromPopState(); });

function openCart() {
    updateCartUI();
    document.getElementById("cartBackdrop").classList.add("open");
    document.getElementById("cartDrawer").classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("cart");
}

function closeCart(fromPopState = false) {
    document.getElementById("cartBackdrop").classList.remove("open");
    document.getElementById("cartDrawer").classList.remove("open");
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("cart");
}

let customerLocationState = null;

function updateCustomerLocationUI() {
    const btn = document.getElementById("cartLocationBtn");
    const btnText = document.getElementById("cartLocationBtnText");
    const clearBtn = document.getElementById("cartLocationClearBtn");
    const preview = document.getElementById("cartLocationPreview");
    if (!btn || !btnText || !clearBtn || !preview) return;

    if (customerLocationState && customerLocationState.mapsUrl) {
        btn.classList.add("located");
        btnText.textContent = "تم تحديد اللوكيشن بنجاح";
        clearBtn.classList.add("visible");
        preview.style.display = "block";
        preview.textContent = customerLocationState.mapsUrl;
    } else {
        btn.classList.remove("located");
        btnText.textContent = "تحديد موقعي الحالي (اللوكيشن)";
        clearBtn.classList.remove("visible");
        preview.style.display = "none";
        preview.textContent = "";
    }
}

function clearCustomerLocation() {
    customerLocationState = null;
    updateCustomerLocationUI();
}

function requestCustomerLocation() {
    const btnText = document.getElementById("cartLocationBtnText");
    if (!navigator.geolocation) {
        showCaramelToast("المتصفح لا يدعم تحديد الموقع تلقائياً");
        return;
    }
    if (btnText) btnText.textContent = "جاري تحديد موقعك...";
    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = pos.coords.latitude.toFixed(6);
            const lng = pos.coords.longitude.toFixed(6);
            customerLocationState = {
                lat,
                lng,
                mapsUrl: `https://maps.google.com/?q=${lat},${lng}`
            };
            updateCustomerLocationUI();
            showCaramelToast("تم تحديد موقعك بنجاح");
        },
        () => {
            updateCustomerLocationUI();
            showCaramelToast("تعذر الوصول للموقع، تأكد من تفعيل GPS");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

function openWhatsAppChatDirect() {
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}`);
}

function checkoutOnWhatsApp() {
    if (!cart.length) return;
    const nameInput = document.getElementById("checkoutCustomerName");
    const phoneInput = document.getElementById("checkoutCustomerPhone");
    const customerName = (nameInput?.value || "").trim();
    const customerPhone = (phoneInput?.value || "").trim();

    if (!customerName) {
        showCaramelToast("من فضلك اكتب الاسم بالكامل أولاً");
        if (nameInput) nameInput.focus();
        return;
    }
    if (!customerPhone) {
        showCaramelToast("من فضلك اكتب رقم التواصل أولاً");
        if (phoneInput) phoneInput.focus();
        return;
    }

    let total = 0;
    const lines = cart.map((item, idx) => {
        const product = PRODUCTS.find(p => p.id === item.id);
        const merchantName = item.merchant || product?.merchant || "متجر كارامل";
        const itemImg = normalizeProductImageUrl(item.img) || normalizeProductImageUrl(product?.img) || "";
        const itemSubtotal = (Number(item.price) || 0) * (Number(item.qty) || 1);
        total += itemSubtotal;
        const details = [];
        if (item.size) details.push(`المقاس: ${item.size}`);
        if (item.color) details.push(`اللون: ${item.color}`);
        if (item.note) details.push(`ملاحظات: ${item.note}`);
        if (itemImg) details.push(`الصورة المختارة: ${itemImg}`);
        const detailsStr = details.length ? ` (${details.join(" | ")})` : "";
        return `${idx + 1}. ${item.title}${detailsStr} — التاجر: ${merchantName} — العدد: ${item.qty} — السعر: ${itemSubtotal} جنيه`;
    });

    const headerLines = [
        `الاسم: ${customerName}`,
        `رقم التواصل: ${customerPhone}`
    ];
    if (customerLocationState && customerLocationState.mapsUrl) {
        headerLines.push(`اللوكيشن: ${customerLocationState.mapsUrl}`);
    }

    const message = `مرحباً متجر كارامل، أرغب في إتمام الطلب التالي:\n\n${headerLines.join("\n")}\n\n${lines.join("\n")}\n\nالإجمالي الكلي: ${total} جنيه`;
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`);
}

function paintPreviewMedia() {
    const modalImg = document.getElementById("modalImagePreview");
    const prevBtn = document.getElementById("previewPrevBtn");
    const nextBtn = document.getElementById("previewNextBtn");
    const thumbsRow = document.getElementById("previewThumbsRow");
    const imgs = previewModalState.imgs || [];

    if (!imgs.length) return;
    const safeIdx = ((previewModalState.idx % imgs.length) + imgs.length) % imgs.length;
    previewModalState.idx = safeIdx;

    if (modalImg) {
        modalImg.style.opacity = "1";
        modalImg.src = imgs[safeIdx];
    }

    const hasMulti = imgs.length > 1;
    if (prevBtn) prevBtn.style.display = hasMulti ? "inline-flex" : "none";
    if (nextBtn) nextBtn.style.display = hasMulti ? "inline-flex" : "none";

    if (thumbsRow) {
        if (hasMulti) {
            thumbsRow.style.display = "flex";
            thumbsRow.innerHTML = imgs.map((u, i) => `
                <button type="button" class="preview-thumb-btn ${i === safeIdx ? "active" : ""}" onclick="selectPreviewThumb(${i})" aria-label="صورة ${i + 1}">
                    <img src="${escapeHtmlAttr(u)}" alt="صورة ${i + 1}">
                </button>
            `).join("");
        } else {
            thumbsRow.style.display = "none";
            thumbsRow.innerHTML = "";
        }
    }

    const product = PRODUCTS.find(p => p.id === previewModalState.productId);
    if (product) {
        const waBtn = document.getElementById("previewWhatsAppBtn");
        if (waBtn) waBtn.href = buildProductWhatsAppUrl(product, imgs[safeIdx]);
        const addBtn = document.getElementById("previewAddToCartBtn");
        if (addBtn) {
            addBtn.onclick = () => {
                const chosenUrl = imgs[safeIdx];
                closeImageModal();
                openProductOptionModal(product.id, null, chosenUrl);
            };
        }
    }
}

function stepPreviewImage(delta, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!previewModalState.imgs || previewModalState.imgs.length <= 1) return;
    previewModalState.idx += delta;
    paintPreviewMedia();
}

function selectPreviewThumb(idx) {
    previewModalState.idx = Number(idx) || 0;
    paintPreviewMedia();
}

function openImageModal(src, productId = null) {
    const product = productId ? PRODUCTS.find(p => p.id === productId) : null;
    const prodImgs = product ? getProductImagesList(product) : [];
    const normSrc = normalizeProductImageUrl(src);
    const imgs = prodImgs.length ? prodImgs : (normSrc ? [normSrc] : []);
    if (!imgs.length) return;

    const startIdx = normSrc && imgs.indexOf(normSrc) >= 0 ? imgs.indexOf(normSrc) : 0;
    previewModalState = { productId: product ? product.id : null, imgs, idx: startIdx };

    const modal = document.getElementById("imageModal");
    const catChip = document.getElementById("previewCategoryChip");
    const merchantChip = document.getElementById("previewMerchantChip");
    const titleEl = document.getElementById("previewProductTitle");
    const priceEl = document.getElementById("previewMainPrice");
    const subPriceEl = document.getElementById("previewSubPrice");
    const storyEl = document.getElementById("previewStoryText");
    const hookEl = document.getElementById("previewHookNote");

    if (product) {
        trackProductInterest(product, 1.5, true);
        if (catChip) catChip.textContent = CATEGORY_NAMES[product.category] || "متجر كارامل";
        if (merchantChip) merchantChip.textContent = `التاجر: ${product.merchant || "كارامل"}`;
        if (titleEl) titleEl.textContent = product.title;
        if (priceEl) priceEl.innerHTML = `${product.priceLabel || product.price} <span>جنيه</span>`;
        if (subPriceEl) {
            if (product.subPrice) { subPriceEl.style.display = "inline-flex"; subPriceEl.textContent = product.subPrice; }
            else { subPriceEl.style.display = "none"; subPriceEl.textContent = ""; }
        }
        if (storyEl) storyEl.textContent = product.desc || "اختيار مميز بجودة عالية من متجر كارامل يناسب استخدامك اليومي.";
        if (hookEl) hookEl.textContent = buildEngagingHookForProduct(product);
    } else {
        if (catChip) catChip.textContent = "متجر كارامل";
        if (merchantChip) merchantChip.textContent = "التاجر: كارامل";
        if (titleEl) titleEl.textContent = "معاينة المنتج";
        if (priceEl) priceEl.textContent = "";
        if (subPriceEl) subPriceEl.style.display = "none";
        if (storyEl) storyEl.textContent = "منتج مختار بعناية من متجر كارامل.";
        if (hookEl) hookEl.textContent = "";
    }

    paintPreviewMedia();
    modal.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("image");
}

function closeImageModal(fromPopState = false) {
    const modal = document.getElementById("imageModal");
    if (!modal || !modal.classList.contains("open")) return;
    modal.classList.remove("open");
    const modalImg = document.getElementById("modalImagePreview");
    if (modalImg) { modalImg.src = ""; modalImg.style.opacity = "1"; }
    previewModalState = { productId: null, imgs: [], idx: 0 };
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("image");
}

(function initCaramelSplashScreen() {
    const SPLASH_SLOGAN_TEXT = "كل قطعة وليها دور";
    const TYPE_INTERVAL_MS = 52;
    const HOLD_AFTER_TYPING_MS = 280;
    const MIN_SPLASH_MS = 1050;
    const MAX_SPLASH_MS = 2400;
    const startTime = Date.now();
    let dismissed = false, typingTimer = null, holdTimer = null, maxTimer = null, headerSloganTimer = null;

    function replayHeaderSloganEntrance() {
        const headerSlogan = document.querySelector(".logo-sub");
        if (!headerSlogan) return;
        headerSlogan.classList.remove("slogan-reenter", "play");
        void headerSlogan.offsetWidth;
        headerSlogan.classList.add("slogan-reenter");
        headerSloganTimer = setTimeout(() => { headerSlogan.classList.add("play"); }, 90);
    }

    function startSplashSloganTypewriter() {
        const sloganEl = document.getElementById("caramelSplashSlogan");
        const typedEl = document.getElementById("caramelSplashTypedText");
        const caretEl = document.getElementById("caramelSplashCaret");
        if (!sloganEl || !typedEl) return;
        typedEl.textContent = "";
        if (caretEl) caretEl.classList.remove("done");
        sloganEl.classList.remove("descend-in");
        requestAnimationFrame(() => { requestAnimationFrame(() => { sloganEl.classList.add("descend-in"); }); });
        let charIndex = 0;
        function typeNextChar() {
            if (dismissed) return;
            if (charIndex < SPLASH_SLOGAN_TEXT.length) {
                typedEl.textContent += SPLASH_SLOGAN_TEXT.charAt(charIndex);
                charIndex += 1;
                typingTimer = setTimeout(typeNextChar, TYPE_INTERVAL_MS);
            } else {
                if (caretEl) caretEl.classList.add("done");
                holdTimer = setTimeout(() => { hideSplashScreen(); }, HOLD_AFTER_TYPING_MS);
            }
        }
        typingTimer = setTimeout(typeNextChar, 240);
    }

    function hideSplashScreen() {
        if (dismissed) return;
        dismissed = true;
        clearTimeout(typingTimer); clearTimeout(holdTimer); clearTimeout(maxTimer);
        const splash = document.getElementById("caramelSplashScreen");
        if (!splash) { replayHeaderSloganEntrance(); return; }
        splash.classList.add("hide");
        replayHeaderSloganEntrance();
        setTimeout(() => { if (splash && splash.parentNode) splash.parentNode.removeChild(splash); }, 700);
    }

    function scheduleSplashDismiss() {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
        setTimeout(hideSplashScreen, remaining);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startSplashSloganTypewriter, { once: true });
    } else {
        startSplashSloganTypewriter();
    }

    if (document.readyState === "complete") scheduleSplashDismiss();
    else window.addEventListener("load", scheduleSplashDismiss, { once: true });
    maxTimer = setTimeout(hideSplashScreen, MAX_SPLASH_MS);
})();

const PUSH_SUB_STORAGE_KEY = "caramel_push_subscribed_v1";

function setCaramelPushButtonToSubscribed(animate = false) {
    const btn = document.getElementById("caramelPushBtn");
    const iconEl = document.getElementById("caramelPushIcon");
    if (!btn) return;
    btn.classList.add("visible");
    if (iconEl) {
        iconEl.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
    }
    if (animate) {
        btn.classList.add("circle-check-only");
        setTimeout(() => { btn.classList.add("hiding-smooth"); }, 1800);
        setTimeout(() => { btn.classList.remove("visible", "circle-check-only", "hiding-smooth"); }, 2250);
    } else {
        btn.classList.remove("visible", "circle-check-only", "hiding-smooth");
    }
}

function initCaramelPushUI() {
    const btn = document.getElementById("caramelPushBtn");
    if (!btn) return;
    let isSubscribed = false;
    try { isSubscribed = localStorage.getItem(PUSH_SUB_STORAGE_KEY) === "1"; } catch (e) {}
    if (isSubscribed || ("Notification" in window && Notification.permission === "granted")) {
        btn.classList.remove("visible");
        return;
    }
    btn.classList.add("visible");
}

async function enableCaramelPush() {
    if (!("Notification" in window)) {
        showCaramelToast("متصفحك لا يدعم الإشعارات، يمكنك متابعة عروضنا عبر واتساب");
        return;
    }
    try {
        let permission = Notification.permission;
        if (permission === "default") permission = await Notification.requestPermission();
        if (permission !== "granted") {
            showCaramelToast("لم يتم تفعيل الإشعارات.. يمكنك السماح بها من إعدادات المتصفح");
            return;
        }
        try { localStorage.setItem(PUSH_SUB_STORAGE_KEY, "1"); } catch (e) {}
        setCaramelPushButtonToSubscribed(true);
        showCaramelToast("تم تفعيل إشعارات متجر كارامل بنجاح!");
        if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready;
            if (reg && reg.showNotification) {
                reg.showNotification("متجر كارامل - Caramel Store", {
                    body: "تم تفعيل الإشعارات بنجاح! هنبلغك بأحدث المنتجات والعروض أول بأول.",
                    icon: "https://raw.githubusercontent.com/CaramelaSHINStore/Carmela.store/refs/heads/main/compressed_1795355576678.jpeg",
                    badge: "https://raw.githubusercontent.com/CaramelaSHINStore/Carmela.store/refs/heads/main/compressed_1795355576678.jpeg",
                    dir: "rtl",
                    lang: "ar"
                });
            }
        }
    } catch (err) {
        showCaramelToast("حدثت مشكلة أثناء تفعيل الإشعارات، حاول مرة أخرى");
    }
}

initThemeMode();
syncHeaderStickyOffsets();
renderSmartSearchSuggestions();
renderSpotlightBoxes();
renderProducts("all");
hydrateTopQuickTabIcons();
renderSideCategoriesList();
updateCartUI();
initCaramelPushUI();
loadMerchantProductsFromJson();
