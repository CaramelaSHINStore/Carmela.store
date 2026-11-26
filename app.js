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
    const { schemeUrl, intentUrl, apiUrl } = buildWhatsAppDeepLink(url);
    const isAndroid = /Android/i.test(navigator.userAgent || "");

    if (isAndroid) {
        let switchedAway = false;
        const onVisChange = () => {
            if (document.hidden) {
                switchedAway = true;
                document.removeEventListener("visibilitychange", onVisChange);
            }
        };
        document.addEventListener("visibilitychange", onVisChange);

        try {
            window.location.href = intentUrl || schemeUrl;
        } catch (e) {
            try {
                window.location.href = schemeUrl;
            } catch (err) {}
        }

        setTimeout(() => {
            document.removeEventListener("visibilitychange", onVisChange);
            if (!switchedAway && document.visibilityState === "visible") {
                try {
                    const win = window.open(apiUrl, "_blank", "noopener,noreferrer");
                    if (!win) window.location.href = apiUrl;
                } catch (e) {
                    window.location.href = apiUrl;
                }
            }
        }, 1600);
        return;
    }

    try {
        const win = window.open(apiUrl, "_blank", "noopener,noreferrer");
        if (!win) window.location.href = apiUrl;
    } catch (e) {
        window.location.href = apiUrl;
    }
}

const STORE_URL = "https://caramelstoresuez.github.io/Carmelastore/";
const CART_STORAGE_KEY = "caramel_store_cart_v1";
const ACTIVE_ORDERS_STORAGE_KEY = "caramel_active_orders_v1";
const RECEIVED_ORDERS_STORAGE_KEY = "caramel_received_orders_v1";
const INTEREST_STORAGE_KEY = "caramel_smart_interest_v1";
const THEME_STORAGE_KEY = "caramel_store_theme_mode_v1";
const CUSTOMER_PROFILE_KEY = "caramel_customer_profile_v1";
const SEARCH_HISTORY_KEY = "caramel_search_history_v1";
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
let searchDebounceTimer = null;
let isAppendingBatch = false;
let currentFeedMode = "for-you";
let currentSortMode = "smart";
let isLoadingJsonProducts = true;
let appendTargetOrderId = null;
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

function createDebounced(fn, delay = 180) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function formatPriceNumber(priceOrLabel) {
    if (typeof priceOrLabel === "string" && /[a-zA-Z\u0600-\u06FF]/.test(priceOrLabel)) {
        return priceOrLabel.trim();
    }
    const num = Number(priceOrLabel) || 0;
    return num.toLocaleString("ar-EG");
}

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
    setTimeout(syncHeaderStickyOffsets, 200);
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
        launchWhatsAppTarget(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
    }
}

(function initServiceWorkerQuietly() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", async () => {
        try {
            const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" });
            if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
            reg.update().catch(() => {});
            setInterval(() => {
                reg.update().catch(() => {});
            }, 300000);
            reg.addEventListener("updatefound", () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener("statechange", () => {
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                        newWorker.postMessage({ type: "SKIP_WAITING" });
                    }
                });
            });
        } catch (e) {}
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
    updateCartUI();
    applyUrlDeepLinkParams();
}

function applyUrlDeepLinkParams() {
    try {
        const params = new URLSearchParams(window.location.search || "");
        const merchantParam = (params.get("merchant") || "").trim();
        const productParam = (params.get("product") || "").trim();
        const catParam = (params.get("category") || "").trim();

        if (merchantParam) {
            filterByMerchant(merchantParam, true);
        } else if (catParam && CATEGORY_NAMES[catParam]) {
            const tabEl = document.querySelector(`.quick-top-tabs .quick-tab-item[data-quick="${catParam}"]`);
            filterByCategory(catParam, tabEl || null, true);
        }

        if (productParam && PRODUCTS.length) {
            const found = PRODUCTS.find(p => String(p.id) === productParam);
            if (found) {
                setTimeout(() => openImageModal(found.img, found.id), 350);
            }
        }
    } catch (e) {}
}

let currentCategory = "all";
let currentMerchant = "";
let currentMaxPrice = 0;

function setPriceFilter(maxPrice) {
    currentMaxPrice = Number(maxPrice) || 0;
    renderProducts(currentCategory);
    scrollToProductsTop();
}

function setSortMode(mode) {
    currentSortMode = mode || "smart";
    renderProducts(currentCategory);
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

function getSavedSearchHistory() {
    try {
        const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.filter(Boolean).slice(0, 4) : [];
    } catch (e) {
        return [];
    }
}

function saveSearchTermToHistory(term) {
    const clean = String(term || "").trim();
    if (clean.length < 2) return;
    try {
        const existing = getSavedSearchHistory().filter(t => normalizeText(t) !== normalizeText(clean));
        const next = [clean, ...existing].slice(0, 4);
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    } catch (e) {}
}

function renderSmartSearchSuggestions() {
    const container = document.getElementById("smartSearchSuggestions");
    if (!container) return;

    const recent = getSavedSearchHistory();
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
        .filter(w => !defaults.some(d => normalizeText(d) === w) && !recent.some(r => normalizeText(r) === w));

    const chips = [
        ...recent.map(term => ({ label: `🕒 ${term}`, term })),
        ...[...defaults, ...dynamicChips.slice(0, 4)].map(term => ({ label: term, term }))
    ];

    container.innerHTML = chips.map(item =>
        `<button type="button" class="search-suggest-chip" onclick="applyQuickSearch('${escapeHtmlAttr(item.term)}')">${escapeHtmlAttr(item.label)}</button>`
    ).join("");
}

function applyQuickSearch(term) {
    const input = document.getElementById("homeSearchInput");
    if (!input) return;
    input.value = term;
    saveSearchTermToHistory(term);
    renderSmartSearchSuggestions();
    performSearchRender();
    scrollToProductsTop();
}

function shareCurrentMerchantPage() {
    if (!currentMerchant) return;
    const shareUrl = `${STORE_URL}?merchant=${encodeURIComponent(currentMerchant)}`;
    const shareText = `تصفح تشكيلة منتجات "${currentMerchant}" في متجر كارامل:\n${shareUrl}`;
    if (navigator.share) {
        navigator.share({ title: `${currentMerchant} - متجر كارامل`, text: shareText, url: shareUrl }).catch(() => {});
    } else {
        launchWhatsAppTarget(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
    }
}

let currentFeedItems = [];
let renderedCount = 0;
let feedCycle = 0;
let continuationItems = [];
let continuationBatchIndex = 0;
let continuationCursor = 0;
let cart = [];
let activeOrders = [];
let receivedOrders = [];
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

function loadActiveOrdersFromStorage() {
    try {
        const raw = localStorage.getItem(ACTIVE_ORDERS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(o => o && o.orderId) : [];
    } catch (e) { return []; }
}

function saveActiveOrders() {
    try {
        localStorage.setItem(ACTIVE_ORDERS_STORAGE_KEY, JSON.stringify(activeOrders));
    } catch (e) {}
}

function loadReceivedOrdersFromStorage() {
    try {
        const raw = localStorage.getItem(RECEIVED_ORDERS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(o => o && o.orderId) : [];
    } catch (e) { return []; }
}

function saveReceivedOrders() {
    try {
        localStorage.setItem(RECEIVED_ORDERS_STORAGE_KEY, JSON.stringify(receivedOrders));
    } catch (e) {}
}

cart = loadCartFromStorage();
activeOrders = loadActiveOrdersFromStorage();
receivedOrders = loadReceivedOrdersFromStorage();

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

function loadCustomerProfileToInputs() {
    try {
        const raw = localStorage.getItem(CUSTOMER_PROFILE_KEY);
        if (!raw) return;
        const prof = JSON.parse(raw);
        const nameEl = document.getElementById("checkoutCustomerName");
        const phoneEl = document.getElementById("checkoutCustomerPhone");
        if (nameEl && prof.name && !nameEl.value) nameEl.value = prof.name;
        if (phoneEl && prof.phone && !phoneEl.value) phoneEl.value = prof.phone;
    } catch (e) {}
}

function saveCustomerProfileInputs(name, phone) {
    try {
        localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify({
            name: String(name || "").trim(),
            phone: String(phone || "").trim()
        }));
    } catch (e) {}
}

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
        let matchedWord = "";

        for (const qt of qTokens) {
            const variants = expandTermVariants(qt);
            for (const v of variants) {
                const prefixMatch = tWords.find(w => w.startsWith(v) || v.startsWith(w));
                if (prefixMatch) {
                    score += 3;
                    if (!matchedWord) matchedWord = prefixMatch;
                    break;
                }
                const fuzzyMatch = tWords.find(w => w.length >= 3 && v.length >= 3 && boundedLevenshtein(v, w, 2) <= 2);
                if (fuzzyMatch) {
                    score += 2;
                    if (!matchedWord) matchedWord = fuzzyMatch;
                    break;
                }
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestCandidate = matchedWord || tWords[0] || title;
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

function performSearchRender() {
    updateSearchCancelButton();
    const val = document.getElementById("homeSearchInput")?.value || "";
    const tokens = extractTokens(val).filter(t => t.length >= 2);
    if (tokens.length > 0) {
        tokens.forEach(token => { interestData.keywords[token] = (interestData.keywords[token] || 0) + 0.5; });
        saveInterest();
    }
    renderProducts(currentCategory);
}

const debouncedSearchRender = createDebounced(performSearchRender, 170);

function handleSearchInput() {
    updateSearchCancelButton();
    debouncedSearchRender();
}

function handleSearchKeyDown(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        const val = (document.getElementById("homeSearchInput")?.value || "").trim();
        if (val.length >= 2) {
            saveSearchTermToHistory(val);
            renderSmartSearchSuggestions();
        }
        performSearchRender();
        scrollToProductsTop();
    } else if (event.key === "Escape") {
        event.preventDefault();
        cancelSearchMode();
    }
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
        container.innerHTML = `<div class="visual-motion-card spotlight-empty-card">${isLoadingJsonProducts ? "جاري التحميل..." : "لا توجد منتجات"}</div>`;
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
    const displayPrice = formatPriceNumber(p.priceLabel || p.price);
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
    const ordered = interleaveMerchantsSmartly(shuffleArray(pool));
    const wave = [];
    for (let i = 0; i < Math.min(limit, ordered.length); i++) {
        wave.push(ordered[(continuationCursor + i) % ordered.length]);
    }
    continuationCursor = (continuationCursor + limit) % Math.max(1, ordered.length);
    return wave;
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
        continuationCursor = 0;
        container.innerHTML = "";
        return;
    }
    continuationBatchIndex = 0;
    continuationCursor = 0;
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
    return "";
}

function buildSkeletonGridHTML(count = 8) {
    return Array.from({ length: count }, () => `
        <div class="product-card skeleton-card" aria-hidden="true">
            <div class="product-img-box skeleton-shimmer"></div>
            <div class="product-details">
                <div class="skeleton-line skeleton-shimmer w-82 h-14"></div>
                <div class="skeleton-line skeleton-shimmer w-45 h-18 mt-6"></div>
                <div class="skeleton-line skeleton-shimmer w-65 h-12 mt-6"></div>
                <div class="skeleton-line skeleton-shimmer w-100 h-34 mt-10 rounded-12"></div>
            </div>
        </div>
    `).join("");
}

function buildProductCardHTML(product, instanceTag = "base") {
    const displayPrice = formatPriceNumber(product.priceLabel || product.price);
    const merchantName = product.merchant || "متجر كارامل";
    const imgs = getProductImagesList(product);
    const imgSrc = imgs[0] || "";
    const hasMultiImgs = imgs.length > 1;
    const waUrl = buildProductWhatsAppUrl(product, imgSrc);
    const btnId = `btn-${instanceTag}-${product.id}`;
    const addLabel = appendTargetOrderId ? "+ للطلب الحالي" : "+ للمشتريات";

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
                        <span>${addLabel}</span>
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

    if (currentSortMode === "price-asc") {
        return [...list].sort((a, b) => (Number(a.price) || 999999) - (Number(b.price) || 999999));
    }
    if (currentSortMode === "price-desc") {
        return [...list].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
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
    return base.map(product => ({ type: "product", product, tag: "p0" }));
}

function appendContinuationWave(category, rawQuery) {
    const sourcePool = getFilteredProducts(category, rawQuery);
    if (sourcePool.length === 0) return;
    feedCycle += 1;
    const waveSorted = currentFeedMode === "for-you" ? interleaveMerchantsSmartly(shuffleArray(sourcePool)) : sourcePool;
    const waveItems = waveSorted.map(product => ({ type: "product", product, tag: `w${feedCycle}` }));
    currentFeedItems.push(...waveItems);
}

function renderMoreFeedItems() {
    if (isAppendingBatch) return;
    isAppendingBatch = true;
    try {
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
    } finally {
        isAppendingBatch = false;
    }
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
            grid.innerHTML = buildSkeletonGridHTML(8);
            return;
        }

        const suggestionTerm = trimmedQuery ? getSmartQuerySuggestion(trimmedQuery) : "";
        const emptyMsg = trimmedQuery
            ? `ملقيناش نتيجة مطابقة لـ "${trimmedQuery}".. جرّب كلمة بحث أخرى أو تواصل معنا.`
            : (!PRODUCTS.length
                ? "لم يتم العثور على منتجات صالحة داخل ملفات الـ JSON حالياً."
                : "لا توجد منتجات مطابقة للتصفية الحالية.. جرّب قسماً آخر أو تواصل معنا.");

        const suggestionBtnHtml = suggestionTerm
            ? `<button type="button" class="add-cart-btn max-w-240" onclick="applyQuickSearch('${escapeHtmlAttr(suggestionTerm)}')">هل تقصد: ${escapeHtmlAttr(suggestionTerm)}؟</button>`
            : "";

        grid.innerHTML = `
            <div class="empty-state-box">
                <p class="empty-state-msg">${escapeHtmlAttr(emptyMsg)}</p>
                <div class="empty-state-actions">
                    ${suggestionBtnHtml}
                    <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("أريد طلب منتج: " + (trimmedQuery || "منتج خاص"))}" class="add-cart-btn max-w-240" target="_blank" rel="noopener noreferrer" onclick="event.preventDefault(); launchWhatsAppTarget(this.href);">اطلب المنتج على واتساب</a>
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

const feedSentinelEl = document.getElementById("feedSentinel");
if (feedSentinelEl && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) renderMoreFeedItems();
        });
    }, { rootMargin: "260px" });
    observer.observe(feedSentinelEl);
}

function filterByCategory(category, tabEl, shouldScroll = false) {
    currentMerchant = "";
    currentMaxPrice = 0;
    const input = document.getElementById("homeSearchInput");
    if (input) input.value = "";
    updateSearchCancelButton();
    if (category && category !== "all") interestData.categories[category] = (interestData.categories[category] || 0) + 1.5;
    saveInterest();
    if (tabEl) {
        document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(item => item.classList.remove("active"));
        tabEl.classList.add("active");
    }
    renderProducts(category);
    if (shouldScroll) scrollToProductsTop();
}

function resetHomeFresh() {
    closeAllOverlays();
    currentMerchant = "";
    currentCategory = "all";
    currentMaxPrice = 0;
    currentSortMode = "smart";
    const sortSel = document.getElementById("productsSortSelect");
    if (sortSel) sortSel.value = "smart";
    applyCategoryPageMood("all");
    const input = document.getElementById("homeSearchInput");
    if (input) input.value = "";
    updateSearchCancelButton();
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-quick") === "all");
    });
    renderProducts("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToProductsTop() {
    const heading = document.getElementById("productsSectionHeading");
    if (!heading) return;
    const rect = heading.getBoundingClientRect();
    const headerHeight = document.querySelector(".top-app-bar")?.offsetHeight || 70;
    window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - headerHeight - 54), behavior: "smooth" });
}

function pulseBottomNavButton(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.remove("pop");
    void btn.offsetWidth;
    btn.classList.add("pop");
}

function syncBodyScrollLock() {
    const anyOpen = Boolean(
        document.getElementById("cartDrawer")?.classList.contains("open") ||
        document.getElementById("catsDrawer")?.classList.contains("open") ||
        document.getElementById("imageModal")?.classList.contains("open") ||
        document.getElementById("productOptionModal")?.classList.contains("open") ||
        document.getElementById("serviceInfoModal")?.classList.contains("open")
    );
    document.body.style.overflow = anyOpen ? "hidden" : "";
}

function pushOverlayState(name) {
    if (!window.history || !window.history.pushState) return;
    if (overlayStack[overlayStack.length - 1] !== name) {
        overlayStack.push(name);
        try { window.history.pushState({ caramelOverlay: name }, "", window.location.href); } catch (e) {}
    }
}

function removeOverlayState(name) {
    const idx = overlayStack.lastIndexOf(name);
    if (idx !== -1) overlayStack.splice(idx, 1);
}

function closeTopOverlayFromPopState() {
    const top = overlayStack.pop();
    if (!top) return;
    if (top === "cart") closeCart(true);
    else if (top === "cats") closeCategoriesDrawer(true);
    else if (top === "image") closeImageModal(true);
    else if (top === "option") closeProductOptionModal(true);
    else if (top === "serviceInfo") closeServiceInfoModal(true);
}

window.addEventListener("popstate", () => {
    if (overlayStack.length > 0) closeTopOverlayFromPopState();
});

function closeAllOverlays() {
    closeCart(true);
    closeCategoriesDrawer(true);
    closeImageModal(true);
    closeProductOptionModal(true);
    closeServiceInfoModal(true);
    overlayStack = [];
    syncBodyScrollLock();
}

function getOptionVariantPrice(product, rawSizeValue, fallbackPrice) {
    const baseP = Number(fallbackPrice) || Number(product?.price) || 0;
    if (!rawSizeValue) return baseP;
    const config = getProductVariantConfig(product);
    if (config && Array.isArray(config.sizes)) {
        const matchedObj = config.sizes.find(s => typeof s === "object" && s !== null && s.label === rawSizeValue);
        if (matchedObj && Number(matchedObj.price) > 0) return Number(matchedObj.price);
    }
    const m = String(rawSizeValue).match(/(\d+(?:\.\d+)?)\s*(?:جنيه|\bج\b|egp)/i);
    if (m) {
        const parsed = parseNumericPrice(m[1]);
        if (parsed > 0) return parsed;
    }
    return baseP;
}

function refreshOptionModalPriceDisplay() {
    const product = PRODUCTS.find(p => p.id === pendingOptionSelection.productId);
    const priceEl = document.getElementById("optionModalPrice");
    if (!product || !priceEl) return;
    const unitPrice = getOptionVariantPrice(product, pendingOptionSelection.selectedSize, product.price);
    pendingOptionSelection.currentPrice = unitPrice;
    const totalLine = unitPrice * (pendingOptionSelection.qty || 1);
    priceEl.innerHTML = (pendingOptionSelection.qty || 1) > 1
        ? `${formatPriceNumber(totalLine)} <span>جنيه (${formatPriceNumber(unitPrice)} للقطعة)</span>`
        : `${formatPriceNumber(unitPrice)} <span>جنيه</span>`;
}

function changeModalQty(delta) {
    const nextQty = Math.max(1, (pendingOptionSelection.qty || 1) + delta);
    pendingOptionSelection.qty = nextQty;
    const valEl = document.getElementById("optionModalQtyVal");
    if (valEl) valEl.textContent = String(nextQty);
    refreshOptionModalPriceDisplay();
}

function openProductOptionModal(productId, clickedBtnId = null, preferredImgSrc = "") {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById("productOptionModal");
    const imgEl = document.getElementById("optionModalImg");
    const titleEl = document.getElementById("optionModalTitle");
    const priceEl = document.getElementById("optionModalPrice");
    const thumbsRow = document.getElementById("optionModalThumbsRow");
    const qtyValEl = document.getElementById("optionModalQtyVal");
    const sizeGroup = document.getElementById("optionModalSizeGroup");
    const sizePills = document.getElementById("optionModalSizePills");
    const colorGroup = document.getElementById("optionModalColorGroup");
    const colorPills = document.getElementById("optionModalColorPills");
    const noteInput = document.getElementById("optionModalNoteInput");
    const confirmBtn = document.getElementById("optionModalConfirmBtn");

    const variantConfig = getProductVariantConfig(product);
    const sizes = (variantConfig && variantConfig.sizes) ? variantConfig.sizes : [];
    const colors = (variantConfig && variantConfig.colors) ? variantConfig.colors : [];
    const imgs = getProductImagesList(product);
    const initialImg = normalizeProductImageUrl(preferredImgSrc) || (imgs[0] || "");

    const defaultSize = sizes.length ? (typeof sizes[0] === "string" ? sizes[0] : sizes[0].label) : "";
    const defaultColor = colors.length ? colors[0] : "";
    const initialUnitPrice = getOptionVariantPrice(product, defaultSize, product.price);

    pendingOptionSelection = {
        productId,
        clickedBtnId,
        selectedSize: defaultSize,
        selectedColor: defaultColor,
        selectedImg: initialImg,
        currentPrice: initialUnitPrice,
        qty: 1
    };

    if (qtyValEl) qtyValEl.textContent = "1";
    if (imgEl) { imgEl.classList.remove("img-hidden"); imgEl.src = initialImg; imgEl.alt = product.title; }

    if (thumbsRow) {
        if (imgs.length > 1) {
            thumbsRow.classList.remove("is-hidden");
            thumbsRow.innerHTML = imgs.map((u, idx) => `
                <button type="button" class="preview-thumb-btn ${u === initialImg ? "active" : ""}" onclick="selectOptionModalImage('${escapeHtmlAttr(u)}', this)">
                    <img src="${escapeHtmlAttr(u)}" alt="${escapeHtmlAttr(product.title)} ${idx + 1}">
                </button>
            `).join("");
        } else {
            thumbsRow.classList.add("is-hidden");
            thumbsRow.innerHTML = "";
        }
    }

    if (titleEl) titleEl.textContent = `${product.title} — التاجر: ${product.merchant || "متجر كارامل"}`;
    if (priceEl) priceEl.innerHTML = `${formatPriceNumber(initialUnitPrice)} <span>جنيه</span>`;
    if (noteInput) noteInput.value = "";
    if (confirmBtn) {
        confirmBtn.textContent = appendTargetOrderId ? "إضافة للطلب قيد التنفيذ" : "تأكيد وإضافة للسلة";
    }

    if (sizeGroup && sizePills) {
        if (sizes.length) {
            sizeGroup.classList.remove("is-hidden");
            sizePills.innerHTML = sizes.map((s, idx) => {
                const sLabel = typeof s === "string" ? s : s.label;
                return `<button type="button" class="option-pill-btn ${idx === 0 ? "selected" : ""}" onclick="selectOptionPill('size', this, '${escapeHtmlAttr(sLabel)}')">${escapeHtmlAttr(sLabel)}</button>`;
            }).join("");
        } else {
            sizeGroup.classList.add("is-hidden");
            sizePills.innerHTML = "";
        }
    }

    if (colorGroup && colorPills) {
        if (colors.length) {
            colorGroup.classList.remove("is-hidden");
            colorPills.innerHTML = colors.map((c, idx) => `<button type="button" class="option-pill-btn ${idx === 0 ? "selected" : ""}" onclick="selectOptionPill('color', this, '${escapeHtmlAttr(c)}')">${escapeHtmlAttr(c)}</button>`).join("");
        } else {
            colorGroup.classList.add("is-hidden");
            colorPills.innerHTML = "";
        }
    }

    if (modal) { modal.classList.add("open"); syncBodyScrollLock(); pushOverlayState("option"); }
}

function selectOptionModalImage(imgUrl, btnEl) {
    const cleanUrl = normalizeProductImageUrl(imgUrl);
    pendingOptionSelection.selectedImg = cleanUrl;
    const imgEl = document.getElementById("optionModalImg");
    if (imgEl && cleanUrl) { imgEl.classList.remove("img-hidden"); imgEl.src = cleanUrl; }
    document.querySelectorAll("#optionModalThumbsRow .preview-thumb-btn").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
}

function selectOptionPill(kind, btnEl, value) {
    const parent = btnEl?.parentElement;
    if (parent) parent.querySelectorAll(".option-pill-btn").forEach(b => b.classList.remove("selected"));
    if (btnEl) btnEl.classList.add("selected");
    if (kind === "size") {
        pendingOptionSelection.selectedSize = value;
        refreshOptionModalPriceDisplay();
    } else if (kind === "color") {
        pendingOptionSelection.selectedColor = value;
    }
}

function closeProductOptionModal(fromPopState = false) {
    const modal = document.getElementById("productOptionModal");
    if (modal) modal.classList.remove("open");
    pendingOptionSelection.productId = null;
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("option");
}

function buildLineItemFromProduct(product, options = {}) {
    const variantConfig = getProductVariantConfig(product);
    const availableSizes = (variantConfig && variantConfig.sizes) ? variantConfig.sizes : [];
    const availableColors = (variantConfig && variantConfig.colors) ? variantConfig.colors : [];
    const defaultSize = availableSizes.length ? (typeof availableSizes[0] === "string" ? availableSizes[0] : availableSizes[0].label) : "";
    const chosenSize = options.selectedSize || defaultSize;
    const chosenColor = options.selectedColor || (availableColors[0] || "");
    const chosenNote = (options.customNote || "").trim();
    const imgs = getProductImagesList(product);
    const chosenImg = normalizeProductImageUrl(options.selectedImg) || (imgs[0] || "");
    const addQty = Math.max(1, Number(options.qty) || 1);
    const effectiveUnitPrice = Number(options.customPrice) > 0
        ? Number(options.customPrice)
        : getOptionVariantPrice(product, chosenSize, product.price);

    return {
        id: product.id,
        title: product.title,
        price: effectiveUnitPrice,
        img: chosenImg,
        selectedImg: chosenImg,
        merchant: product.merchant || "متجر كارامل",
        qty: addQty,
        selectedSize: chosenSize,
        selectedColor: chosenColor,
        customNote: chosenNote
    };
}

function mergeLineItemIntoList(list, newItem) {
    const existingIndex = list.findIndex(item =>
        item.id === newItem.id &&
        (item.selectedSize || "") === (newItem.selectedSize || "") &&
        (item.selectedColor || "") === (newItem.selectedColor || "") &&
        (item.customNote || "") === (newItem.customNote || "") &&
        (item.selectedImg || "") === (newItem.selectedImg || "") &&
        (Number(item.price) || 0) === (Number(newItem.price) || 0)
    );
    if (existingIndex > -1) {
        list[existingIndex].qty += newItem.qty;
    } else {
        list.push(newItem);
    }
}

function confirmAddProductWithOptions() {
    const { productId, clickedBtnId, selectedSize, selectedColor, selectedImg, currentPrice, qty } = pendingOptionSelection;
    if (!productId) return;
    const noteVal = (document.getElementById("optionModalNoteInput")?.value || "").trim();
    const product = PRODUCTS.find(p => p.id === productId);
    const finalUnitPrice = currentPrice > 0 ? currentPrice : (Number(product?.price) || 0);
    closeProductOptionModal();
    addToCart(productId, clickedBtnId, {
        selectedSize,
        selectedColor,
        customNote: noteVal,
        selectedImg,
        customPrice: finalUnitPrice,
        qty: qty || 1
    });
}

function addToCart(productId, btnId = null, options = {}) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;
    trackProductInterest(product, 2, true);

    const newItem = buildLineItemFromProduct(product, options);

    if (appendTargetOrderId) {
        const targetOrder = activeOrders.find(o => o.orderId === appendTargetOrderId && o.status === "pending");
        if (targetOrder) {
            mergeLineItemIntoList(targetOrder.items, newItem);
            targetOrder.updatedAt = new Date().toISOString();
            saveActiveOrders();
            updateCartUI();
            pulseBottomNavButton("navCartBtn");
            showCaramelToast(`تمت إضافة "${product.title}" للطلب ${targetOrder.orderId}`);
            if (btnId) {
                const btn = document.getElementById(btnId);
                if (btn) {
                    const orig = btn.innerHTML;
                    btn.classList.add("added");
                    btn.innerHTML = "<span>✓ أُضيف للطلب</span>";
                    setTimeout(() => { btn.classList.remove("added"); btn.innerHTML = orig; }, 1100);
                }
            }
            return;
        } else {
            appendTargetOrderId = null;
            updateAppendOrderBannerUI();
        }
    }

    mergeLineItemIntoList(cart, newItem);
    saveCart();
    updateCartUI();
    pulseBottomNavButton("navCartBtn");
    showCaramelToast(`تمت إضافة "${product.title}" (${newItem.qty} قطعة) للمشتريات`);

    if (btnId) {
        const btn = document.getElementById(btnId);
        if (btn) {
            const orig = btn.innerHTML;
            btn.classList.add("added");
            btn.innerHTML = "<span>✓ تمت الإضافة</span>";
            setTimeout(() => { btn.classList.remove("added"); btn.innerHTML = orig; }, 1100);
        }
    }
}

function onDirectWhatsAppClick(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (product) trackProductInterest(product, 2.5, true);
}

function updateCartItemOption(index, field, value) {
    if (!cart[index]) return;
    cart[index][field] = value;
    if (field === "selectedSize") {
        const product = PRODUCTS.find(p => p.id === cart[index].id);
        if (product) {
            cart[index].price = getOptionVariantPrice(product, value, product.price);
        }
    }
    saveCart();
    updateCartUI();
}

function updateCartUI() {
    const cartPieces = cart.reduce((sum, item) => sum + item.qty, 0);
    const cartAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const pendingOrdersList = activeOrders.filter(o => o.status === "pending");

    const bottomBadge = document.getElementById("bottomCartCount");
    const badgeTotal = cartPieces + pendingOrdersList.length;
    if (bottomBadge) {
        bottomBadge.textContent = badgeTotal;
        bottomBadge.classList.toggle("visible", badgeTotal > 0);
    }

    const distinctEl = document.getElementById("cartDistinctCount");
    const piecesEl = document.getElementById("cartTotalPieces");
    const totalAmountEl = document.getElementById("cartTotalAmount");
    if (distinctEl) distinctEl.textContent = cart.length;
    if (piecesEl) piecesEl.textContent = cartPieces;
    if (totalAmountEl) totalAmountEl.textContent = `${formatPriceNumber(cartAmount)} جنيه`;

    const container = document.getElementById("cartItemsContainer");
    if (container) {
        if (cart.length === 0) {
            container.innerHTML = `<div class="cart-empty">سلة المشتريات الحالية فارغة — أضف أي منتج أو راجع طلباتك قيد التنفيذ بالأسفل.</div>`;
        } else {
            container.innerHTML = cart.map((item, idx) => {
                const product = PRODUCTS.find(p => p.id === item.id);
                const variantConfig = getProductVariantConfig(product);
                const sizes = (variantConfig && variantConfig.sizes) ? variantConfig.sizes : [];
                const colors = (variantConfig && variantConfig.colors) ? variantConfig.colors : [];
                const itemImg = normalizeProductImageUrl(item.selectedImg || item.img) || (product?.img || "");

                const sizeSelectHTML = sizes.length ? `
                    <select class="cart-option-select" onchange="updateCartItemOption(${idx}, 'selectedSize', this.value)" aria-label="المقاس">
                        ${sizes.map(s => {
                            const sLabel = typeof s === "string" ? s : s.label;
                            return `<option value="${escapeHtmlAttr(sLabel)}" ${item.selectedSize === sLabel ? "selected" : ""}>المقاس: ${escapeHtmlAttr(sLabel)}</option>`;
                        }).join("")}
                    </select>
                ` : "";

                const colorSelectHTML = colors.length ? `
                    <select class="cart-option-select" onchange="updateCartItemOption(${idx}, 'selectedColor', this.value)" aria-label="اللون">
                        ${colors.map(c => `<option value="${escapeHtmlAttr(c)}" ${item.selectedColor === c ? "selected" : ""}>اللون: ${escapeHtmlAttr(c)}</option>`).join("")}
                    </select>
                ` : "";

                return `
                    <div class="cart-item">
                        <div class="cart-item-top">
                            <img src="${escapeHtmlAttr(itemImg)}" alt="${escapeHtmlAttr(item.title)}" onerror="handleProductImageError(this, '${escapeHtmlAttr(item.id)}')">
                            <div class="cart-item-info">
                                <div class="cart-item-title">${escapeHtmlAttr(item.title)}</div>
                                <div class="cart-item-meta-line">
                                    <span class="cart-item-price">${formatPriceNumber(item.price * item.qty)} جنيه</span>
                                    <span class="cart-item-merchant">• ${escapeHtmlAttr(item.merchant || "متجر كارامل")}</span>
                                </div>
                            </div>
                            <div class="qty-controls">
                                <button type="button" class="qty-btn" onclick="changeCartQty(${idx}, 1)">+</button>
                                <span class="qty-val">${item.qty}</span>
                                <button type="button" class="qty-btn" onclick="changeCartQty(${idx}, -1)">-</button>
                                <button type="button" class="remove-item-btn" onclick="removeCartItem(${idx})" aria-label="حذف">✕</button>
                            </div>
                        </div>
                        ${(sizeSelectHTML || colorSelectHTML) ? `<div class="cart-item-options">${sizeSelectHTML}${colorSelectHTML}</div>` : ""}
                        <input type="text" class="cart-item-note-input" value="${escapeHtmlAttr(item.customNote || "")}" placeholder="تفاصيل إضافية لهذه القطعة (اختياري)..." onchange="updateCartItemOption(${idx}, 'customNote', this.value)">
                    </div>
                `;
            }).join("");
        }
    }

    renderActiveOrdersInCart();
    renderReceivedOrdersInCart();
    updateAppendOrderBannerUI();
}

function renderActiveOrdersInCart() {
    const ordersContainer = document.getElementById("activeOrdersContainer");
    const countBadge = document.getElementById("activeOrdersCountBadge");
    if (!ordersContainer) return;

    const visibleOrders = activeOrders.filter(o => o && o.status === "pending");
    if (countBadge) countBadge.textContent = String(visibleOrders.length);

    if (!visibleOrders.length) {
        ordersContainer.innerHTML = `<div class="active-orders-empty">لا توجد طلبات قيد التنفيذ حالياً. أي طلب ترسله سيظهر هنا لتعديله أو الإضافة عليه أو إلغائه.</div>`;
        return;
    }

    ordersContainer.innerHTML = visibleOrders.map(order => {
        const orderTotal = (order.items || []).reduce((sum, it) => sum + ((Number(it.price) || 0) * (Number(it.qty) || 1)), 0);
        const orderPieces = (order.items || []).reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
        const isAppendingThis = appendTargetOrderId === order.orderId;

        const itemsHtml = (order.items || []).map((item, itemIdx) => {
            const product = PRODUCTS.find(p => p.id === item.id);
            const variantConfig = getProductVariantConfig(product);
            const sizes = (variantConfig && variantConfig.sizes) ? variantConfig.sizes : [];
            const colors = (variantConfig && variantConfig.colors) ? variantConfig.colors : [];
            const itemImg = normalizeProductImageUrl(item.selectedImg || item.img) || (product?.img || "");

            const sizeSel = sizes.length ? `
                <select class="cart-option-select" onchange="updateOrderItemOption('${escapeHtmlAttr(order.orderId)}', ${itemIdx}, 'selectedSize', this.value)">
                    ${sizes.map(s => {
                        const sLabel = typeof s === "string" ? s : s.label;
                        return `<option value="${escapeHtmlAttr(sLabel)}" ${item.selectedSize === sLabel ? "selected" : ""}>المقاس: ${escapeHtmlAttr(sLabel)}</option>`;
                    }).join("")}
                </select>
            ` : "";

            const colSel = colors.length ? `
                <select class="cart-option-select" onchange="updateOrderItemOption('${escapeHtmlAttr(order.orderId)}', ${itemIdx}, 'selectedColor', this.value)">
                    ${colors.map(c => `<option value="${escapeHtmlAttr(c)}" ${item.selectedColor === c ? "selected" : ""}>اللون: ${escapeHtmlAttr(c)}</option>`).join("")}
                </select>
            ` : "";

            return `
                <div class="active-order-item">
                    <div class="active-order-item-row">
                        <img src="${escapeHtmlAttr(itemImg)}" alt="${escapeHtmlAttr(item.title)}" onerror="handleProductImageError(this, '${escapeHtmlAttr(item.id)}')">
                        <div class="active-order-item-meta">
                            <div class="cart-item-title">${escapeHtmlAttr(item.title)}</div>
                            <div class="cart-item-price">${formatPriceNumber((Number(item.price) || 0) * (Number(item.qty) || 1))} جنيه</div>
                        </div>
                        <div class="qty-controls">
                            <button type="button" class="qty-btn" onclick="changeOrderItemQty('${escapeHtmlAttr(order.orderId)}', ${itemIdx}, 1)">+</button>
                            <span class="qty-val">${item.qty}</span>
                            <button type="button" class="qty-btn" onclick="changeOrderItemQty('${escapeHtmlAttr(order.orderId)}', ${itemIdx}, -1)">-</button>
                            <button type="button" class="remove-item-btn" onclick="removeOrderItem('${escapeHtmlAttr(order.orderId)}', ${itemIdx})" aria-label="حذف">✕</button>
                        </div>
                    </div>
                    ${(sizeSel || colSel) ? `<div class="cart-item-options">${sizeSel}${colSel}</div>` : ""}
                    <input type="text" class="cart-item-note-input" value="${escapeHtmlAttr(item.customNote || "")}" placeholder="ملاحظة على القطعة..." onchange="updateOrderItemOption('${escapeHtmlAttr(order.orderId)}', ${itemIdx}, 'customNote', this.value)">
                </div>
            `;
        }).join("");

        return `
            <div class="active-order-card ${isAppendingThis ? "appending-target" : ""}">
                <div class="active-order-head">
                    <div>
                        <div class="active-order-id">طلب ${escapeHtmlAttr(order.orderId)}</div>
                        <div class="active-order-time">${escapeHtmlAttr(order.createdAtLabel || "")} • ${orderPieces} قطعة</div>
                    </div>
                    <span class="active-order-status-pill">قيد التنفيذ</span>
                </div>
                <div class="active-order-items-list">${itemsHtml || `<div class="active-orders-empty">لا توجد منتجات متبقية في هذا الطلب.</div>`}</div>
                <div class="active-order-total-line">
                    <span>إجمالي الطلب بعد التعديل:</span>
                    <strong>${formatPriceNumber(orderTotal)} جنيه</strong>
                </div>
                <div class="active-order-actions">
                    <button type="button" class="order-add-more-btn ${isAppendingThis ? "active" : ""}" onclick="toggleAppendToOrder('${escapeHtmlAttr(order.orderId)}')">
                        ${isAppendingThis ? "جاري الإضافة للطلب..." : "+ إضافة منتجات"}
                    </button>
                    <button type="button" class="order-send-update-btn" onclick="sendOrderUpdateWhatsApp('${escapeHtmlAttr(order.orderId)}', 'تعديل')">
                        إرسال التعديل للواتساب
                    </button>
                    <button type="button" class="order-received-btn" onclick="markOrderAsReceived('${escapeHtmlAttr(order.orderId)}')">
                        ✓ تم الاستلام
                    </button>
                    <button type="button" class="order-cancel-btn" onclick="cancelActiveOrder('${escapeHtmlAttr(order.orderId)}')">
                        إلغاء الطلب
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function markOrderAsReceived(orderId) {
    const orderIdx = activeOrders.findIndex(o => o.orderId === orderId);
    if (orderIdx === -1) return;
    const order = activeOrders[orderIdx];
    const confirmed = window.confirm(`تأكيد استلام الطلب ${orderId} ونقله إلى الأوردرات المستلمة؟`);
    if (!confirmed) return;

    if (appendTargetOrderId === orderId) {
        appendTargetOrderId = null;
        updateAppendOrderBannerUI();
    }

    const receivedOrder = {
        ...order,
        status: "received",
        receivedAt: new Date().toISOString(),
        receivedAtLabel: new Date().toLocaleString("ar-EG", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
        })
    };

    activeOrders.splice(orderIdx, 1);
    receivedOrders.unshift(receivedOrder);
    saveActiveOrders();
    saveReceivedOrders();
    updateCartUI();
    showCaramelToast(`تم نقل الطلب ${orderId} إلى الأوردرات المستلمة`);
}

function reorderReceivedItem(orderId, itemIdx) {
    const order = receivedOrders.find(o => o.orderId === orderId);
    const item = order && Array.isArray(order.items) ? order.items[itemIdx] : null;
    if (!item) return;

    mergeLineItemIntoList(cart, {
        id: item.id,
        title: item.title,
        price: Number(item.price) || 0,
        img: item.selectedImg || item.img || "",
        selectedImg: item.selectedImg || item.img || "",
        merchant: item.merchant || "متجر كارامل",
        qty: Math.max(1, Number(item.qty) || 1),
        selectedSize: item.selectedSize || "",
        selectedColor: item.selectedColor || "",
        customNote: item.customNote || ""
    });
    saveCart();
    updateCartUI();
    showCaramelToast(`تمت إضافة "${item.title}" للسلة مرة أخرى`);
}

function clearReceivedOrdersHistory() {
    if (!receivedOrders.length) return;
    if (!window.confirm("هل تريد مسح سجل الأوردرات المستلمة؟")) return;
    receivedOrders = [];
    saveReceivedOrders();
    renderReceivedOrdersInCart();
    showCaramelToast("تم مسح سجل الأوردرات المستلمة");
}

function renderReceivedOrdersInCart() {
    const container = document.getElementById("receivedOrdersContainer");
    const countBadge = document.getElementById("receivedOrdersCountBadge");
    if (!container) return;

    if (countBadge) countBadge.textContent = String(receivedOrders.length);

    if (!receivedOrders.length) {
        container.innerHTML = `<div class="received-orders-empty">لا توجد أوردرات مستلمة بعد. بعد الضغط على "تم الاستلام" سيُحفظ طلبك هنا.</div>`;
        return;
    }

    container.innerHTML = receivedOrders.map(order => {
        const orderTotal = (order.items || []).reduce((sum, it) => sum + ((Number(it.price) || 0) * (Number(it.qty) || 1)), 0);
        const orderPieces = (order.items || []).reduce((sum, it) => sum + (Number(it.qty) || 1), 0);

        const itemsHtml = (order.items || []).map((item, itemIdx) => {
            const metaParts = [];
            if (item.selectedSize) metaParts.push(item.selectedSize);
            if (item.selectedColor) metaParts.push(item.selectedColor);
            if (item.customNote) metaParts.push(item.customNote);

            return `
                <div class="received-order-item-row">
                    <div class="received-order-item-text">
                        <div class="received-order-item-title">${escapeHtmlAttr(item.title)} × ${item.qty}</div>
                        ${metaParts.length ? `<div class="received-order-item-sub">${escapeHtmlAttr(metaParts.join(" • "))}</div>` : ""}
                    </div>
                    <button type="button" class="received-reorder-btn" onclick="reorderReceivedItem('${escapeHtmlAttr(order.orderId)}', ${itemIdx})">إعادة طلب</button>
                </div>
            `;
        }).join("");

        return `
            <div class="received-order-card">
                <div class="active-order-head">
                    <div>
                        <div class="active-order-id">طلب ${escapeHtmlAttr(order.orderId)}</div>
                        <div class="active-order-time">استُلم: ${escapeHtmlAttr(order.receivedAtLabel || order.createdAtLabel || "")} • ${orderPieces} قطعة</div>
                    </div>
                    <span class="received-order-status-pill">تم الاستلام</span>
                </div>
                <div class="received-order-items-box">${itemsHtml}</div>
                <div class="active-order-total-line">
                    <span>إجمالي الطلب:</span>
                    <strong>${formatPriceNumber(orderTotal)} جنيه</strong>
                </div>
            </div>
        `;
    }).join("") + `
        <button type="button" class="received-clear-btn" onclick="clearReceivedOrdersHistory()">مسح سجل الأوردرات المستلمة</button>
    `;
}

function toggleAppendToOrder(orderId) {
    if (appendTargetOrderId === orderId) {
        appendTargetOrderId = null;
        showCaramelToast("تم إيقاف وضع الإضافة للطلب");
    } else {
        appendTargetOrderId = orderId;
        closeCart();
        showCaramelToast(`اختر أي منتج لإضافته للطلب ${orderId}`);
    }
    updateAppendOrderBannerUI();
    renderActiveOrdersInCart();
    renderProducts(currentCategory);
}

function cancelAppendToOrderMode() {
    appendTargetOrderId = null;
    updateAppendOrderBannerUI();
    renderActiveOrdersInCart();
    renderProducts(currentCategory);
}

function updateAppendOrderBannerUI() {
    const banner = document.getElementById("appendOrderBanner");
    const textEl = document.getElementById("appendOrderBannerText");
    if (!banner || !textEl) return;

    const target = appendTargetOrderId ? activeOrders.find(o => o.orderId === appendTargetOrderId && o.status === "pending") : null;
    if (!target) {
        appendTargetOrderId = null;
        banner.classList.add("is-hidden");
        return;
    }

    textEl.textContent = `أي منتج تضيفه الآن يُضاف مباشرة إلى الطلب ${target.orderId}.`;
    banner.classList.remove("is-hidden");
}

function changeOrderItemQty(orderId, itemIdx, delta) {
    const order = activeOrders.find(o => o.orderId === orderId);
    if (!order || !order.items[itemIdx]) return;
    order.items[itemIdx].qty += delta;
    if (order.items[itemIdx].qty <= 0) {
        order.items.splice(itemIdx, 1);
    }
    order.updatedAt = new Date().toISOString();
    saveActiveOrders();
    updateCartUI();
}

function removeOrderItem(orderId, itemIdx) {
    const order = activeOrders.find(o => o.orderId === orderId);
    if (!order || !order.items[itemIdx]) return;
    order.items.splice(itemIdx, 1);
    order.updatedAt = new Date().toISOString();
    saveActiveOrders();
    updateCartUI();
}

function updateOrderItemOption(orderId, itemIdx, field, value) {
    const order = activeOrders.find(o => o.orderId === orderId);
    if (!order || !order.items[itemIdx]) return;
    order.items[itemIdx][field] = value;
    if (field === "selectedSize") {
        const product = PRODUCTS.find(p => p.id === order.items[itemIdx].id);
        if (product) {
            order.items[itemIdx].price = getOptionVariantPrice(product, value, product.price);
        }
    }
    order.updatedAt = new Date().toISOString();
    saveActiveOrders();
    updateCartUI();
}

function buildOrderMessageText(order, actionPrefix = "تعديل على الطلب") {
    const totalAmount = (order.items || []).reduce((sum, it) => sum + ((Number(it.price) || 0) * (Number(it.qty) || 1)), 0);
    const lines = (order.items || []).map((item, i) => {
        const extras = [];
        if (item.selectedSize) extras.push(`المقاس: ${item.selectedSize}`);
        if (item.selectedColor) extras.push(`اللون: ${item.selectedColor}`);
        if (item.customNote) extras.push(`تفاصيل: ${item.customNote}`);
        if (item.merchant) extras.push(`التاجر: ${item.merchant}`);
        const extraText = extras.length ? ` (${extras.join(" | ")})` : "";
        return `${i + 1}. ${item.title}${extraText} × ${item.qty} = ${(Number(item.price) || 0) * (Number(item.qty) || 1)} جنيه`;
    });

    const headerLines = [
        `رقم الطلب: ${order.orderId}`,
        `الاسم: ${order.customerName || "غير محدد"}`,
        `رقم التواصل: ${order.customerPhone || "غير محدد"}`
    ];
    if (order.locationSummary) {
        headerLines.push(`العنوان/اللوكيشن: ${order.locationSummary}`);
    }

    return `مرحباً متجر كارامل، هذا (${actionPrefix}):\n\n${headerLines.join("\n")}\n\n${lines.length ? lines.join("\n") : "(تم تفريغ المنتجات)"}\n\nالإجمالي: ${totalAmount} جنيه`;
}

function sendOrderUpdateWhatsApp(orderId, actionLabel = "تعديل") {
    const order = activeOrders.find(o => o.orderId === orderId);
    if (!order) return;
    if (appendTargetOrderId === orderId) {
        appendTargetOrderId = null;
        updateAppendOrderBannerUI();
    }
    const msg = buildOrderMessageText(order, `${actionLabel} على الطلب`);
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`);
}

function cancelActiveOrder(orderId) {
    const order = activeOrders.find(o => o.orderId === orderId);
    if (!order) return;
    const confirmed = window.confirm(`هل تريد إلغاء الطلب ${orderId}؟`);
    if (!confirmed) return;

    if (appendTargetOrderId === orderId) {
        appendTargetOrderId = null;
    }

    const cancelMsg = `مرحباً متجر كارامل، أود (إلغاء الطلب) رقم: ${order.orderId}\nالاسم: ${order.customerName || "-"}\nرقم التواصل: ${order.customerPhone || "-"}`;
    order.status = "cancelled";
    order.updatedAt = new Date().toISOString();
    saveActiveOrders();
    updateCartUI();
    showCaramelToast(`تم إلغاء الطلب ${orderId}`);

    const notifyWa = window.confirm("هل تحب إرسال إشعار الإلغاء على واتساب الآن؟");
    if (notifyWa) {
        launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(cancelMsg)}`);
    }
}

function changeCartQty(index, delta) {
    if (!cart[index]) return;
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function removeCartItem(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function clearCart() {
    cart = [];
    saveCart();
    updateCartUI();
}

function openCart() {
    loadCustomerProfileToInputs();
    updateCartUI();
    const drawer = document.getElementById("cartDrawer");
    const backdrop = document.getElementById("cartBackdrop");
    if (drawer) drawer.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("cart");
}

function closeCart(fromPopState = false) {
    const drawer = document.getElementById("cartDrawer");
    const backdrop = document.getElementById("cartBackdrop");
    if (drawer) drawer.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("cart");
}

let customerLocationData = null;

function updateCustomerLocationUI() {
    const btn = document.getElementById("cartLocationBtn");
    const btnText = document.getElementById("cartLocationBtnText");
    const clearBtn = document.getElementById("cartLocationClearBtn");
    const preview = document.getElementById("cartLocationPreview");
    if (!btn || !btnText || !clearBtn || !preview) return;

    if (customerLocationData && customerLocationData.mapsUrl) {
        btn.classList.add("located");
        btnText.textContent = "تم تحديد اللوكيشن بنجاح ✓";
        clearBtn.classList.add("visible");
        preview.classList.remove("is-hidden");
        preview.textContent = customerLocationData.summaryText || customerLocationData.mapsUrl;
    } else {
        btn.classList.remove("located");
        btnText.textContent = "تحديد موقعي الحالي (اللوكيشن)";
        clearBtn.classList.remove("visible");
        preview.classList.add("is-hidden");
        preview.textContent = "";
    }
}

function clearCustomerLocation() {
    customerLocationData = null;
    updateCustomerLocationUI();
    showCaramelToast("تم إلغاء اللوكيشن المحدد");
}

function requestCustomerLocation() {
    const btnText = document.getElementById("cartLocationBtnText");
    if (!navigator.geolocation) {
        showCaramelToast("المتصفح لا يدعم تحديد الموقع الجغرافي");
        return;
    }

    if (btnText) btnText.textContent = "جاري تحديد موقعك...";
    showCaramelToast("جاري تحديد موقعك الحالي...");

    navigator.geolocation.getCurrentPosition(
        async pos => {
            const lat = Number(pos.coords.latitude).toFixed(6);
            const lng = Number(pos.coords.longitude).toFixed(6);
            const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
            let addressLabel = "";

            try {
                const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ar`, { cache: "no-store" });
                if (resp && resp.ok) {
                    const data = await resp.json();
                    if (data && data.display_name) {
                        addressLabel = data.display_name.split(",").slice(0, 3).join(" - ").trim();
                    }
                }
            } catch (e) {}

            customerLocationData = {
                lat,
                lng,
                mapsUrl,
                addressLabel,
                summaryText: addressLabel ? `${addressLabel} (${mapsUrl})` : mapsUrl
            };
            updateCustomerLocationUI();
            showCaramelToast("تم تحديد موقعك وإرفاق رابط الخريطة للطلب");
        },
        err => {
            updateCustomerLocationUI();
            if (err && err.code === 1) {
                showCaramelToast("يرجى السماح بصلاحية الموقع من إعدادات المتصفح");
            } else {
                showCaramelToast("تعذر تحديد الموقع حالياً، يمكنك إرسال العنوان يدوياً");
            }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
}

function openWhatsAppChatDirect() {
    const msg = encodeURIComponent("مرحباً متجر كارامل، أود التواصل معكم.");
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`);
}

function checkoutOnWhatsApp() {
    if (cart.length === 0) return;

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

    saveCustomerProfileInputs(customerName, customerPhone);

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const nowLabel = new Date().toLocaleString("ar-EG", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });
    const locationSummary = customerLocationData && customerLocationData.mapsUrl
        ? (customerLocationData.addressLabel
            ? `${customerLocationData.addressLabel} - ${customerLocationData.mapsUrl}`
            : customerLocationData.mapsUrl)
        : "";

    const newOrder = {
        orderId,
        status: "pending",
        createdAt: new Date().toISOString(),
        createdAtLabel: nowLabel,
        customerName,
        customerPhone,
        locationSummary,
        items: cart.map(it => ({ ...it }))
    };

    activeOrders.unshift(newOrder);
    saveActiveOrders();

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const lines = cart.map((item, i) => {
        const extras = [];
        if (item.selectedSize) extras.push(`المقاس: ${item.selectedSize}`);
        if (item.selectedColor) extras.push(`اللون: ${item.selectedColor}`);
        if (item.customNote) extras.push(`تفاصيل: ${item.customNote}`);
        if (item.merchant) extras.push(`التاجر: ${item.merchant}`);
        if (item.selectedImg) extras.push(`الصورة: ${item.selectedImg}`);
        const extraText = extras.length ? ` (${extras.join(" | ")})` : "";
        return `${i + 1}. ${item.title}${extraText} × ${item.qty} = ${item.price * item.qty} جنيه`;
    });

    const customerHeaderLines = [
        `رقم الطلب: ${orderId}`,
        `الاسم: ${customerName}`,
        `رقم التواصل: ${customerPhone}`
    ];
    if (locationSummary) {
        customerHeaderLines.push(`العنوان/اللوكيشن: ${locationSummary}`);
    }

    cart = [];
    saveCart();
    updateCartUI();

    const message = `مرحباً متجر كارامل، أود تأكيد الطلب التالي:\n\n${customerHeaderLines.join("\n")}\n\n${lines.join("\n")}\n\nالإجمالي: ${totalAmount} جنيه\n(السويس: الدفع عند الاستلام • المحافظات الأخرى: إنستا باي أو فوري أو كاش • التوصيل خلال يوم عمل)`;
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`);
}

function renderRelatedInPreviewModal(product) {
    const box = document.getElementById("previewRelatedSection");
    const listEl = document.getElementById("previewRelatedList");
    if (!box || !listEl) return;

    if (!product || !PRODUCTS.length) {
        box.classList.add("is-hidden");
        listEl.innerHTML = "";
        return;
    }

    const candidates = PRODUCTS.filter(p =>
        p.id !== product.id &&
        (p.merchant === product.merchant || p.category === product.category)
    ).slice(0, 4);

    if (!candidates.length) {
        box.classList.add("is-hidden");
        listEl.innerHTML = "";
        return;
    }

    box.classList.remove("is-hidden");
    listEl.innerHTML = candidates.map(rel => `
        <button type="button" class="preview-related-chip" onclick="openImageModal('${escapeHtmlAttr(rel.img)}', '${escapeHtmlAttr(rel.id)}')">
            <img src="${escapeHtmlAttr(rel.img)}" alt="${escapeHtmlAttr(rel.title)}" onerror="this.classList.add('img-hidden')">
            <span class="preview-related-meta">
                <span class="preview-related-title">${escapeHtmlAttr(rel.title)}</span>
                <span class="preview-related-price">${formatPriceNumber(rel.priceLabel || rel.price)} ج</span>
            </span>
        </button>
    `).join("");
}

function syncPreviewModalMedia() {
    const imgEl = document.getElementById("modalImagePreview");
    const prevBtn = document.getElementById("previewPrevBtn");
    const nextBtn = document.getElementById("previewNextBtn");
    const thumbsRow = document.getElementById("previewThumbsRow");
    const imgs = previewModalState.imgs || [];
    const safeIdx = imgs.length ? ((previewModalState.idx % imgs.length) + imgs.length) % imgs.length : 0;
    previewModalState.idx = safeIdx;

    if (imgEl && imgs.length) {
        imgEl.style.opacity = "1";
        imgEl.removeAttribute("data-retry-step");
        imgEl.src = imgs[safeIdx];
    }

    const hasMulti = imgs.length > 1;
    if (prevBtn) prevBtn.classList.toggle("is-hidden", !hasMulti);
    if (nextBtn) nextBtn.classList.toggle("is-hidden", !hasMulti);

    if (thumbsRow) {
        if (hasMulti) {
            thumbsRow.classList.remove("is-hidden");
            thumbsRow.innerHTML = imgs.map((u, idx) => `
                <button type="button" class="preview-thumb-btn ${idx === safeIdx ? "active" : ""}" onclick="selectPreviewThumb(${idx}, event)">
                    <img src="${escapeHtmlAttr(u)}" alt="صورة ${idx + 1}">
                </button>
            `).join("");
        } else {
            thumbsRow.classList.add("is-hidden");
            thumbsRow.innerHTML = "";
        }
    }

    const product = PRODUCTS.find(p => p.id === previewModalState.productId);
    const waBtn = document.getElementById("previewWhatsAppBtn");
    if (product && waBtn) {
        waBtn.href = buildProductWhatsAppUrl(product, imgs[safeIdx] || "");
    }
}

function stepPreviewImage(delta, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const imgs = previewModalState.imgs || [];
    if (imgs.length <= 1) return;
    previewModalState.idx = (previewModalState.idx + delta + imgs.length) % imgs.length;
    syncPreviewModalMedia();
}

function selectPreviewThumb(idx, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    previewModalState.idx = Number(idx) || 0;
    syncPreviewModalMedia();
}

function openImageModal(src, productId = null) {
    const modal = document.getElementById("imageModal");
    const imgEl = document.getElementById("modalImagePreview");
    const catChip = document.getElementById("previewCategoryChip");
    const merchantChip = document.getElementById("previewMerchantChip");
    const titleEl = document.getElementById("previewProductTitle");
    const mainPriceEl = document.getElementById("previewMainPrice");
    const subPriceEl = document.getElementById("previewSubPrice");
    const storyTextEl = document.getElementById("previewStoryText");
    const hookNoteEl = document.getElementById("previewHookNote");
    const addBtn = document.getElementById("previewAddToCartBtn");
    const waBtn = document.getElementById("previewWhatsAppBtn");
    if (!modal || !imgEl) return;

    const product = productId ? PRODUCTS.find(p => p.id === productId) : null;
    if (product) trackProductInterest(product, 1.5, true);

    const imgs = product ? getProductImagesList(product) : [normalizeProductImageUrl(src)].filter(Boolean);
    const clickedNorm = normalizeProductImageUrl(src);
    const foundIdx = clickedNorm && imgs.length ? imgs.indexOf(clickedNorm) : 0;

    previewModalState = {
        productId: product ? product.id : null,
        imgs: imgs.length ? imgs : [normalizeProductImageUrl(src)],
        idx: foundIdx >= 0 ? foundIdx : 0
    };

    imgEl.alt = product ? product.title : "معاينة المنتج";
    imgEl.setAttribute("data-product-id", product ? product.id : "");
    syncPreviewModalMedia();

    const catLabel = product ? (CATEGORY_NAMES[product.category] || "متجر كارامل") : "متجر كارامل";
    const merchantLabel = product ? (product.merchant || "متجر كارامل") : "متجر كارامل";
    const titleText = product ? product.title : "منتج مميز من متجر كارامل";
    const displayPrice = product ? formatPriceNumber(product.priceLabel || product.price) : "";
    const storyText = product
        ? (product.desc || `${product.title} متوفر الآن لدى متجر كارامل بجودة مختارة وسعر مناسب.`)
        : "قطعة مميزة من تشكيلة متجر كارامل.";
    const hookText = buildEngagingHookForProduct(product);

    if (catChip) catChip.textContent = catLabel;
    if (merchantChip) {
        merchantChip.textContent = `التاجر: ${merchantLabel}`;
        merchantChip.classList.toggle("is-clickable", Boolean(product));
        merchantChip.onclick = product ? () => { closeImageModal(); filterByMerchant(merchantLabel, true); } : null;
    }
    if (titleEl) titleEl.textContent = titleText;
    if (mainPriceEl) {
        mainPriceEl.innerHTML = displayPrice ? `${displayPrice} <span>جنيه</span>` : "";
        mainPriceEl.classList.toggle("is-hidden", !displayPrice);
    }
    if (subPriceEl) {
        if (product && product.subPrice) { subPriceEl.textContent = product.subPrice; subPriceEl.classList.remove("is-hidden"); }
        else { subPriceEl.classList.add("is-hidden"); }
    }
    if (storyTextEl) storyTextEl.textContent = storyText;
    if (hookNoteEl) hookNoteEl.textContent = hookText;

    renderRelatedInPreviewModal(product);

    if (addBtn) {
        addBtn.textContent = appendTargetOrderId ? "أضف للطلب الحالي" : "أضف للمشتريات";
        addBtn.onclick = () => {
            const activeSrc = previewModalState.imgs[previewModalState.idx] || src;
            closeImageModal();
            if (product) openProductOptionModal(product.id, null, activeSrc);
            else {
                const msg = encodeURIComponent(`أريد طلب هذا المنتج: ${src}`);
                launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`);
            }
        };
    }

    if (waBtn) {
        const activeSrc = previewModalState.imgs[previewModalState.idx] || src;
        waBtn.href = product ? buildProductWhatsAppUrl(product, activeSrc) : `https://wa.me/${WHATSAPP_NUMBER}`;
        waBtn.onclick = e => {
            e.preventDefault();
            const currentSrc = previewModalState.imgs[previewModalState.idx] || src;
            const targetUrl = product ? buildProductWhatsAppUrl(product, currentSrc) : `https://wa.me/${WHATSAPP_NUMBER}`;
            waBtn.href = targetUrl;
            if (product) onDirectWhatsAppClick(product.id);
            launchWhatsAppTarget(targetUrl);
        };
    }

    modal.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("image");
}

function closeImageModal(fromPopState = false) {
    const modal = document.getElementById("imageModal");
    if (modal) modal.classList.remove("open");
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("image");
}

const ONESIGNAL_APP_ID = "d35fc670-898a-4e20-bb33-9f97e48f3e4f";
const PUSH_PERMISSION_STORAGE_KEY = "caramel_push_enabled_v1";
const PUSH_ICON_URL = "https://raw.githubusercontent.com/CaramelaSHINStore/Carmela.store/refs/heads/main/compressed_1795355576678.jpeg";
let oneSignalReadyPromise = null;

function isPushAlreadyEnabled() {
    if ("Notification" in window && Notification.permission === "granted") return true;
    try { return localStorage.getItem(PUSH_PERMISSION_STORAGE_KEY) === "1"; } catch (e) { return false; }
}

function setPushButtonEnabledState(enabled, animateHide = false) {
    const btn = document.getElementById("caramelPushBtn");
    const icon = document.getElementById("caramelPushIcon");
    const text = document.getElementById("caramelPushBtnText");
    if (!btn) return;
    try { localStorage.setItem(PUSH_PERMISSION_STORAGE_KEY, enabled ? "1" : "0"); } catch (e) {}
    if (enabled) {
        btn.classList.add("visible", "circle-check-only");
        if (icon) icon.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        if (text) text.textContent = "الإشعارات مفعّلة";
        btn.title = "إشعارات متجر كارامل مفعّلة";
        btn.setAttribute("aria-label", "إشعارات متجر كارامل مفعّلة");
        if (animateHide) setTimeout(() => btn.classList.add("hiding-smooth"), 1200);
        else btn.classList.add("hiding-smooth");
    } else {
        btn.classList.remove("circle-check-only", "hiding-smooth");
        btn.classList.add("visible");
        if (icon) icon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>`;
        if (text) text.textContent = "فعّل إشعارات العروض";
        btn.title = "تفعيل إشعارات متجر كارامل";
        btn.setAttribute("aria-label", "تفعيل إشعارات متجر كارامل");
    }
}

function initCaramelPushUI() {
    if (isPushAlreadyEnabled()) setPushButtonEnabledState(true, false);
    else setPushButtonEnabledState(false, false);
}

function ensureOneSignalSDK() {
    if (oneSignalReadyPromise) return oneSignalReadyPromise;
    oneSignalReadyPromise = new Promise(resolve => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            try {
                if (!window.__caramelOneSignalInitialized) {
                    await OneSignal.init({
                        appId: ONESIGNAL_APP_ID,
                        allowLocalhostAsSecureOrigin: true,
                        notifyButton: { enable: false },
                        promptOptions: { slidedown: { prompts: [{ type: "push", autoPrompt: false }] } }
                    });
                    window.__caramelOneSignalInitialized = true;
                }
                resolve(OneSignal);
            } catch (err) { resolve(null); }
        });
        if (!document.getElementById("onesignal-sdk-script")) {
            const script = document.createElement("script");
            script.id = "onesignal-sdk-script";
            script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
            script.defer = true;
            script.onerror = () => resolve(null);
            document.head.appendChild(script);
        }
    });
    return oneSignalReadyPromise;
}

function showWelcomeCaramelNotification() {
    const title = "متجر كارامل - Caramel Store";
    const body = "أهلاً بك! تم تفعيل الإشعارات لتصلك أحدث العروض والمنتجات أولاً بأول.";
    if ("Notification" in window && Notification.permission === "granted") {
        try {
            if ("serviceWorker" in navigator && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body, icon: PUSH_ICON_URL, badge: PUSH_ICON_URL, dir: "rtl", lang: "ar", tag: "caramel-welcome-notif" })).catch(() => new Notification(title, { body, icon: PUSH_ICON_URL }));
            } else new Notification(title, { body, icon: PUSH_ICON_URL });
        } catch (e) {}
    }
    showCaramelToast("تم تفعيل إشعارات متجر كارامل بنجاح!");
}

async function enableCaramelPush() {
    if (isPushAlreadyEnabled()) { setPushButtonEnabledState(true, true); showCaramelToast("الإشعارات مفعّلة بالفعل"); return; }
    try {
        const OneSignal = await ensureOneSignalSDK();
        if (OneSignal && OneSignal.Notifications) {
            if (!OneSignal.Notifications.permission) await OneSignal.Notifications.requestPermission();
            if (OneSignal.Notifications.permission) { setPushButtonEnabledState(true, true); showWelcomeCaramelNotification(); return; }
        }
    } catch (e) {}

    if ("Notification" in window) {
        try {
            const perm = await Notification.requestPermission();
            if (perm === "granted") { setPushButtonEnabledState(true, true); showWelcomeCaramelNotification(); return; }
        } catch (e) {}
    }
    showCaramelToast("يرجى السماح بالإشعارات من إعدادات المتصفح");
}

function initCaramelSplashScreen() {
    const splash = document.getElementById("caramelSplashScreen");
    const rectEl = document.getElementById("caramelSplashSubRect");
    const typedTextEl = document.getElementById("caramelSplashTypedText");
    const headerSloganEl = document.querySelector(".logo-sub");

    const splashBadgeText = "كل قطعة وليها دور";
    const minSplashMs = 1500;
    const maxSafetyMs = 2200;
    const startTime = Date.now();
    let dismissed = false;

    if (typedTextEl && !typedTextEl.textContent.trim()) {
        typedTextEl.textContent = splashBadgeText;
    }

    setTimeout(() => {
        if (rectEl) rectEl.classList.add("descend-in");
    }, 280);

    function playHeaderSloganEntrance() {
        if (!headerSloganEl) return;
        headerSloganEl.classList.remove("slogan-reenter", "play");
        void headerSloganEl.offsetWidth;
        headerSloganEl.classList.add("slogan-reenter", "play");
    }

    function finishSplash() {
        if (dismissed) return;
        dismissed = true;
        if (!splash) { playHeaderSloganEntrance(); return; }
        splash.classList.add("hide");
        playHeaderSloganEntrance();
        setTimeout(() => { if (splash && splash.parentNode) splash.parentNode.removeChild(splash); }, 500);
    }

    function scheduleDismiss() {
        const elapsed = Date.now() - startTime;
        const waitMs = Math.max(0, minSplashMs - elapsed);
        setTimeout(finishSplash, waitMs);
    }

    if (document.readyState === "complete") scheduleDismiss();
    else window.addEventListener("load", scheduleDismiss, { once: true });
    setTimeout(finishSplash, maxSafetyMs);
}

initThemeMode();
initCaramelSplashScreen();
syncHeaderStickyOffsets();
hydrateTopQuickTabIcons();
renderSideCategoriesList();
renderSmartSearchSuggestions();
renderSpotlightBoxes();
updateCartUI();
loadCustomerProfileToInputs();
initCaramelPushUI();
loadMerchantProductsFromJson();
