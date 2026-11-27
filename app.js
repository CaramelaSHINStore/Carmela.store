const APP_BUILD_VERSION = "v20261128-01";
const APPLIED_BUILD_KEY = "caramel_applied_build_version_v1";
const LIVE_CATALOG_POLL_MS = 20000;
const LIVE_CATALOG_MIN_GAP_MS = 3500;

let WHATSAPP_NUMBER = "201055436305";
let STORE_URL = "https://caramelstoresuez.github.io/Carmelastore/";
let BRAND_LOGO_URL = "./compressed_1795766509611.jpeg?v=v20261128-01";

function isSafeMediaOrUrl(rawUrl) {
    const val = String(rawUrl || "").trim();
    if (!val) return false;
    if (/^(https?:\/\/|data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,|blob:)/i.test(val)) return true;
    if (/^[a-z][a-z0-9+.-]*:/i.test(val)) return false;
    return /^[.\/a-zA-Z0-9_\-\u0600-\u06FF%?=&+.~]+$/.test(val);
}

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
    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    const triggerDirectScheme = (targetScheme) => {
        const anchor = document.createElement("a");
        anchor.href = targetScheme;
        anchor.style.display = "none";
        anchor.rel = "noopener noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(() => {
            if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
        }, 200);
    };

    let switchedAway = false;
    let fallbackTriggered = false;
    const onVisChange = () => {
        if (document.hidden) {
            switchedAway = true;
            document.removeEventListener("visibilitychange", onVisChange);
        }
    };
    document.addEventListener("visibilitychange", onVisChange);

    const runSingleFallback = () => {
        if (fallbackTriggered || switchedAway || document.visibilityState !== "visible") return;
        fallbackTriggered = true;
        if (isAndroid && intentUrl) {
            try {
                window.location.href = intentUrl;
                return;
            } catch (e) {}
        }
        if (isIOS) {
            window.location.href = schemeUrl;
            return;
        }
        const win = window.open(apiUrl, "_blank", "noopener,noreferrer");
        if (!win) window.location.href = apiUrl;
    };

    try {
        if (isAndroid && intentUrl) {
            window.location.href = intentUrl;
        } else {
            triggerDirectScheme(schemeUrl);
        }
    } catch (e) {
        try {
            window.location.href = schemeUrl;
        } catch (err) {}
    }

    setTimeout(() => {
        document.removeEventListener("visibilitychange", onVisChange);
        runSingleFallback();
    }, 1300);
}

const CART_STORAGE_KEY = "caramel_store_cart_v1";
const WISHLIST_STORAGE_KEY = "caramel_wishlist_v1";
const ACTIVE_ORDERS_STORAGE_KEY = "caramel_active_orders_v1";
const RECEIVED_ORDERS_STORAGE_KEY = "caramel_received_orders_v1";
const INTEREST_STORAGE_KEY = "caramel_smart_interest_v1";
const THEME_STORAGE_KEY = "caramel_store_theme_mode_v1";
const CUSTOMER_PROFILE_KEY = "caramel_customer_profile_v1";
const SEARCH_HISTORY_KEY = "caramel_search_history_v1";
const BATCH_SIZE = 12;
const FULL_MODE_INITIAL_BATCH = 24;
const CONTINUATION_STEP = 8;

const GITHUB_MERCHANTS_CONFIG = {
    owner: "Caramelstoresuez",
    repo: "Carmelastore",
    branch: "main",
    folder: "merchants"
};

const STORE_CONFIG_JSON_CANDIDATES = [
    "./store-config.json",
    "./config.json",
    "./data/store-config.json",
    "./data/config.json"
];

function applyStoreConfigFromPayload(cfg) {
    if (!cfg || typeof cfg !== "object") return false;
    let changed = false;

    const rawWa = cfg.whatsappNumber ?? cfg.whatsapp ?? cfg.waNumber ?? cfg.phone ?? cfg.supportPhone ?? "";
    const cleanWa = String(rawWa || "").replace(/\D/g, "").trim();
    if (cleanWa && cleanWa.length >= 8 && cleanWa !== WHATSAPP_NUMBER) {
        WHATSAPP_NUMBER = cleanWa;
        changed = true;
    }

    const rawStoreUrl = cfg.storeUrl ?? cfg.siteUrl ?? cfg.url ?? cfg.website ?? "";
    if (typeof rawStoreUrl === "string" && rawStoreUrl.trim() && isSafeMediaOrUrl(rawStoreUrl.trim())) {
        const trimmedUrl = rawStoreUrl.trim();
        const normalizedUrl = trimmedUrl.endsWith("/") ? trimmedUrl : `${trimmedUrl}/`;
        if (normalizedUrl !== STORE_URL) {
            STORE_URL = normalizedUrl;
            changed = true;
        }
    }

    const rawLogo = cfg.brandLogoUrl ?? cfg.logoUrl ?? cfg.logo ?? cfg.brandLogo ?? "";
    if (typeof rawLogo === "string" && rawLogo.trim() && isSafeMediaOrUrl(rawLogo.trim())) {
        const nextLogo = normalizeProductImageUrl(rawLogo.trim()) || BRAND_LOGO_URL;
        if (nextLogo !== BRAND_LOGO_URL) {
            BRAND_LOGO_URL = nextLogo;
            changed = true;
        }
    }

    if (changed) {
        syncSupportWhatsAppLinks();
        syncBrandLogos();
    }
    return changed;
}

function syncSupportWhatsAppLinks() {
    const csLink = document.querySelector(".promo-cs-link");
    if (csLink) {
        const defaultMsg = encodeURIComponent("مرحباً دعم متجر كارامل");
        csLink.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${defaultMsg}`;
    }
}

let resolvedStoreConfigUrl = null;
let storeConfigCheckedOnce = false;

async function loadStoreConfigFromJson(forceRefresh = false) {
    if (storeConfigCheckedOnce && !resolvedStoreConfigUrl && !forceRefresh) return null;
    const qSuffix = `?ts=${Date.now()}&r=${Math.random().toString(36).slice(2, 7)}`;
    const candidates = resolvedStoreConfigUrl
        ? [resolvedStoreConfigUrl]
        : STORE_CONFIG_JSON_CANDIDATES;

    for (const basePath of candidates) {
        const cleanBase = basePath.split("?")[0];
        const rawFallback = /^https?:\/\//i.test(cleanBase)
            ? cleanBase
            : `https://raw.githubusercontent.com/${GITHUB_MERCHANTS_CONFIG.owner}/${GITHUB_MERCHANTS_CONFIG.repo}/${GITHUB_MERCHANTS_CONFIG.branch}/${cleanBase.replace(/^\.\//, "")}`;
        const urls = resolvedStoreConfigUrl
            ? [`${cleanBase}${qSuffix}`]
            : [`${cleanBase}${qSuffix}`, `${rawFallback}${qSuffix}`];

        for (const url of urls) {
            try {
                const resp = await fetch(url, { cache: "no-store" });
                if (resp && resp.ok) {
                    const text = (await resp.text()).replace(/^\uFEFF/, "").trim();
                    if (!text) continue;
                    const parsed = JSON.parse(text);
                    resolvedStoreConfigUrl = url.split("?")[0];
                    storeConfigCheckedOnce = true;
                    const targetObj = (parsed && typeof parsed === "object" && parsed.storeConfig && typeof parsed.storeConfig === "object")
                        ? parsed.storeConfig
                        : ((parsed && typeof parsed === "object" && parsed.config && typeof parsed.config === "object")
                            ? parsed.config
                            : parsed);
                    if (applyStoreConfigFromPayload(targetObj)) {
                        return targetObj;
                    }
                    return targetObj;
                }
            } catch (e) {}
        }
    }
    storeConfigCheckedOnce = true;
    return null;
}

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

const PRODUCT_VARIANTS = {};

let deferredInstallPrompt = null;
let toastTimer = null;
let isAppendingBatch = false;
let currentFeedMode = "for-you";
let currentSortMode = "smart";
let onlyFavoritesMode = false;
let isLoadingJsonProducts = true;
let isSyncingCatalogNow = false;
let lastCatalogSyncAt = 0;
let lastCatalogSnapshotSignature = "";
let liveCatalogPollTimer = null;
let appendTargetOrderId = null;
let activeCartOrdersTab = "cart";
let expandedOrderIds = new Set();
let pendingConfirmAction = null;
let pendingConfirmCancelAction = null;
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
let feedObserver = null;

function createDebounced(fn, delay = 180) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function formatPriceNumber(priceOrLabel) {
    if (typeof priceOrLabel === "string" && /[a-zA-Z؀-ۿ]/.test(priceOrLabel)) {
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

function syncBrandLogos() {
    document.querySelectorAll("[data-brand-logo]").forEach(img => {
        if (img.tagName === "IMG") {
            img.classList.add("caramel-logo-mark");
            if (isSafeMediaOrUrl(BRAND_LOGO_URL)) {
                img.src = BRAND_LOGO_URL;
            }
            img.alt = "لوجو متجر كارامل - Caramel Store";
        }
    });

    document.querySelectorAll("[data-brand-bg]").forEach(el => {
        if (isSafeMediaOrUrl(BRAND_LOGO_URL)) {
            el.style.backgroundImage = `url("${BRAND_LOGO_URL}")`;
        }
    });

    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach(linkEl => {
        if (!linkEl.getAttribute("href") && isSafeMediaOrUrl(BRAND_LOGO_URL)) {
            linkEl.href = BRAND_LOGO_URL;
        }
    });
}

function initThemeMode() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "dark") {
            document.body.classList.add("dark-theme");
            document.documentElement.classList.add("boot-dark-root");
        } else {
            document.documentElement.classList.remove("boot-dark-root");
        }
    } catch (e) {}
    syncThemeIcon();
}

function toggleThemeMode() {
    const isDark = document.body.classList.toggle("dark-theme");
    document.documentElement.classList.toggle("boot-dark-root", isDark);
    try { localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light"); } catch (e) {}
    syncThemeIcon();
    renderSideCategoriesList();
    showCaramelToast(isDark ? "تم تفعيل المظهر الليلي" : "تم تفعيل المظهر النهاري");
}

function openConfirmModal(title, message, onConfirm, confirmLabel = "تأكيد", onCancel = null) {
    const modal = document.getElementById("confirmActionModal");
    const titleEl = document.getElementById("confirmModalTitle");
    const msgEl = document.getElementById("confirmModalMessage");
    const okBtn = document.getElementById("confirmModalOkBtn");
    if (!modal || !titleEl || !msgEl || !okBtn) {
        if (window.confirm(message)) {
            if (typeof onConfirm === "function") onConfirm();
        } else if (typeof onCancel === "function") {
            onCancel();
        }
        return;
    }
    titleEl.textContent = title || "تأكيد العملية";
    msgEl.textContent = message || "";
    okBtn.textContent = confirmLabel;
    pendingConfirmAction = onConfirm;
    pendingConfirmCancelAction = onCancel;
    modal.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("confirm");
}

function closeConfirmModal(fromPopState = false, invokeCancel = false) {
    const modal = document.getElementById("confirmActionModal");
    if (modal) modal.classList.remove("open");
    const cancelFn = pendingConfirmCancelAction;
    pendingConfirmAction = null;
    pendingConfirmCancelAction = null;
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("confirm");
    if (invokeCancel && typeof cancelFn === "function") cancelFn();
}

function executeConfirmedAction() {
    const fn = pendingConfirmAction;
    pendingConfirmAction = null;
    pendingConfirmCancelAction = null;
    closeConfirmModal(false, false);
    if (typeof fn === "function") fn();
}

function loadWishlistFromStorage() {
    try {
        const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.map(String) : [];
    } catch (e) {
        return [];
    }
}

let wishlistIds = loadWishlistFromStorage();

function saveWishlist() {
    try { localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds)); } catch (e) {}
}

function updateWishlistUI() {
    const badge = document.getElementById("headerFavCount");
    const btn = document.getElementById("headerFavFilterBtn");
    if (badge) {
        badge.textContent = String(wishlistIds.length);
        badge.classList.toggle("visible", wishlistIds.length > 0);
    }
    if (btn) btn.classList.toggle("active", onlyFavoritesMode);
}

function toggleProductFavorite(productId, btnEl, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const idStr = String(productId || "");
    if (!idStr) return;
    const idx = wishlistIds.indexOf(idStr);
    let added = false;
    if (idx > -1) {
        wishlistIds.splice(idx, 1);
    } else {
        wishlistIds.unshift(idStr);
        added = true;
        const prod = PRODUCTS.find(p => String(p.id) === idStr);
        if (prod) trackProductInterest(prod, 2, true);
    }
    saveWishlist();
    updateWishlistUI();

    document.querySelectorAll(`.fav-toggle-btn[data-fav-id="${CSS.escape(idStr)}"]`).forEach(el => {
        el.classList.toggle("active", added);
        el.setAttribute("aria-pressed", String(added));
    });

    if (onlyFavoritesMode && !added) {
        renderProducts(currentCategory);
    }
    showCaramelToast(added ? "تمت الإضافة إلى المفضلة ♥" : "تمت الإزالة من المفضلة");
}

function toggleFavoritesFilter() {
    if (!wishlistIds.length && !onlyFavoritesMode) {
        showCaramelToast("قائمة المفضلة فارغة حالياً — اضغط على القلب في أي منتج لحفظه");
        return;
    }
    onlyFavoritesMode = !onlyFavoritesMode;
    updateWishlistUI();
    renderProducts(currentCategory);
    if (onlyFavoritesMode) scrollToProductsTop();
}

function copyProductShareLink(productId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!productId) return;
    const shareUrl = `${STORE_URL}?product=${encodeURIComponent(productId)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            showCaramelToast("تم نسخ رابط المنتج المباشر!");
        }).catch(() => {
            showCaramelToast(shareUrl);
        });
    } else {
        showCaramelToast("رابط المنتج: " + shareUrl);
    }
}

function renderMerchantsQuickStrip() {
    const strip = document.getElementById("merchantsQuickStrip");
    if (!strip) return;
    strip.innerHTML = "";
    strip.classList.add("is-hidden");
}

function renderMerchantInnerCategories(merchantName) {
    const wrap = document.getElementById("merchantInnerCatsWrap");
    if (!wrap) return;

    if (!merchantName) {
        wrap.innerHTML = "";
        wrap.classList.add("is-hidden");
        return;
    }

    const merchantProducts = PRODUCTS.filter(p => p.merchant === merchantName);
    if (!merchantProducts.length) {
        wrap.innerHTML = "";
        wrap.classList.add("is-hidden");
        return;
    }

    const catCounts = new Map();
    merchantProducts.forEach(p => {
        const catKey = p.category || "home";
        catCounts.set(catKey, (catCounts.get(catKey) || 0) + 1);
    });

    if (catCounts.size <= 1) {
        wrap.innerHTML = "";
        wrap.classList.add("is-hidden");
        return;
    }

    wrap.classList.remove("is-hidden");
    const isAllSelected = !currentCategory || currentCategory === "all";
    let html = `<button type="button" class="merchant-inner-cat-btn ${isAllSelected ? "active" : ""}" onclick="selectMerchantInnerCategory('all')">كل أقسامه <span class="merchant-inner-cat-count">${merchantProducts.length}</span></button>`;

    catCounts.forEach((cnt, catKey) => {
        const label = CATEGORY_NAMES[catKey] || catKey;
        const activeCls = currentCategory === catKey ? "active" : "";
        html += `<button type="button" class="merchant-inner-cat-btn ${activeCls}" onclick="selectMerchantInnerCategory('${escapeHtmlAttr(catKey)}')">${escapeHtmlAttr(label)} <span class="merchant-inner-cat-count">${cnt}</span></button>`;
    });

    wrap.innerHTML = html;
}

function selectMerchantInnerCategory(catKey) {
    if (!currentMerchant) return;
    currentCategory = catKey || "all";
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => {
        el.classList.toggle("active", el.getAttribute("data-quick") === currentCategory);
    });
    renderProducts(currentCategory);
    scrollToProductsTop();
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

function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

window.addEventListener("popstate", () => {
    if (overlayStack.length > 0) {
        closeTopOverlay(true);
        return;
    }
    suppressHistoryStep = true;
    try {
        if (document.getElementById("imageModal")?.classList.contains("open")) {
            closeImageModal(true);
        } else if (document.getElementById("productOptionModal")?.classList.contains("open")) {
            closeProductOptionModal(true);
        } else if (document.getElementById("serviceInfoModal")?.classList.contains("open")) {
            closeServiceInfoModal(true);
        } else if (document.getElementById("becomeMerchantModal")?.classList.contains("open")) {
            closeBecomeMerchantModal(true);
        } else if (document.getElementById("confirmActionModal")?.classList.contains("open")) {
            closeConfirmModal(true, true);
        } else if (document.getElementById("cartDrawer")?.classList.contains("open")) {
            closeCart(true);
        } else if (document.getElementById("catsDrawer")?.classList.contains("open")) {
            closeCategoriesDrawer(true);
        }
    } finally {
        setTimeout(() => { suppressHistoryStep = false; }, 0);
    }
});

let scrollRafScheduled = false;
window.addEventListener("scroll", () => {
    if (scrollRafScheduled) return;
    scrollRafScheduled = true;
    requestAnimationFrame(() => {
        scrollRafScheduled = false;
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
    });
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
    if (!cleaned || !isSafeMediaOrUrl(cleaned)) return "";
    if (/^(https?:\/\/|data:image\/|blob:)/i.test(cleaned)) {
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

    const nextImgSrc = imgs[safeIdx];
    const isNextSoldOut = isProductImageSoldOut(product, nextImgSrc);
    if (imgEl) {
        imgEl.setAttribute("data-img-idx", String(safeIdx));
        imgEl.setAttribute("data-retry-step", "0");
        imgEl.style.opacity = "1";
        imgEl.removeAttribute("data-broken");
        imgEl.src = nextImgSrc;
        syncSoldOutOverlayOnElement(imgEl, isNextSoldOut);
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

function attachCardSwipeSupport(cardEl) {
    if (!cardEl || cardEl.dataset.swipeBound === "1") return;
    cardEl.dataset.swipeBound = "1";
    const imgBox = cardEl.querySelector(".product-img-box");
    if (!imgBox) return;

    let startX = 0;
    let startY = 0;
    imgBox.addEventListener("touchstart", e => {
        if (!e.touches || !e.touches[0]) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    imgBox.addEventListener("touchend", e => {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 38 && Math.abs(dx) > Math.abs(dy) * 1.35) {
            const product = PRODUCTS.find(p => p.id === cardEl.dataset.productId);
            const imgs = getProductImagesList(product);
            if (product && imgs.length > 1) {
                const imgEl = cardEl.querySelector(".product-img-box img");
                const cur = Number(imgEl?.getAttribute("data-img-idx") || "0");
                setCardImageByIndex(cardEl, product, cur + (dx < 0 ? 1 : -1));
            }
        }
    }, { passive: true });
}

function hydrateCardsInteractivity(rootEl = document) {
    rootEl.querySelectorAll(".product-card").forEach(attachCardSwipeSupport);
}

function isBagOrNonApparelProduct(product) {
    if (!product) return false;
    const text = normalizeText(`${product.title || ""} ${product.desc || ""} ${product.category || ""}`);
    return /(شنطه|شنط|حقيبه|حقائب|باك|كروس|توت|محفظه|مقلمه|بوكس|مج|كوب|كوبايات|كاس|كاسات|عطر|برفان|سبلاش|اسبلش|مخمرية|ساعه|اكسسوار|انسيال|سلسله|خاتم|مكرميه|مفارش|مفرش|سجاده|منشر|شماعه|صينيه|صواني)/.test(text);
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
        const formattedLabel = /جنيه| ج |EGP/i.test(label)
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
        const priceMatch = label.match(/(\d+(?:\.\d+)?)\s*(?:جنيه| ج |egp)/i);
        const parsed = priceMatch ? parseNumericPrice(priceMatch[1]) : 0;
        return { label, price: parsed > 0 ? parsed : (Number(fallbackPrice) || 0) };
    }
    if (typeof entry === "object") {
        const label = String(entry.label || entry.name || entry.title || entry.value || entry.size || "").trim();
        if (!label) return null;
        const rawP = entry.price ?? entry.cost ?? entry.amount ?? entry.salePrice;
        const parsed = rawP !== undefined && rawP !== null && String(rawP).trim() !== "" ? parseNumericPrice(rawP) : 0;
        const finalPrice = parsed > 0 ? parsed : (Number(fallbackPrice) || 0);
        const formattedLabel = (parsed > 0 && !/جنيه| ج |egp/i.test(label))
            ? `${label} (${finalPrice} جنيه)`
            : label;
        return { label: formattedLabel, price: finalPrice };
    }
    return null;
}

function resolveProductOptionHeading(product, fallback = "اختر المواصفات:") {
    if (!product || typeof product !== "object") return fallback;
    const customLabel = String(
        product.sizeLabel || product.optionLabel || product.variantLabel || product.choiceLabel || ""
    ).trim();
    if (customLabel) {
        return customLabel.endsWith(":") ? customLabel : `${customLabel}:`;
    }
    if (Array.isArray(product.options) && product.options.length) {
        const firstOpt = product.options.find(o => o && typeof o === "object" && (o.label || o.name || o.title));
        if (firstOpt) {
            const lbl = String(firstOpt.label || firstOpt.name || firstOpt.title).trim();
            if (lbl) return lbl.endsWith(":") ? lbl : `${lbl}:`;
        }
    }
    const apparelCats = ["women", "men", "kids"];
    const isApparel = !isBagOrNonApparelProduct(product) && (
        apparelCats.includes(product.category) ||
        (Array.isArray(product.categories) && product.categories.some(c => apparelCats.includes(c)))
    );
    return isApparel ? "اختر المقاس:" : fallback;
}

function resolveProductColorHeading(product, fallback = "اختر اللون:") {
    if (!product || typeof product !== "object") return fallback;
    const customColorLabel = String(product.colorLabel || "").trim();
    if (customColorLabel) {
        return customColorLabel.endsWith(":") ? customColorLabel : `${customColorLabel}:`;
    }
    return fallback;
}

function resolveCartOptionShortTag(product) {
    if (!product || typeof product !== "object") return "الاختيار";
    const customLabel = String(
        product.sizeLabel || product.optionLabel || product.variantLabel || product.choiceLabel || ""
    ).trim();
    if (customLabel) {
        return customLabel.replace(/^اختر\s+/, "").replace(/:+$/, "").trim() || "الاختيار";
    }
    const apparelCats = ["women", "men", "kids"];
    const isApparel = !isBagOrNonApparelProduct(product) && (
        apparelCats.includes(product.category) ||
        (Array.isArray(product.categories) && product.categories.some(c => apparelCats.includes(c)))
    );
    return isApparel ? "المقاس" : "الاختيار";
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
    }

    if (config.sizes && config.sizes.length) {
        config.sizeHeading = resolveProductOptionHeading(product);
        config.shortTag = resolveCartOptionShortTag(product);
    }
    if (config.colors && config.colors.length) {
        config.colorHeading = resolveProductColorHeading(product);
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

function showToast(message) {
    showCaramelToast(message);
}

function isAppRunningStandalone() {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.navigator && window.navigator.standalone === true) return true;
    return false;
}

function getSavedAppliedBuildVersion() {
    try {
        return localStorage.getItem(APPLIED_BUILD_KEY) || "";
    } catch (e) {
        return "";
    }
}

function setSavedAppliedBuildVersion(ver) {
    try {
        localStorage.setItem(APPLIED_BUILD_KEY, String(ver || ""));
    } catch (e) {}
}

function syncHeaderInstallOrUpdateButton() {
    const headerBtn = document.getElementById("headerInstallBtn");
    if (!headerBtn) return;

    if (deferredInstallPrompt && !isAppRunningStandalone()) {
        headerBtn.textContent = "تثبيت";
        headerBtn.classList.add("visible");
        headerBtn.style.display = "inline-flex";
        headerBtn.setAttribute("aria-label", "تثبيت التطبيق");
    } else {
        headerBtn.textContent = "تثبيت";
        headerBtn.classList.remove("visible");
        headerBtn.style.display = "none";
    }
}

window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    syncHeaderInstallOrUpdateButton();
});

async function triggerInstallApp() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch (e) {}
    deferredInstallPrompt = null;
    syncHeaderInstallOrUpdateButton();
}

async function applyStoreUpdateAndHideButton() {
    const headerBtn = document.getElementById("headerInstallBtn");
    if (headerBtn) {
        headerBtn.disabled = true;
        headerBtn.textContent = "جاري التحديث...";
    }

    try {
        if ("serviceWorker" in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
                await reg.update().catch(() => {});
                if (reg.waiting) {
                    reg.waiting.postMessage({ type: "SKIP_WAITING" });
                }
            }
        }
        if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
    } catch (e) {}

    setSavedAppliedBuildVersion(APP_BUILD_VERSION);
    await syncLiveCatalogNow({ force: true, silentIfUnchanged: true });

    if (headerBtn) {
        headerBtn.disabled = false;
    }
    syncHeaderInstallOrUpdateButton();
    showCaramelToast("تم تحديث الكتالوج والتطبيق بنجاح ✓");
}

function handleInstallOrUpdateAction() {
    triggerInstallApp();
}

window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    setSavedAppliedBuildVersion(APP_BUILD_VERSION);
    syncHeaderInstallOrUpdateButton();
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
    if (isAppRunningStandalone() && !getSavedAppliedBuildVersion()) {
        setSavedAppliedBuildVersion(APP_BUILD_VERSION);
    }
    syncHeaderInstallOrUpdateButton();

    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", async () => {
        try {
            const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" });
            if (reg.waiting && navigator.serviceWorker.controller) {
                reg.waiting.postMessage({ type: "SKIP_WAITING" });
            }
            reg.update().catch(() => {});
            reg.addEventListener("updatefound", () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener("statechange", () => {
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                        newWorker.postMessage({ type: "SKIP_WAITING" });
                        syncLiveCatalogNow({ force: true, silentIfUnchanged: true });
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
    all: "تشكيلة المتجر بالكامل",
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
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 4L8 18h8l-2 10 10-14h-8l2-10z"></path></svg>`;
        case "phones":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9.5" y="4.5" width="13" height="23" rx="2.8"></rect><path d="M14 7.5h4"></path><circle cx="16" cy="24" r="1" fill="${s}" stroke="none"></circle></svg>`;
        case "jewelry":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7l7 5 7-5"></path><circle cx="16" cy="18.5" r="7"></circle><path d="M16 14.5l2.2 2.2-2.2 2.2-2.2-2.2 2.2-2.2z"></path></svg>`;
        case "school":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="5" width="16" height="22" rx="2.5"></rect><path d="M10 11h8M10 15h6"></path><path d="M22 8l4 4-8 8-4 1 1-4 7-9z"></path></svg>`;
        case "home":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 14.5L16 5.5l11 9V26a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 5 26V14.5z"></path><path d="M13 27.5v-8h6v8"></path></svg>`;
        case "kids":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="16" cy="17" r="9.5"></circle><circle cx="13" cy="15.5" r="1.2" fill="${s}" stroke="none"></circle><circle cx="19" cy="15.5" r="1.2" fill="${s}" stroke="none"></circle><path d="M12.5 19.5c1.1 1.5 2.2 2.2 3.5 2.2s2.4-.7 3.5-2.2"></path><path d="M16 7.5c1.2-2 3-2 3.8-0.8"></path></svg>`;
        case "tafse":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7h16"></path><path d="M11 7v10c0 3 2.2 4.5 5 4.5s5-1.5 5-4.5V7"></path><path d="M12.5 21.5v5.5M16 21.5v6M19.5 21.5v5.5"></path></svg>`;
        case "men":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 7l5 3 5-3 4 4.5-3.5 3.5V26h-11V15L7 11.5 11 7z"></path></svg>`;
        case "women":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="16" cy="13" r="6.5"></circle><path d="M16 19.5v8M12.5 24.5h7"></path></svg>`;
        case "perfume":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="13" y="4.5" width="6" height="3.5" rx="1"></rect><rect x="9.5" y="10.5" width="13" height="16.5" rx="4.5"></rect><path d="M13 18.5h6"></path></svg>`;
        case "gifts":
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="14" width="19" height="12.5" rx="2"></rect><rect x="5" y="10.5" width="22" height="4" rx="1.5"></rect><path d="M16 10.5v16"></path><path d="M16 10.5c-1.8-3.5-6.2-3.8-6.2-1 0 1.8 3.5 1.4 6.2 1zm0 0c1.8-3.5 6.2-3.8 6.2-1 0 1.8-3.5 1.4-6.2 1z"></path></svg>`;
        default:
            return `<svg viewBox="0 0 32 32" fill="none" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8.5" height="8.5" rx="2"></rect><rect x="18" y="5.5" width="8.5" height="8.5" rx="2"></rect><rect x="5.5" y="18" width="8.5" height="8.5" rx="2"></rect><rect x="18" y="18" width="8.5" height="8.5" rx="2"></rect></svg>`;
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
    if (/(كشكول|نوت بوك|دفتر|قلم|اقلام|استيكه|برايه|مسطره|كراسه|دفتر|ملف|مكتب|سبوره|الوان|مدرس|مكتبي|قرطاسيه)/.test(combined)) return "school";
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
    const skipKeys = new Set(["id", "code", "sku", "img", "image", "photo", "imgUrl", "imageUrl", "thumbnail", "thumb", "picture", "pic", "images", "photos", "imgs", "gallery", "url", "link", "download_url", "merchant", "seller", "vendor", "store", "owner"]);
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
    const priceLabel = rawItem.priceLabel || (typeof rawPriceVal === "string" && /[a-zA-Z؀-ۿ]/.test(rawPriceVal) ? rawPriceVal.trim() : "");
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
    normalized.outOfStock = Boolean(rawItem.outOfStock) || (typeof rawItem.stock === "number" && rawItem.stock <= 0);
    normalized.soldOutImages = Array.isArray(rawItem.soldOutImages)
        ? rawItem.soldOutImages.map(u => normalizeProductImageUrl(u)).filter(Boolean)
        : [];
    normalized.categories = Array.from(new Set([...existingExtraCats, ...inferAdditionalCategoriesSmartly(resolvedCategory, itemTitle, itemDesc)]));
    return normalized;
}

const PRODUCTS = [];

function computeCatalogSignature(productsList) {
    return (productsList || []).map(p => [
        p.id,
        p.title,
        p.price,
        p.priceLabel || "",
        p.merchant || "",
        p.category || "",
        p.badge || "",
        p.outOfStock ? 1 : 0,
        (p.images || []).join(","),
        (p.soldOutImages || []).join(",")
    ].join("|")).join("||");
}

async function discoverMerchantJsonSources(forceRefresh = false) {
    const sourcesMap = new Map();
    const qSuffix = `?ts=${Date.now()}&r=${Math.random().toString(36).slice(2, 7)}`;

    const registerJsonPath = (relPath, customDownloadUrl = "") => {
        const normalizedPath = String(relPath || "").replace(/^\.?\/+/, "").trim();
        if (!normalizedPath || !/\.json$/i.test(normalizedPath)) return;
        const key = normalizedPath.toLowerCase();
        if (!sourcesMap.has(key)) {
            const fileName = normalizedPath.split("/").pop();
            const slug = fileName.replace(/\.json$/i, "");
            const safeCustomUrl = isSafeMediaOrUrl(customDownloadUrl) ? customDownloadUrl : "";
            sourcesMap.set(key, {
                slug,
                localUrl: normalizedPath,
                rawUrl: safeCustomUrl || `https://raw.githubusercontent.com/${GITHUB_MERCHANTS_CONFIG.owner}/${GITHUB_MERCHANTS_CONFIG.repo}/${GITHUB_MERCHANTS_CONFIG.branch}/${normalizedPath}`,
                defaultMerchant: resolveMerchantNameFromFile(fileName)
            });
        }
    };

    let loadedManifest = false;
    try {
        const indexJsonResp = await fetch(`./merchants/index.json${qSuffix}`, { cache: "no-store" });
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
            loadedManifest = fileEntries.length > 0;
        }
    } catch (e) {}

    if (!loadedManifest) {
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
    }

    FALLBACK_MERCHANT_FILES.forEach(path => registerJsonPath(path));
    return Array.from(sourcesMap.values());
}

async function fetchJsonWithFallback(source, forceRefresh = false) {
    const qSuffix = `?ts=${Date.now()}&r=${Math.random().toString(36).slice(2, 7)}`;
    const urlsToTry = [
        `${source.localUrl}${qSuffix}`,
        `${source.rawUrl}${qSuffix}`
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

async function loadMerchantProductsFromJson(forceRefresh = false, options = {}) {
    const { silentIfUnchanged = false, showToastOnChange = false } = options;
    if (isSyncingCatalogNow) return false;
    isSyncingCatalogNow = true;

    const hadProductsBefore = PRODUCTS.length > 0;
    if (!hadProductsBefore) {
        isLoadingJsonProducts = true;
        renderProducts(currentCategory);
    }

    try {
        await loadStoreConfigFromJson(!hadProductsBefore);

        const merchantSources = await discoverMerchantJsonSources(true);
        const jsonProductsById = new Map();

        const fetchedPayloads = await Promise.all(
            merchantSources.map(async source => ({
                source,
                payload: await fetchJsonWithFallback(source, true)
            }))
        );

        fetchedPayloads.forEach(({ source, payload }) => {
            if (!payload) return;
            const { items, fileMerchant, fileStyle } = extractRawItemsFromJsonPayload(payload, source.defaultMerchant);
            const slugPrefix = source.slug.replace(/[^a-z0-9؀-ۿ]/gi, "-");

            items.forEach((rawItem, idx) => {
                const normalized = normalizeRawJsonProduct(rawItem, idx, slugPrefix, fileMerchant, fileStyle);
                if (!normalized) return;
                const uniqueKey = `${slugPrefix}::${normalized.id}`;
                jsonProductsById.set(uniqueKey, normalized);
            });
        });

        const loadedList = Array.from(jsonProductsById.values());
        const nextSignature = computeCatalogSignature(loadedList);
        const hasCatalogChanged = nextSignature !== lastCatalogSnapshotSignature;

        if (hasCatalogChanged || !hadProductsBefore) {
            PRODUCTS.splice(0, PRODUCTS.length, ...loadedList);
            lastCatalogSnapshotSignature = nextSignature;
            rebuildSearchIndex();
            isLoadingJsonProducts = false;

            renderMerchantsQuickStrip();
            renderSmartSearchSuggestions();
            renderSpotlightBoxes();
            renderProducts(currentCategory);
            updateCartUI();
            updateWishlistUI();

            if (!hadProductsBefore) {
                applyUrlDeepLinkParams();
            } else if (showToastOnChange && !silentIfUnchanged) {
                showCaramelToast("تم تحديث المنتجات تلقائياً ✓");
            }
        } else {
            isLoadingJsonProducts = false;
        }

        lastCatalogSyncAt = Date.now();
        return hasCatalogChanged;
    } finally {
        isSyncingCatalogNow = false;
    }
}

async function syncLiveCatalogNow({ force = false, silentIfUnchanged = true, showToastOnChange = true } = {}) {
    if (document.hidden && !force) return false;
    const now = Date.now();
    if (!force && now - lastCatalogSyncAt < LIVE_CATALOG_MIN_GAP_MS) return false;
    try {
        return await loadMerchantProductsFromJson(true, { silentIfUnchanged, showToastOnChange });
    } catch (e) {
        return false;
    }
}

function startLiveCatalogAutoSync() {
    if (liveCatalogPollTimer) clearInterval(liveCatalogPollTimer);

    liveCatalogPollTimer = setInterval(() => {
        if (document.visibilityState === "visible") {
            syncLiveCatalogNow({ force: false, silentIfUnchanged: false, showToastOnChange: true });
        }
    }, LIVE_CATALOG_POLL_MS);

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            syncLiveCatalogNow({ force: true, silentIfUnchanged: false, showToastOnChange: true });
        }
    });

    window.addEventListener("focus", () => {
        syncLiveCatalogNow({ force: false, silentIfUnchanged: false, showToastOnChange: true });
    }, { passive: true });

    window.addEventListener("online", () => {
        syncLiveCatalogNow({ force: true, silentIfUnchanged: false, showToastOnChange: true });
    }, { passive: true });
}

function applyUrlDeepLinkParams() {
    try {
        const params = new URLSearchParams(window.location.search || "");
        const productParam = (params.get("product") || "").trim();
        const catParam = (params.get("category") || "").trim();
        const merchantParam = (params.get("merchant") || "").trim();

        if (catParam && CATEGORY_NAMES[catParam]) {
            const tabEl = document.querySelector(`.quick-top-tabs .quick-tab-item[data-quick="${catParam}"]`);
            filterByCategory(catParam, tabEl || null, true);
        }

        if (merchantParam && PRODUCTS.length) {
            const matchedMerchant = PRODUCTS.find(p => normalizeText(p.merchant) === normalizeText(merchantParam))?.merchant || merchantParam;
            filterByMerchant(matchedMerchant, true);
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
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            showCaramelToast(`تم نسخ رابط صفحة ${currentMerchant}`);
        }).catch(() => {
            launchWhatsAppTarget(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
        });
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
        const cleanPath = currentSrc.replace(/^\.\//, "").replace(/^\/+/, "");
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

function syncMyDataButtonBadge() {
    const btn = document.getElementById("myDataTopBtn");
    if (!btn) return;
    try {
        const raw = localStorage.getItem(CUSTOMER_PROFILE_KEY);
        const prof = raw ? JSON.parse(raw) : null;
        const hasSaved = Boolean(prof && (prof.name || prof.phone));
        btn.classList.toggle("has-data", hasSaved);
    } catch (e) {}
}

function toggleProfileEditorPanel(forceOpen = null) {
    const panel = document.getElementById("myDataEditorPanel");
    const btn = document.getElementById("myDataTopBtn");
    if (!panel) return;
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : panel.classList.contains("is-hidden");
    panel.classList.toggle("is-hidden", !shouldOpen);
    if (btn) btn.classList.toggle("active", shouldOpen);
}

function saveCustomerProfileFromPanel() {
    const nameInput = document.getElementById("checkoutCustomerName");
    const phoneInput = document.getElementById("checkoutCustomerPhone");
    const addrInput = document.getElementById("checkoutCustomerAddress");
    const nameVal = (nameInput?.value || "").trim();
    const phoneVal = (phoneInput?.value || "").trim();
    const addrVal = (addrInput?.value || "").trim();

    if (!nameVal && !phoneVal) {
        showCaramelToast("اكتب الاسم أو رقم التواصل أولاً");
        return;
    }

    saveCustomerProfileInputs(nameVal, phoneVal, addrVal);
    syncMyDataButtonBadge();
    toggleProfileEditorPanel(false);
    showCaramelToast("تم حفظ بياناتك بنجاح");
}

function syncCartTabFooterVisibility() {
    const isCartTab = activeCartOrdersTab === "cart";
    const totalRow = document.getElementById("currentCartTotalRow");
    const checkoutActions = document.getElementById("currentCartCheckoutActions");
    const quickOrdersActions = document.getElementById("ordersTabQuickActions");
    const cartBody = document.getElementById("cartDrawerPagesContainer");

    if (totalRow) totalRow.classList.toggle("is-hidden", !isCartTab);
    if (checkoutActions) checkoutActions.classList.toggle("is-hidden", !isCartTab);
    if (quickOrdersActions) quickOrdersActions.classList.toggle("is-hidden", isCartTab);
    if (cartBody) cartBody.scrollTop = 0;
}

function switchCartOrdersTab(tabName) {
    if (tabName === "received") activeCartOrdersTab = "received";
    else if (tabName === "pending") activeCartOrdersTab = "pending";
    else activeCartOrdersTab = "cart";

    const cartBtn = document.getElementById("tabBtnCurrentCart");
    const pendingBtn = document.getElementById("tabBtnPendingOrders");
    const receivedBtn = document.getElementById("tabBtnReceivedOrders");
    const currentCartSec = document.getElementById("currentCartSection");
    const pendingSec = document.getElementById("activeOrdersSection");
    const receivedSec = document.getElementById("receivedOrdersSection");

    if (cartBtn) cartBtn.classList.toggle("active", activeCartOrdersTab === "cart");
    if (pendingBtn) pendingBtn.classList.toggle("active", activeCartOrdersTab === "pending");
    if (receivedBtn) receivedBtn.classList.toggle("active", activeCartOrdersTab === "received");

    if (currentCartSec) currentCartSec.classList.toggle("is-hidden", activeCartOrdersTab !== "cart");
    if (pendingSec) pendingSec.classList.toggle("is-hidden", activeCartOrdersTab !== "pending");
    if (receivedSec) receivedSec.classList.toggle("is-hidden", activeCartOrdersTab !== "received");

    syncCartTabFooterVisibility();
}

function loadCustomerProfileToInputs() {
    try {
        const raw = localStorage.getItem(CUSTOMER_PROFILE_KEY);
        if (!raw) {
            syncMyDataButtonBadge();
            return;
        }
        const prof = JSON.parse(raw);
        const nameEl = document.getElementById("checkoutCustomerName");
        const phoneEl = document.getElementById("checkoutCustomerPhone");
        const addrEl = document.getElementById("checkoutCustomerAddress");
        if (nameEl && prof.name && !nameEl.value) nameEl.value = prof.name;
        if (phoneEl && prof.phone && !phoneEl.value) phoneEl.value = prof.phone;
        if (addrEl && prof.address && !addrEl.value) addrEl.value = prof.address;
    } catch (e) {}
    syncMyDataButtonBadge();
}

function saveCustomerProfileInputs(name, phone, address = "") {
    try {
        localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify({
            name: String(name || "").trim(),
            phone: String(phone || "").trim(),
            address: String(address || "").trim()
        }));
    } catch (e) {}
    syncMyDataButtonBadge();
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
    const arabicMap = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
    const persianMap = { "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
    return String(str || "")
        .replace(/[٠-٩]/g, ch => arabicMap[ch] || ch)
        .replace(/[۰-۹]/g, ch => persianMap[ch] || ch);
}

function normalizeText(str) {
    return normalizeArabicDigits(String(str || ""))
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670]/g, "")
        .replace(/[إأآا]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/[^\u0621-\u064A0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getWordVariants(word) {
    const w = normalizeText(word);
    if (!w) return [];
    const set = new Set([w]);

    const synList = SEARCH_SYNONYMS[w] || SEARCH_SYNONYMS[word] || [];
    synList.forEach(s => {
        const ns = normalizeText(s);
        if (ns) set.add(ns);
    });

    if (w.startsWith("ال") && w.length > 3) set.add(w.slice(2));
    else if (w.length >= 2) set.add("ال" + w);

    if (w.endsWith("ات") && w.length > 4) {
        const stem = w.slice(0, -2);
        set.add(stem);
        set.add(stem + "ه");
    }
    if (w.endsWith("ين") && w.length > 4) set.add(w.slice(0, -2));
    if (w.endsWith("ون") && w.length > 4) set.add(w.slice(0, -2));
    if (w.endsWith("ه") && w.length > 3) {
        set.add(w.slice(0, -1));
        set.add(w + "ات");
    }
    if (w.endsWith("ي") && w.length > 3) set.add(w.slice(0, -1) + "ه");
    return Array.from(set);
}

function isFuzzyTokenMatch(token, targetWords) {
    if (!token || token.length < 3) return false;
    for (const tw of targetWords) {
        if (!tw || Math.abs(tw.length - token.length) > 2) continue;
        if (tw.includes(token) || token.includes(tw)) return true;
        if (token.length >= 4 && tw.length >= 4) {
            let mismatches = 0;
            const minLen = Math.min(token.length, tw.length);
            for (let i = 0; i < minLen; i++) {
                if (token[i] !== tw[i]) mismatches++;
                if (mismatches > 1) break;
            }
            if (mismatches <= 1) return true;
        }
    }
    return false;
}

const searchIndexByProductId = new Map();

function rebuildSearchIndex() {
    searchIndexByProductId.clear();
    PRODUCTS.forEach(p => {
        const rawCombined = [
            p.title || "",
            p.desc || "",
            p.merchant || "",
            p.badge || "",
            CATEGORY_NAMES[p.category] || "",
            p._extraSearchText || ""
        ].join(" ");
        const norm = normalizeText(rawCombined);
        const words = Array.from(new Set(norm.split(" ").filter(Boolean)));
        searchIndexByProductId.set(p.id, { norm, words });
    });
}

function scoreProductSearch(product, rawQuery) {
    const cleanQuery = normalizeText(rawQuery);
    if (!cleanQuery) return 1;

    const indexed = searchIndexByProductId.get(product.id);
    const norm = indexed ? indexed.norm : normalizeText(`${product.title || ""} ${product.desc || ""} ${product.merchant || ""} ${product.badge || ""} ${CATEGORY_NAMES[product.category] || ""}`);
    const targetWords = indexed ? indexed.words : norm.split(" ").filter(Boolean);
    const titleNorm = normalizeText(product.title || "");
    const merchantNorm = normalizeText(product.merchant || "");
    const descNorm = normalizeText(product.desc || "");

    const tokens = cleanQuery.split(" ").filter(Boolean);
    let totalScore = 0;

    if (titleNorm.includes(cleanQuery)) totalScore += 120;
    else if (norm.includes(cleanQuery)) totalScore += 75;

    for (const tok of tokens) {
        const variants = getWordVariants(tok);
        let tokScore = 0;

        for (const v of variants) {
            if (titleNorm.includes(v)) {
                tokScore = Math.max(tokScore, 45);
                if (titleNorm.startsWith(v) || titleNorm.includes(" " + v)) tokScore += 12;
            } else if (merchantNorm.includes(v)) {
                tokScore = Math.max(tokScore, 36);
            } else if (descNorm.includes(v)) {
                tokScore = Math.max(tokScore, 24);
            } else if (norm.includes(v)) {
                tokScore = Math.max(tokScore, 18);
            }
        }

        if (tokScore === 0 && isFuzzyTokenMatch(tok, targetWords)) {
            tokScore = 14;
        }

        if (tokScore === 0) return 0;
        totalScore += tokScore;
    }

    return totalScore;
}

function getSearchQuery() {
    const input = document.getElementById("homeSearchInput");
    return input ? input.value.trim() : "";
}

function syncSearchCancelButton() {
    const cancelBtn = document.getElementById("searchCancelBtn");
    if (!cancelBtn) return;
    cancelBtn.style.display = getSearchQuery().length > 0 ? "inline-flex" : "none";
}

function handleSearchInput() {
    syncSearchCancelButton();
    debouncedSearchRender();
}

const debouncedSearchRender = createDebounced(() => {
    performSearchRender();
}, 160);

function handleSearchKeyDown(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        saveSearchTermToHistory(getSearchQuery());
        renderSmartSearchSuggestions();
        performSearchRender();
        scrollToProductsTop();
    } else if (event.key === "Escape") {
        cancelSearchMode();
    }
}

function performSearchRender() {
    syncSearchCancelButton();
    renderProducts(currentCategory);
}

function cancelSearchMode(event) {
    if (event) event.stopPropagation();
    const input = document.getElementById("homeSearchInput");
    if (input) input.value = "";
    syncSearchCancelButton();
    renderProducts(currentCategory);
}

function updateSearchSummaryUI(query, count) {
    const bar = document.getElementById("searchResultsSummaryBar");
    const textEl = document.getElementById("searchResultsSummaryText");
    if (!bar || !textEl) return;
    if (!query) {
        bar.classList.remove("visible");
        textEl.textContent = "";
        return;
    }
    bar.classList.add("visible");
    if (count > 0) {
        textEl.innerHTML = `نتائج البحث عن <strong>"${escapeHtml(query)}"</strong> (${count} منتج)`;
    } else {
        textEl.innerHTML = `لا توجد نتائج مطابقة لـ <strong>"${escapeHtml(query)}"</strong>`;
    }
}

function trackProductInterest(product, weight = 1, markSeen = false) {
    if (!product) return;
    if (product.category) {
        interestData.categories[product.category] = (interestData.categories[product.category] || 0) + weight;
    }
    const words = normalizeText(product.title || "").split(" ").filter(w => w.length >= 3);
    words.slice(0, 4).forEach(w => {
        interestData.keywords[w] = (interestData.keywords[w] || 0) + weight;
    });
    if (markSeen && product.id && !interestData.seenIds.includes(product.id)) {
        interestData.seenIds.push(product.id);
        if (interestData.seenIds.length > 60) interestData.seenIds.shift();
    }
    saveInterest();
}

function isDealProduct(p) {
    if (!p) return false;
    if (p.category === "deals" || (Array.isArray(p.categories) && p.categories.includes("deals"))) return true;
    const nPrice = Number(p.price) || 0;
    const badgeText = String(p.badge || "");
    if (nPrice > 0 && nPrice <= 180) return true;
    return /اقتصادي|عرض|توفير|خصم|سعر مميز/i.test(badgeText);
}

function isNewArrivalProduct(p) {
    if (!p) return false;
    if (p.category === "new" || (Array.isArray(p.categories) && p.categories.includes("new"))) return true;
    return /جديد|وصل حديثاً|مدخلات جديدة/i.test(String(p.badge || ""));
}

function computeProductScore(product, index) {
    let score = 0;
    const catWeight = interestData.categories[product.category] || 0;
    score += catWeight * 12;

    const titleWords = normalizeText(product.title || "").split(" ").filter(w => w.length >= 3);
    for (const w of titleWords) {
        if (interestData.keywords[w]) score += interestData.keywords[w] * 6;
    }

    if (currentFeedMode === "new" && isNewArrivalProduct(product)) score += 45;
    if (currentFeedMode === "deals" && isDealProduct(product)) score += 45;
    if (interestData.seenIds.includes(product.id)) score -= 8;

    const jitterSeed = Math.sin((index + 1) * 9301 + interestData.sessionRoll * 49297);
    score += jitterSeed * 14;
    return score;
}

function getFilteredProducts(category, skipPriceFilter = false) {
    let list = [...PRODUCTS];

    if (onlyFavoritesMode) {
        const favSet = new Set(wishlistIds);
        list = list.filter(p => favSet.has(String(p.id)));
    }

    if (currentMerchant) {
        list = list.filter(p => p.merchant === currentMerchant);
    }

    if (category && category !== "all") {
        list = list.filter(p => p.category === category || (Array.isArray(p.categories) && p.categories.includes(category)));
    }

    if (currentFeedMode === "deals") {
        list = list.filter(isDealProduct);
    } else if (currentFeedMode === "new") {
        const newOnly = list.filter(isNewArrivalProduct);
        if (newOnly.length > 0) list = newOnly;
    }

    if (!skipPriceFilter && currentMaxPrice > 0) {
        if (currentMaxPrice > 1000) {
            list = list.filter(p => (Number(p.price) || 0) > 1000);
        } else {
            list = list.filter(p => (Number(p.price) || 0) > 0 && (Number(p.price) || 0) <= currentMaxPrice);
        }
    }

    const query = getSearchQuery();
    if (query) {
        list = list
            .map(p => ({ product: p, searchScore: scoreProductSearch(p, query) }))
            .filter(entry => entry.searchScore > 0)
            .sort((a, b) => b.searchScore - a.searchScore)
            .map(entry => entry.product);
    } else if (currentSortMode === "price-asc") {
        list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (currentSortMode === "price-desc") {
        list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (isFullSelectionMode()) {
        list.sort((a, b) => computeProductScore(b, 0) - computeProductScore(a, 0));
    } else {
        const scored = list.map((p, idx) => ({ p, s: computeProductScore(p, idx) }));
        scored.sort((a, b) => b.s - a.s);
        list = interleaveMerchantsSmartly(scored.map(item => item.p));
    }

    return list;
}

function getAllAvailableProductsForContinuation() {
    let pool = [...PRODUCTS];
    if (currentMerchant) {
        pool = pool.filter(p => p.merchant === currentMerchant);
    } else if (currentCategory && currentCategory !== "all") {
        pool = pool.filter(p => p.category === currentCategory || (Array.isArray(p.categories) && p.categories.includes(currentCategory)));
    }
    return interleaveMerchantsSmartly(shuffleArray(pool));
}

function createProductCardHTML(product, badgeText = "", isContinuation = false) {
    const safeId = escapeHtmlAttr(product.id);
    const safeTitle = escapeHtml(product.title);
    const safeDesc = escapeHtml(product.desc || "");
    const safeMerchant = escapeHtml(product.merchant || "");
    const safeMerchantAttr = escapeHtmlAttr(product.merchant || "");
    const displayPrice = formatPriceNumber(product.priceLabel || product.price);
    const imgs = getProductImagesList(product);
    const primaryImg = imgs[0] || "";
    const hasMultipleImgs = imgs.length > 1;
    const isFav = wishlistIds.includes(String(product.id));
    const isProductSoldOut = isProductOutOfStock(product);
    const isFirstImgSoldOut = isProductImageSoldOut(product, primaryImg);

    const cardStyleClass = product.cardStyle === "gold" || product.cardStyle === "featured"
        ? "card-style-gold"
        : (product.cardStyle === "soft" ? "card-style-soft" : "");
    const finalBadge = badgeText || product.badge || "";

    const waHref = escapeHtmlAttr(buildProductWhatsAppUrl(product, primaryImg));

    return `
        <article class="product-card ${cardStyleClass} ${isProductSoldOut ? "is-product-soldout" : ""}" data-product-id="${safeId}" onmouseenter="startCardAutoSlide(this, '${safeId}')" onmouseleave="stopCardAutoSlide()">
            ${finalBadge ? `<span class="card-json-badge">${escapeHtml(finalBadge)}</span>` : ""}
            <button type="button" class="fav-toggle-btn ${isFav ? "active" : ""}" data-fav-id="${safeId}" aria-label="إضافة إلى المفضلة" aria-pressed="${isFav}" onclick="toggleProductFavorite('${safeId}', this, event)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            <div class="product-img-box" onclick="openCardProductPreview(this, '${safeId}')">
                <div class="media-soldout-wrap ${isFirstImgSoldOut ? "is-soldout" : ""}">
                    <img src="${escapeHtmlAttr(primaryImg)}" alt="${safeTitle}" data-img-idx="0" data-retry-step="0" loading="${isContinuation ? "eager" : "lazy"}" decoding="async" onerror="handleProductImageError(this, '${safeId}')">
                    <span class="soldout-badge-overlay ${isFirstImgSoldOut ? "" : "is-hidden"}">نفدت الكمية</span>
                </div>
                ${hasMultipleImgs ? `
                    <button type="button" class="card-img-nav-btn prev" aria-label="الصورة السابقة" onclick="cycleCardImage(this, '${safeId}', -1, event)">›</button>
                    <button type="button" class="card-img-nav-btn next" aria-label="الصورة التالية" onclick="cycleCardImage(this, '${safeId}', 1, event)">‹</button>
                    <span class="card-img-counter">1/${imgs.length}</span>
                    <div class="card-img-dots">
                        ${imgs.map((_, idx) => `<button type="button" class="card-img-dot ${idx === 0 ? "active" : ""}" aria-label="صورة ${idx + 1}" onclick="jumpCardImage(this, '${safeId}', ${idx}, event)"></button>`).join("")}
                    </div>
                ` : ""}
            </div>
            <div class="product-details">
                <div>
                    ${safeMerchant ? `<div class="product-merchant-row"><button type="button" class="product-merchant-link" onclick="filterByMerchant('${safeMerchantAttr}')">${safeMerchant}</button></div>` : ""}
                    <div class="product-title">${safeTitle}</div>
                    <div class="product-price-row">
                        <div class="product-price">${displayPrice} <span>جنيه</span></div>
                        ${product.subPrice ? `<span class="product-sub">${escapeHtml(product.subPrice)}</span>` : ""}
                    </div>
                    ${safeDesc ? `<p class="product-desc">${safeDesc}</p>` : ""}
                </div>
                <div class="card-btns">
                    <button type="button" class="add-cart-btn ${isProductSoldOut ? "is-disabled" : ""}" ${isProductSoldOut ? "disabled aria-disabled=\"true\"" : ""} onclick="${isProductSoldOut ? "return false;" : `handleAddToCartClick('${safeId}', this)`}">${isProductSoldOut ? "نفدت الكمية" : "أضف للسلة"}</button>
                    <a href="${waHref}" target="_blank" rel="noopener noreferrer" class="direct-wa-link" onclick="event.preventDefault(); launchWhatsAppTarget(this.href);">واتساب</a>
                </div>
            </div>
        </article>
    `;
}

function renderSkeletonCards(count = 8) {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    let html = "";
    for (let i = 0; i < count; i++) {
        html += `
            <article class="product-card skeleton-card" aria-hidden="true">
                <div class="product-img-box skeleton-shimmer"></div>
                <div class="product-details">
                    <div class="skeleton-line skeleton-shimmer h-14 w-82"></div>
                    <div class="skeleton-line skeleton-shimmer h-18 w-45 mt-6"></div>
                    <div class="skeleton-line skeleton-shimmer h-12 w-65 mt-6"></div>
                    <div class="skeleton-line skeleton-shimmer h-34 w-100 mt-10 rounded-12"></div>
                </div>
            </article>
        `;
    }
    grid.innerHTML = html;
}

function updateMerchantStorefrontBanner(filteredCount = null) {
    const banner = document.getElementById("activeMerchantBanner");
    const avatarEl = document.getElementById("merchantAvatarInitial");
    const nameEl = document.getElementById("merchantBannerName");
    const countEl = document.getElementById("merchantBannerCount");
    if (!banner || !nameEl || !countEl) return;

    if (!currentMerchant) {
        banner.classList.remove("visible");
        document.body.classList.remove("merchant-storefront-mode");
        renderMerchantInnerCategories("");
        return;
    }

    const totalMerchantCount = PRODUCTS.filter(p => p.merchant === currentMerchant).length;
    const shownCount = typeof filteredCount === "number" ? filteredCount : totalMerchantCount;
    const firstChar = Array.from(currentMerchant.trim())[0] || "ت";

    if (avatarEl) avatarEl.textContent = firstChar;
    nameEl.textContent = currentMerchant;
    countEl.textContent = (currentCategory && currentCategory !== "all")
        ? `يعرض ${shownCount} منتج في قسم "${CATEGORY_NAMES[currentCategory] || currentCategory}" (إجمالي منتجات التاجر: ${totalMerchantCount})`
        : `يعرض جميع منتجات التاجر (${shownCount} منتج متاح)`;
    banner.classList.add("visible");
    document.body.classList.add("merchant-storefront-mode");
    renderMerchantInnerCategories(currentMerchant);
}

function renderProducts(category = "all") {
    currentCategory = category || "all";
    applyCategoryPageMood(currentCategory);

    const grid = document.getElementById("productsGrid");
    const heading = document.getElementById("activeCategoryTitle");
    const countBadge = document.getElementById("resultsCountBadge");
    const query = getSearchQuery();

    if (!grid) return;

    if (isLoadingJsonProducts && !PRODUCTS.length) {
        updateMerchantStorefrontBanner(0);
        if (heading) heading.textContent = "جاري تحميل منتجات المتجر...";
        if (countBadge) countBadge.classList.add("is-hidden");
        renderSkeletonCards(8);
        return;
    }

    const pricePool = PRODUCTS.filter(p => {
        if (onlyFavoritesMode && !wishlistIds.includes(String(p.id))) return false;
        if (currentMerchant && p.merchant !== currentMerchant) return false;
        if (currentCategory && currentCategory !== "all") {
            return p.category === currentCategory || (Array.isArray(p.categories) && p.categories.includes(currentCategory));
        }
        return true;
    });
    renderSmartPriceChips(pricePool);

    currentFeedItems = getFilteredProducts(currentCategory);
    renderedCount = 0;
    feedCycle = 0;

    updateMerchantStorefrontBanner(currentFeedItems.length);

    if (heading) {
        const catLabel = CATEGORY_NAMES[currentCategory] || "الكل";
        const modeLabel = currentFeedMode === "new" ? " — مدخلات جديدة" : (currentFeedMode === "deals" ? " — أسعار اقتصادية" : " — من أجلك");
        if (onlyFavoritesMode) {
            heading.textContent = `المفضلة (${currentFeedItems.length})`;
        } else if (currentMerchant) {
            heading.textContent = `${currentMerchant}${currentCategory !== "all" ? ` — ${catLabel}` : ""}`;
        } else if (query) {
            heading.textContent = `نتائج البحث: ${query}`;
        } else {
            heading.textContent = `${catLabel}${modeLabel}`;
        }
    }

    if (countBadge) {
        if (currentMerchant || currentCategory !== "all" || onlyFavoritesMode || query || currentMaxPrice > 0 || currentFeedMode !== "for-you") {
            countBadge.textContent = `${currentFeedItems.length} منتج`;
            countBadge.classList.remove("is-hidden");
        } else {
            countBadge.classList.add("is-hidden");
        }
    }

    updateSearchSummaryUI(query, currentFeedItems.length);

    if (!currentFeedItems.length) {
        const hasPriceFilter = currentMaxPrice > 0;
        const hasSearchOrFilter = Boolean(query) || onlyFavoritesMode || currentFeedMode !== "for-you" || Boolean(currentMerchant);
        const emptyMsg = hasPriceFilter
            ? `لا توجد منتجات مطابقة لفلتر السعر (${currentMaxPrice > 1000 ? "أكثر من 1000 ج" : `حتى ${currentMaxPrice} ج`}) في هذا القسم.`
            : "لم يتم العثور على منتجات مطابقة لاختياراتك الحالية.";

        grid.innerHTML = `
            <div class="empty-state-box">
                <p class="empty-state-msg">${escapeHtml(emptyMsg)}</p>
                <div class="empty-state-actions">
                    ${hasPriceFilter ? `<button type="button" class="continuation-load-more-btn" onclick="setPriceFilter(0)">عرض كل الأسعار</button>` : ""}
                    ${hasSearchOrFilter ? `<button type="button" class="continuation-load-more-btn" onclick="resetHomeFresh()">العودة لكل المنتجات</button>` : ""}
                </div>
            </div>
        `;
        renderContinuationSection(true);
        updateFeedSentinel();
        return;
    }

    const initialBatchSize = isFullSelectionMode() ? FULL_MODE_INITIAL_BATCH : BATCH_SIZE;
    appendNextProductsBatch(initialBatchSize);
    renderContinuationSection(true);
    updateFeedSentinel();
}

function appendNextProductsBatch(customCount = null) {
    if (isAppendingBatch) return;
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    if (!currentFeedItems.length) {
        updateFeedSentinel();
        return;
    }

    isAppendingBatch = true;
    try {
        const batchTarget = customCount || (isFullSelectionMode() ? FULL_MODE_INITIAL_BATCH : BATCH_SIZE);
        let htmlChunk = "";

        for (let i = 0; i < batchTarget; i++) {
            if (renderedCount >= currentFeedItems.length) {
                if (isFullSelectionMode()) break;
                feedCycle += 1;
                currentFeedItems = interleaveMerchantsSmartly(shuffleArray(currentFeedItems));
                renderedCount = 0;
                if (!currentFeedItems.length) break;
            }
            const prod = currentFeedItems[renderedCount];
            renderedCount += 1;
            const badge = feedCycle > 0 ? "مقترح لك" : "";
            htmlChunk += createProductCardHTML(prod, badge, false);
        }

        if (htmlChunk) {
            grid.insertAdjacentHTML("beforeend", htmlChunk);
            hydrateCardsInteractivity(grid);
        }
    } finally {
        isAppendingBatch = false;
        updateFeedSentinel();
    }
}

function renderContinuationSection(reset = false) {
    const wrap = document.getElementById("continuationAfterRecommendations");
    if (!wrap) return;

    if (isLoadingJsonProducts && !PRODUCTS.length) {
        wrap.innerHTML = "";
        return;
    }

    if (reset) {
        continuationItems = getAllAvailableProductsForContinuation();
        continuationBatchIndex = 0;
        continuationCursor = 0;
    }

    if (!continuationItems.length) {
        wrap.innerHTML = "";
        return;
    }

    const start = continuationCursor;
    const end = Math.min(start + CONTINUATION_STEP, continuationItems.length);
    const slice = continuationItems.slice(start, end);
    if (!slice.length && continuationCursor > 0) {
        continuationCursor = 0;
        return renderContinuationSection(false);
    }

    continuationCursor = end;
    continuationBatchIndex += 1;

    if (continuationBatchIndex === 1 || !document.getElementById("continuationAfterGrid")) {
        wrap.innerHTML = `
            <section class="continuation-after-section" aria-label="المزيد من المنتجات">
                <div class="continuation-after-header">
                    <h3>المزيد من المنتجات المختارة</h3>
                    <span class="smart-tag">متجر كارامل</span>
                </div>
                <div class="continuation-after-grid" id="continuationAfterGrid">
                    ${slice.map(p => createProductCardHTML(p, "", true)).join("")}
                </div>
                <div class="continuation-load-more-wrap">
                    <button type="button" class="continuation-load-more-btn" id="continuationLoadMoreBtn" onclick="loadMoreContinuationBatch()">عرض المزيد من المنتجات</button>
                </div>
            </section>
        `;
    } else {
        const contGrid = document.getElementById("continuationAfterGrid");
        if (contGrid) {
            contGrid.insertAdjacentHTML("beforeend", slice.map(p => createProductCardHTML(p, "", true)).join(""));
        }
    }
    hydrateCardsInteractivity(wrap);
}

function loadMoreContinuationBatch() {
    renderContinuationSection(false);
}

function updateFeedSentinel() {
    const sentinel = document.getElementById("feedSentinel");
    if (!sentinel) return;
    if (!currentFeedItems.length) {
        sentinel.textContent = "";
        return;
    }
    if (isFullSelectionMode()) {
        sentinel.textContent = renderedCount >= currentFeedItems.length
            ? `تم عرض جميع المنتجات (${currentFeedItems.length} منتج)`
            : "مرر للأسفل لعرض المزيد من المنتجات...";
    } else {
        sentinel.textContent = "استمر في التمرير لاكتشاف المزيد من المنتجات";
    }
}

function setupInfiniteScrollObserver() {
    const sentinel = document.getElementById("feedSentinel");
    if (!sentinel || !("IntersectionObserver" in window)) return;
    if (feedObserver) feedObserver.disconnect();

    feedObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && currentFeedItems.length > 0 && !isAppendingBatch) {
                if (!isFullSelectionMode() || renderedCount < currentFeedItems.length) {
                    appendNextProductsBatch();
                }
            }
        });
    }, { rootMargin: "260px 0px" });

    feedObserver.observe(sentinel);
}

function selectTopQuickTab(catKey, btnEl) {
    filterByCategory(catKey, btnEl, false);
    if (btnEl && typeof btnEl.scrollIntoView === "function") {
        btnEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
}

function filterByCategory(category, el = null, skipScroll = false) {
    currentCategory = category || "all";
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-quick") === currentCategory);
    });
    renderProducts(currentCategory);
    if (!skipScroll) scrollToProductsTop();
}

function filterByMerchant(merchantName, skipScroll = false) {
    const cleanName = String(merchantName || "").trim();
    if (!cleanName) return;
    currentMerchant = cleanName;
    currentCategory = "all";
    onlyFavoritesMode = false;
    updateWishlistUI();
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-quick") === "all");
    });
    renderMerchantsQuickStrip();
    renderProducts("all");
    if (!skipScroll) scrollToProductsTop();
    showCaramelToast(`أهلاً بك في صفحة ${cleanName}`);
}

function clearMerchantFilter(skipScroll = false) {
    currentMerchant = "";
    currentCategory = "all";
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-quick") === "all");
    });
    renderMerchantsQuickStrip();
    renderProducts("all");
    if (!skipScroll) scrollToProductsTop();
}

function setFeedMode(mode, btnEl = null) {
    currentFeedMode = mode || "for-you";
    document.querySelectorAll("#feedFilterPills .feed-pill-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-mode") === currentFeedMode);
    });
    renderProducts(currentCategory);
}

function scrollToProductsTop() {
    const heading = document.getElementById("productsSectionHeading");
    if (!heading) return;
    const header = document.querySelector(".top-app-bar");
    const quickTabs = document.querySelector(".quick-top-tabs");
    const headerH = header ? header.getBoundingClientRect().height : 50;
    const tabsH = quickTabs ? quickTabs.getBoundingClientRect().height : 42;
    const targetY = Math.max(0, heading.getBoundingClientRect().top + window.scrollY - headerH - tabsH - 10);
    window.scrollTo({ top: targetY, behavior: "smooth" });
}

function resetHomeFresh() {
    closeAllOverlays();
    currentMerchant = "";
    currentCategory = "all";
    currentMaxPrice = 0;
    currentSortMode = "smart";
    currentFeedMode = "for-you";
    onlyFavoritesMode = false;
    updateWishlistUI();

    const searchInput = document.getElementById("homeSearchInput");
    if (searchInput) searchInput.value = "";
    syncSearchCancelButton();

    const sortSelect = document.getElementById("productsSortSelect");
    if (sortSelect) sortSelect.value = "smart";

    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-quick") === "all");
    });
    document.querySelectorAll("#feedFilterPills .feed-pill-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-mode") === "for-you");
    });

    renderMerchantsQuickStrip();
    renderSpotlightBoxes();
    renderProducts("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSideCategoriesList() {
    const listContainer = document.getElementById("sideCategoriesList");
    if (!listContainer) return;
    const isDark = document.body.classList.contains("dark-theme");
    const cats = ["all", "home", "appliances", "phones", "jewelry", "perfume", "school", "gifts", "tafse", "women", "men", "kids"];

    listContainer.innerHTML = cats.map(catKey => {
        const meta = CATEGORY_THEME_META[catKey] || CATEGORY_THEME_META.all;
        const badgeBg = isDark ? "rgba(255, 255, 255, 0.08)" : meta.bg;
        const iconStroke = isDark ? "#f3dec2" : meta.stroke;
        const activeClass = currentCategory === catKey ? "active" : "";
        return `
            <button type="button" class="clean-cat-tile ${activeClass}" onclick="selectCategoryFromDrawer('${catKey}')">
                <div class="clean-cat-top-row">
                    <span class="clean-cat-icon-badge" style="background:${badgeBg};">${buildCategoryGraphicSvg(catKey, iconStroke)}</span>
                    <span class="clean-cat-label">${escapeHtml(CATEGORY_NAMES[catKey])}</span>
                </div>
                <span class="clean-cat-desc">${escapeHtml(CATEGORY_SUBTITLES[catKey] || "")}</span>
            </button>
        `;
    }).join("");
}

function selectCategoryFromDrawer(catKey) {
    closeCategoriesDrawer();
    const matchingTab = document.querySelector(`.quick-top-tabs .quick-tab-item[data-quick="${catKey}"]`);
    filterByCategory(catKey, matchingTab || null);
}

function openCategoriesDrawer() {
    closeCart(false, true);
    renderSideCategoriesList();
    const drawer = document.getElementById("catsDrawer");
    const backdrop = document.getElementById("catsBackdrop");
    if (drawer) drawer.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("cats");
}

function closeCategoriesDrawer(fromPopState = false, skipHistorySync = false) {
    const drawer = document.getElementById("catsDrawer");
    const backdrop = document.getElementById("catsBackdrop");
    if (drawer) drawer.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
    syncBodyScrollLock();
    if (!fromPopState && !skipHistorySync) removeOverlayState("cats");
}

function setMotionPaused(kind, paused) {
    pausedMotionKind[kind] = Boolean(paused);
}

function buildVisualSpotlightCardHTML(item, kind, idx, total) {
    const p = item.product;
    const displayPrice = formatPriceNumber(p.priceLabel || p.price);
    const safeImg = escapeHtmlAttr(item.imgSrc || p.img || "");
    const safeTitle = escapeHtml(p.title);
    const safeId = escapeHtmlAttr(p.id);

    let dotsHtml = "";
    if (total > 1) {
        dotsHtml = `<div class="showcase-dots-row" onclick="event.stopPropagation()">`;
        for (let i = 0; i < total; i++) {
            dotsHtml += `<button type="button" class="showcase-dot ${i === idx ? "active" : ""}" aria-label="عرض ${i + 1}" onclick="jumpSpotlightSlide('${kind}', ${i})"></button>`;
        }
        dotsHtml += `</div>`;
    }

    return `
        <div class="visual-motion-card" onclick="openImageModal('${safeImg}', '${safeId}')">
            <img src="${safeImg}" alt="${safeTitle}" loading="eager" decoding="async" onerror="handleProductImageError(this, '${safeId}')">
            <div class="visual-price-overlay">
                <div class="visual-price-pill">${displayPrice} <span>جنيه</span></div>
                ${dotsHtml}
            </div>
        </div>
    `;
}

function renderSpotlightBoxes() {
    const trendsGrid = document.getElementById("trendsSpotlightGrid");
    const dealsGrid = document.getElementById("dealsSpotlightGrid");
    if (!trendsGrid || !dealsGrid) return;

    if (isLoadingJsonProducts && !PRODUCTS.length) {
        const loadingBox = `<div class="spotlight-empty-card skeleton-shimmer">جاري التحميل...</div>`;
        trendsGrid.innerHTML = loadingBox;
        dealsGrid.innerHTML = loadingBox;
        return;
    }

    const trendSource = PRODUCTS.filter(p => p.img && !isProductOutOfStock(p));
    const dealSource = PRODUCTS.filter(p => p.img && !isProductOutOfStock(p) && isDealProduct(p));
    const effectiveDealSource = dealSource.length ? dealSource : trendSource;

    const trendPool = interleaveMerchantsSmartly(shuffleArray(trendSource)).slice(0, 6);
    const dealPool = interleaveMerchantsSmartly(shuffleArray(effectiveDealSource)).slice(0, 6);

    trendSlideList = trendPool.map(p => ({ product: p, imgSrc: p.img }));
    dealSlideList = dealPool.map(p => ({ product: p, imgSrc: p.img }));

    trendSlideIdx = 0;
    dealSlideIdx = 0;

    if (!trendSlideList.length) {
        trendsGrid.innerHTML = `<div class="spotlight-empty-card">لا توجد منتجات متاحة حالياً</div>`;
    } else {
        trendsGrid.innerHTML = buildVisualSpotlightCardHTML(trendSlideList[0], "trends", 0, trendSlideList.length);
    }

    if (!dealSlideList.length) {
        dealsGrid.innerHTML = `<div class="spotlight-empty-card">لا توجد عروض متاحة حالياً</div>`;
    } else {
        dealsGrid.innerHTML = buildVisualSpotlightCardHTML(dealSlideList[0], "deals", 0, dealSlideList.length);
    }
}

function jumpSpotlightSlide(kind, targetIdx) {
    if (kind === "trends" && trendSlideList.length) {
        trendSlideIdx = ((targetIdx % trendSlideList.length) + trendSlideList.length) % trendSlideList.length;
        const grid = document.getElementById("trendsSpotlightGrid");
        if (grid) grid.innerHTML = buildVisualSpotlightCardHTML(trendSlideList[trendSlideIdx], "trends", trendSlideIdx, trendSlideList.length);
    } else if (kind === "deals" && dealSlideList.length) {
        dealSlideIdx = ((targetIdx % dealSlideList.length) + dealSlideList.length) % dealSlideList.length;
        const grid = document.getElementById("dealsSpotlightGrid");
        if (grid) grid.innerHTML = buildVisualSpotlightCardHTML(dealSlideList[dealSlideIdx], "deals", dealSlideIdx, dealSlideList.length);
    }
}

setInterval(() => {
    if (document.hidden) return;
    if (!pausedMotionKind.trends && trendSlideList.length > 1) {
        jumpSpotlightSlide("trends", trendSlideIdx + 1);
    }
    if (!pausedMotionKind.deals && dealSlideList.length > 1) {
        jumpSpotlightSlide("deals", dealSlideIdx + 1);
    }
}, 3200);

function getCartItemKey(item) {
    return `${item.id}::${item.selectedSize || ""}::${item.selectedColor || ""}::${item.selectedImg || ""}`;
}

function getCartItemUnitPrice(item) {
    if (typeof item.unitPrice === "number" && item.unitPrice > 0) return item.unitPrice;
    const prod = PRODUCTS.find(p => p.id === item.id);
    if (prod) {
        const cfg = getProductVariantConfig(prod);
        if (cfg && cfg.sizes && item.selectedSize) {
            const matchedSize = cfg.sizes.find(s => s.label === item.selectedSize);
            if (matchedSize && matchedSize.price > 0) return matchedSize.price;
        }
        return Number(prod.price) || 0;
    }
    return Number(item.price) || 0;
}

function getTotalCartPieces() {
    return cart.reduce((sum, item) => sum + (item.qty || 1), 0);
}

function getTotalCartAmount() {
    return cart.reduce((sum, item) => sum + (getCartItemUnitPrice(item) * (item.qty || 1)), 0);
}

function pulseBottomNavButton(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.remove("pop");
    void btn.offsetWidth;
    btn.classList.add("pop");
    setTimeout(() => btn.classList.remove("pop"), 300);
}

function pulseCartBadges() {
    const bottomBadge = document.getElementById("bottomCartCount");
    if (bottomBadge) {
        bottomBadge.classList.remove("pop");
        void bottomBadge.offsetWidth;
        bottomBadge.classList.add("pop");
        setTimeout(() => bottomBadge.classList.remove("pop"), 320);
    }
}

function isProductOutOfStock(product) {
    if (!product) return false;
    if (product.outOfStock === true) return true;
    if (typeof product.stock === "number" && product.stock <= 0) return true;
    if (typeof product.quantity === "number" && product.quantity <= 0) return true;
    const statusText = String(product.stockStatus || product.availability || product.status || "").toLowerCase();
    return ["out_of_stock", "out-of-stock", "sold_out", "sold-out", "unavailable"].includes(statusText);
}

function isProductImageSoldOut(product, imgSrc) {
    if (!product) return false;
    if (isProductOutOfStock(product)) return true;
    const target = normalizeProductImageUrl(imgSrc || "");
    if (!target) return false;
    const soldList = Array.isArray(product.soldOutImages) ? product.soldOutImages : [];
    return soldList.some(u => normalizeProductImageUrl(u) === target);
}

function syncSoldOutOverlayOnElement(imgEl, isSoldOut) {
    if (!imgEl) return;
    const wrap = imgEl.closest(".media-soldout-wrap");
    if (wrap) {
        wrap.classList.toggle("is-soldout", Boolean(isSoldOut));
        const badge = wrap.querySelector(".soldout-badge-overlay");
        if (badge) badge.classList.toggle("is-hidden", !isSoldOut);
    }
}

function handleAddToCartClick(productId, clickedBtnEl = null) {
    const prod = PRODUCTS.find(p => p.id === productId);
    if (!prod) return;

    if (isProductOutOfStock(prod)) {
        showCaramelToast("عذراً، نفدت كمية هذا المنتج حالياً");
        return;
    }

    const cardEl = clickedBtnEl ? clickedBtnEl.closest(".product-card") : null;
    const activeCardImg = cardEl ? getActiveCardImageSrc(cardEl, prod) : (getProductImagesList(prod)[0] || "");
    if (activeCardImg && isProductImageSoldOut(prod, activeCardImg)) {
        showCaramelToast("هذا اللون/الصورة نفدت كميته حالياً");
        return;
    }

    const variantCfg = getProductVariantConfig(prod);
    if (variantCfg) {
        openProductOptionModal(prod, clickedBtnEl ? clickedBtnEl.id : null, activeCardImg);
        return;
    }

    addToCart(prod.id, clickedBtnEl ? clickedBtnEl.id : null, { selectedImg: activeCardImg });
}

function addToCart(productId, clickedBtnId = null, customOptions = {}) {
    const prod = PRODUCTS.find(p => p.id === productId);
    if (!prod) return;

    if (isProductOutOfStock(prod)) {
        showCaramelToast("عذراً، هذا المنتج غير متوفر حالياً");
        return;
    }

    const chosenImg = normalizeProductImageUrl(customOptions.selectedImg || prod.img || "") || (getProductImagesList(prod)[0] || "");
    if (chosenImg && isProductImageSoldOut(prod, chosenImg)) {
        showCaramelToast("هذا الخيار غير متوفر حالياً");
        return;
    }

    const variantCfg = getProductVariantConfig(prod);
    const qtyToAdd = Math.max(1, Number(customOptions.qty) || 1);
    const noteText = String(customOptions.note || "").trim();

    let selectedSize = customOptions.selectedSize || "";
    let selectedColor = customOptions.selectedColor || "";
    let unitPrice = Number(prod.price) || 0;

    if (variantCfg) {
        if (variantCfg.sizes && variantCfg.sizes.length) {
            if (!selectedSize) selectedSize = variantCfg.sizes[0].label;
            const matchedSize = variantCfg.sizes.find(s => s.label === selectedSize);
            if (matchedSize && matchedSize.price > 0) unitPrice = matchedSize.price;
        }
        if (variantCfg.colors && variantCfg.colors.length) {
            if (!selectedColor) selectedColor = variantCfg.colors[0];
        }
    }

    if (typeof customOptions.unitPrice === "number" && customOptions.unitPrice > 0) {
        unitPrice = customOptions.unitPrice;
    }

    const newItem = {
        id: prod.id,
        title: prod.title,
        price: unitPrice,
        unitPrice: unitPrice,
        priceLabel: prod.priceLabel || "",
        img: chosenImg,
        selectedImg: chosenImg,
        merchant: prod.merchant || "",
        category: prod.category || "",
        selectedSize,
        selectedColor,
        note: noteText,
        qty: qtyToAdd
    };

    const newKey = getCartItemKey(newItem);
    const existingIndex = cart.findIndex(item => getCartItemKey(item) === newKey);

    if (existingIndex > -1) {
        cart[existingIndex].qty = (cart[existingIndex].qty || 1) + qtyToAdd;
        if (noteText) {
            cart[existingIndex].note = cart[existingIndex].note ? `${cart[existingIndex].note} | ${noteText}` : noteText;
        }
    } else {
        cart.push(newItem);
    }

    saveCart();
    updateCartUI();
    pulseCartBadges();
    trackProductInterest(prod, 3, true);

    if (clickedBtnId) {
        const btn = document.getElementById(clickedBtnId);
        if (btn) {
            const orig = btn.textContent;
            btn.textContent = "تمت الإضافة ✓";
            btn.classList.add("added");
            setTimeout(() => { btn.textContent = orig; btn.classList.remove("added"); }, 1100);
        }
    }

    if (appendTargetOrderId) {
        const targetOrder = activeOrders.find(o => o.orderId === appendTargetOrderId);
        if (targetOrder) {
            showCaramelToast(`تمت الإضافة للسلة — جاهز للإرسال على الأوردر #${targetOrder.orderId}`);
        } else {
            appendTargetOrderId = null;
            renderAppendOrderBanner();
            showCaramelToast("تمت إضافة المنتج إلى السلة");
        }
    } else {
        showCaramelToast("تمت إضافة المنتج إلى السلة");
    }
}

function openProductOptionModal(product, clickedBtnId = null, preselectedImg = "") {
    const variantCfg = getProductVariantConfig(product);
    if (!variantCfg) return;

    const imgs = getProductImagesList(product);
    const initialImg = normalizeProductImageUrl(preselectedImg) || imgs[0] || "";
    const defaultSizeObj = (variantCfg.sizes && variantCfg.sizes.length) ? variantCfg.sizes[0] : null;
    const initialPrice = (defaultSizeObj && defaultSizeObj.price > 0) ? defaultSizeObj.price : (Number(product.price) || 0);

    pendingOptionSelection = {
        productId: product.id,
        clickedBtnId,
        selectedSize: defaultSizeObj ? defaultSizeObj.label : "",
        selectedColor: (variantCfg.colors && variantCfg.colors.length) ? variantCfg.colors[0] : "",
        selectedImg: initialImg,
        currentPrice: initialPrice,
        qty: 1
    };

    const modal = document.getElementById("productOptionModal");
    const imgEl = document.getElementById("optionModalImg");
    const titleEl = document.getElementById("optionModalTitle");
    const priceEl = document.getElementById("optionModalPrice");
    const thumbsRow = document.getElementById("optionModalThumbsRow");
    const sizeGroup = document.getElementById("optionModalSizeGroup");
    const sizeLabelEl = document.getElementById("optionModalSizeLabel");
    const sizePills = document.getElementById("optionModalSizePills");
    const colorGroup = document.getElementById("optionModalColorGroup");
    const colorLabelEl = document.getElementById("optionModalColorLabel");
    const colorPills = document.getElementById("optionModalColorPills");
    const qtyVal = document.getElementById("optionModalQtyVal");
    const noteInput = document.getElementById("optionModalNoteInput");

    if (imgEl) {
        imgEl.src = initialImg;
        imgEl.alt = product.title;
    }
    if (titleEl) titleEl.textContent = product.title;
    if (priceEl) priceEl.innerHTML = `${formatPriceNumber(initialPrice)} <span>جنيه</span>`;
    if (qtyVal) qtyVal.textContent = "1";
    if (noteInput) noteInput.value = "";

    if (thumbsRow) {
        if (imgs.length > 1) {
            thumbsRow.classList.remove("is-hidden");
            thumbsRow.innerHTML = imgs.map((u, idx) => `
                <button type="button" class="preview-thumb-btn ${u === initialImg ? "active" : ""}" onclick="selectOptionModalImage('${escapeHtmlAttr(u)}', this)" aria-label="صورة ${idx + 1}">
                    <img src="${escapeHtmlAttr(u)}" alt="">
                </button>
            `).join("");
        } else {
            thumbsRow.classList.add("is-hidden");
            thumbsRow.innerHTML = "";
        }
    }

    if (sizeGroup && sizePills) {
        if (variantCfg.sizes && variantCfg.sizes.length) {
            sizeGroup.classList.remove("is-hidden");
            if (sizeLabelEl) sizeLabelEl.textContent = variantCfg.sizeHeading || resolveProductOptionHeading(product);
            sizePills.innerHTML = variantCfg.sizes.map((sObj, idx) =>
                `<button type="button" class="option-pill-btn ${idx === 0 ? "selected" : ""}" onclick="selectOptionPill('size', ${idx}, this)">${escapeHtml(sObj.label)}</button>`
            ).join("");
        } else {
            sizeGroup.classList.add("is-hidden");
            sizePills.innerHTML = "";
        }
    }

    if (colorGroup && colorPills) {
        if (variantCfg.colors && variantCfg.colors.length) {
            colorGroup.classList.remove("is-hidden");
            if (colorLabelEl) colorLabelEl.textContent = variantCfg.colorHeading || resolveProductColorHeading(product);
            colorPills.innerHTML = variantCfg.colors.map((c, idx) =>
                `<button type="button" class="option-pill-btn ${idx === 0 ? "selected" : ""}" onclick="selectOptionPill('color', ${idx}, this)">${escapeHtml(c)}</button>`
            ).join("");
        } else {
            colorGroup.classList.add("is-hidden");
            colorPills.innerHTML = "";
        }
    }

    if (modal) {
        modal.classList.add("open");
        syncBodyScrollLock();
        pushOverlayState("option");
    }
}

function selectOptionModalImage(imgUrl, btnEl) {
    const cleanUrl = normalizeProductImageUrl(imgUrl);
    if (!cleanUrl) return;
    pendingOptionSelection.selectedImg = cleanUrl;
    const imgEl = document.getElementById("optionModalImg");
    if (imgEl) imgEl.src = cleanUrl;
    const row = document.getElementById("optionModalThumbsRow");
    if (row) {
        row.querySelectorAll(".preview-thumb-btn").forEach(b => b.classList.remove("active"));
    }
    if (btnEl) btnEl.classList.add("active");
}

function selectOptionPill(type, idx, btnEl) {
    const prod = PRODUCTS.find(p => p.id === pendingOptionSelection.productId);
    const variantCfg = prod ? getProductVariantConfig(prod) : null;
    if (!variantCfg) return;

    const parent = btnEl ? btnEl.parentElement : null;
    if (parent) parent.querySelectorAll(".option-pill-btn").forEach(b => b.classList.remove("selected"));
    if (btnEl) btnEl.classList.add("selected");

    if (type === "size" && variantCfg.sizes && variantCfg.sizes[idx]) {
        const chosen = variantCfg.sizes[idx];
        pendingOptionSelection.selectedSize = chosen.label;
        if (chosen.price > 0) {
            pendingOptionSelection.currentPrice = chosen.price;
            const priceEl = document.getElementById("optionModalPrice");
            if (priceEl) priceEl.innerHTML = `${formatPriceNumber(chosen.price)} <span>جنيه</span>`;
        }
    } else if (type === "color" && variantCfg.colors && variantCfg.colors[idx]) {
        pendingOptionSelection.selectedColor = variantCfg.colors[idx];
    }
}

function changeModalQty(delta) {
    const nextQty = Math.max(1, (pendingOptionSelection.qty || 1) + delta);
    pendingOptionSelection.qty = nextQty;
    const qtyVal = document.getElementById("optionModalQtyVal");
    if (qtyVal) qtyVal.textContent = String(nextQty);
}

function confirmAddProductWithOptions() {
    const { productId, clickedBtnId, selectedSize, selectedColor, selectedImg, currentPrice, qty } = pendingOptionSelection;
    if (!productId) return;
    const noteInput = document.getElementById("optionModalNoteInput");
    const note = noteInput ? noteInput.value.trim() : "";

    closeProductOptionModal();
    addToCart(productId, clickedBtnId, {
        selectedSize,
        selectedColor,
        selectedImg,
        unitPrice: currentPrice,
        qty,
        note
    });
}

function closeProductOptionModal(fromPopState = false) {
    const modal = document.getElementById("productOptionModal");
    if (modal) modal.classList.remove("open");
    pendingOptionSelection.productId = null;
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("option");
}

function changeCartItemQty(index, delta) {
    if (!cart[index]) return;
    const nextQty = (cart[index].qty || 1) + delta;
    if (nextQty <= 0) {
        cart.splice(index, 1);
    } else {
        cart[index].qty = nextQty;
    }
    saveCart();
    updateCartUI();
}

function updateCartItemSize(index, newSize) {
    if (!cart[index]) return;
    cart[index].selectedSize = newSize;
    const prod = PRODUCTS.find(p => p.id === cart[index].id);
    if (prod) {
        const cfg = getProductVariantConfig(prod);
        if (cfg && cfg.sizes) {
            const matched = cfg.sizes.find(s => s.label === newSize);
            if (matched && matched.price > 0) {
                cart[index].unitPrice = matched.price;
                cart[index].price = matched.price;
            }
        }
    }
    saveCart();
    updateCartUI();
}

function updateCartItemColor(index, newColor) {
    if (!cart[index]) return;
    cart[index].selectedColor = newColor;
    saveCart();
    updateCartUI();
}

function updateCartItemNote(index, newNote) {
    if (!cart[index]) return;
    cart[index].note = newNote;
    saveCart();
}

function removeCartItem(index) {
    if (!cart[index]) return;
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function clearCart() {
    if (!cart.length) return;
    openConfirmModal(
        "تفريغ السلة",
        "هل أنت متأكد من تفريغ جميع المنتجات من السلة؟",
        () => {
            cart = [];
            saveCart();
            updateCartUI();
            showCaramelToast("تم تفريغ السلة");
        },
        "تفريغ"
    );
}

function getOrderStageStepperHTML(order) {
    const hasConfirmed = Boolean(order.whatsappSent || order.confirmedAt);
    const hasAppended = Boolean(order.appendedAt);
    return `
        <div class="order-stage-stepper" aria-label="مراحل تنفيذ الطلب">
            <div class="order-stage-step done"><span class="order-stage-dot"></span><span>تم الإنشاء</span></div>
            <div class="order-stage-step ${hasConfirmed ? "done" : ""}"><span class="order-stage-dot"></span><span>إرسال واتساب</span></div>
            <div class="order-stage-step ${hasAppended ? "done" : ""}"><span class="order-stage-dot"></span><span>تحديثات</span></div>
            <div class="order-stage-step"><span class="order-stage-dot"></span><span>قيد التوصيل</span></div>
        </div>
    `;
}

function toggleOrderAccordion(orderId) {
    if (!orderId) return;
    if (expandedOrderIds.has(orderId)) {
        expandedOrderIds.delete(orderId);
    } else {
        expandedOrderIds.add(orderId);
    }
    renderActiveOrdersSection();
    renderReceivedOrdersSection();
}

function copyOrderIdToClipboard(orderId, event) {
    if (event) event.stopPropagation();
    if (!orderId) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(orderId)).then(() => {
            showCaramelToast(`تم نسخ رقم الأوردر #${orderId}`);
        }).catch(() => {
            showCaramelToast(`رقم الأوردر: #${orderId}`);
        });
    } else {
        showCaramelToast(`رقم الأوردر: #${orderId}`);
    }
}

function renderActiveOrdersSection() {
    const container = document.getElementById("activeOrdersContainer");
    const badge = document.getElementById("activeOrdersCountBadge");
    const pageChip = document.getElementById("pendingOrdersPageChip");
    if (!container) return;

    if (badge) badge.textContent = String(activeOrders.length);
    if (pageChip) pageChip.textContent = `${activeOrders.length} ${activeOrders.length === 1 ? "طلب" : "طلبات"}`;

    if (!activeOrders.length) {
        container.innerHTML = `<div class="active-orders-empty">لا توجد طلبات قيد التنفيذ حالياً.<br>أي طلب ترسله عبر واتساب سيظهر هنا برقم أوردر لمتابعته أو الإضافة عليه.</div>`;
        return;
    }

    container.innerHTML = activeOrders.map(order => {
        const isAppendingHere = appendTargetOrderId === order.orderId;
        const isExpanded = expandedOrderIds.has(order.orderId) || isAppendingHere;
        const orderTotal = (order.items || []).reduce((sum, it) => sum + ((Number(it.unitPrice || it.price) || 0) * (it.qty || 1)), 0);
        const totalPieces = (order.items || []).reduce((sum, it) => sum + (it.qty || 1), 0);

        const itemsHtml = (order.items || []).map(it => {
            const details = [
                it.selectedSize ? `${resolveCartOptionShortTag(it)}: ${it.selectedSize}` : "",
                it.selectedColor ? `اللون: ${it.selectedColor}` : "",
                it.note ? `ملاحظة: ${it.note}` : ""
            ].filter(Boolean).join(" • ");
            const unitP = Number(it.unitPrice || it.price) || 0;
            const lineTotal = unitP * (it.qty || 1);

            return `
                <div class="active-order-item-row">
                    <img src="${escapeHtmlAttr(it.img || "")}" alt="${escapeHtml(it.title)}" onerror="handleProductImageError(this, '${escapeHtmlAttr(it.id)}')">
                    <div class="active-order-item-meta">
                        <div class="cart-item-title">${escapeHtml(it.title)} × ${it.qty || 1}</div>
                        ${details ? `<div class="cart-item-sub">${escapeHtml(details)}</div>` : ""}
                        <div class="cart-item-price">${formatPriceNumber(lineTotal)} جنيه</div>
                    </div>
                </div>
            `;
        }).join("");

        return `
            <div class="order-accordion-card ${isExpanded ? "is-expanded" : ""} ${isAppendingHere ? "appending-target" : ""}">
                <button type="button" class="order-number-trigger" onclick="toggleOrderAccordion('${escapeHtmlAttr(order.orderId)}')" aria-expanded="${isExpanded}">
                    <div>
                        <div class="order-id-row">
                            <span class="order-id-badge-label">رقم الأوردر</span>
                            <strong class="order-id-code">#${escapeHtml(order.orderId)}</strong>
                            <span class="order-id-hint">${isExpanded ? "إخفاء التفاصيل" : "اضغط لعرض التفاصيل"}</span>
                        </div>
                        <div class="order-trigger-sub">${escapeHtml(order.createdAt || "")} • ${totalPieces} قطعة</div>
                    </div>
                    <div class="order-trigger-right">
                        <span class="active-order-status-pill">${isAppendingHere ? "جاري الإضافة..." : "قيد التنفيذ"}</span>
                        <span class="order-chevron-icon" aria-hidden="true">⌄</span>
                    </div>
                </button>
                <div class="order-accordion-panel">
                    ${getOrderStageStepperHTML(order)}
                    <div class="active-order-head">
                        <span class="active-order-date">تفاصيل الأوردر #${escapeHtml(order.orderId)}</span>
                        <button type="button" class="order-copy-id-btn" onclick="copyOrderIdToClipboard('${escapeHtmlAttr(order.orderId)}', event)">نسخ الرقم</button>
                    </div>
                    <div class="active-order-items">${itemsHtml}</div>
                    <div class="active-order-total-line">
                        <span>إجمالي الأوردر:</span>
                        <strong>${formatPriceNumber(orderTotal)} جنيه</strong>
                    </div>
                    <div class="active-order-actions">
                        <button type="button" class="order-add-more-btn" onclick="startAppendToOrder('${escapeHtmlAttr(order.orderId)}')">${isAppendingHere ? "إلغاء الإضافة" : "+ إضافة منتجات"}</button>
                        <button type="button" class="order-send-update-btn" onclick="sendOrderUpdateOnWhatsApp('${escapeHtmlAttr(order.orderId)}')">إرسال / تحديث واتساب</button>
                        <button type="button" class="order-received-btn" onclick="markOrderAsReceived('${escapeHtmlAttr(order.orderId)}')">تم استلام الأوردر ✓</button>
                        <button type="button" class="order-cancel-btn" onclick="cancelActiveOrder('${escapeHtmlAttr(order.orderId)}')">إلغاء الطلب</button>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

function renderReceivedOrdersSection() {
    const container = document.getElementById("receivedOrdersContainer");
    const badge = document.getElementById("receivedOrdersCountBadge");
    const pageChip = document.getElementById("receivedOrdersPageChip");
    if (!container) return;

    if (badge) badge.textContent = String(receivedOrders.length);
    if (pageChip) pageChip.textContent = `${receivedOrders.length} ${receivedOrders.length === 1 ? "طلب" : "طلبات"}`;

    if (!receivedOrders.length) {
        container.innerHTML = `<div class="received-orders-empty">لا توجد أوردرات مستلمة بعد.<br>عند الضغط على «تم استلام الأوردر» سيُنقل الطلب هنا تلقائياً.</div>`;
        return;
    }

    const ordersHtml = receivedOrders.map(order => {
        const isExpanded = expandedOrderIds.has(order.orderId);
        const orderTotal = (order.items || []).reduce((sum, it) => sum + ((Number(it.unitPrice || it.price) || 0) * (it.qty || 1)), 0);
        const itemsHtml = (order.items || []).map(it => {
            const details = [
                it.selectedSize ? `${resolveCartOptionShortTag(it)}: ${it.selectedSize}` : "",
                it.selectedColor ? `اللون: ${it.selectedColor}` : "",
                it.note ? `ملاحظة: ${it.note}` : ""
            ].filter(Boolean).join(" • ");
            const unitP = Number(it.unitPrice || it.price) || 0;

            return `
                <div class="received-order-item-row">
                    <div>
                        <div class="received-order-item-title">${escapeHtml(it.title)} × ${it.qty || 1}</div>
                        ${details ? `<div class="received-order-item-sub">${escapeHtml(details)}</div>` : ""}
                        <div class="received-order-item-sub">${formatPriceNumber(unitP * (it.qty || 1))} جنيه</div>
                    </div>
                    <button type="button" class="received-reorder-btn" onclick="reorderItemToCart('${escapeHtmlAttr(it.id)}', '${escapeHtmlAttr(it.selectedSize || "")}', '${escapeHtmlAttr(it.selectedColor || "")}')">إعادة طلب</button>
                </div>
            `;
        }).join("");

        return `
            <div class="order-accordion-card ${isExpanded ? "is-expanded" : ""}">
                <button type="button" class="order-number-trigger" onclick="toggleOrderAccordion('${escapeHtmlAttr(order.orderId)}')" aria-expanded="${isExpanded}">
                    <div>
                        <div class="order-id-row">
                            <span class="order-id-badge-label">رقم الأوردر</span>
                            <strong class="order-id-code">#${escapeHtml(order.orderId)}</strong>
                            <span class="order-id-hint">${isExpanded ? "إخفاء التفاصيل" : "اضغط لعرض التفاصيل"}</span>
                        </div>
                        <div class="order-trigger-sub">استُلم: ${escapeHtml(order.receivedAt || order.createdAt || "")}</div>
                    </div>
                    <div class="order-trigger-right">
                        <span class="received-order-status-pill">تم الاستلام</span>
                        <span class="order-chevron-icon" aria-hidden="true">⌄</span>
                    </div>
                </button>
                <div class="order-accordion-panel">
                    <div class="active-order-head">
                        <span class="active-order-date">أوردر مستلم #${escapeHtml(order.orderId)}</span>
                        <button type="button" class="order-copy-id-btn" onclick="copyOrderIdToClipboard('${escapeHtmlAttr(order.orderId)}', event)">نسخ الرقم</button>
                    </div>
                    <div class="active-order-items">${itemsHtml}</div>
                    <div class="active-order-total-line">
                        <span>إجمالي الأوردر:</span>
                        <strong>${formatPriceNumber(orderTotal)} جنيه</strong>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    container.innerHTML = `
        ${ordersHtml}
        <button type="button" class="received-clear-btn" onclick="clearReceivedOrdersHistory()">مسح سجل الأوردرات المستلمة</button>
    `;
}

function reorderItemToCart(productId, selectedSize = "", selectedColor = "") {
    const prod = PRODUCTS.find(p => p.id === productId);
    if (!prod) {
        showCaramelToast("هذا المنتج غير متاح حالياً في القائمة");
        return;
    }
    if (isProductOutOfStock(prod)) {
        showCaramelToast("عذراً، نفدت كمية هذا المنتج حالياً");
        return;
    }
    addToCart(productId, null, { selectedSize, selectedColor, qty: 1 });
    switchCartOrdersTab("cart");
}

function clearReceivedOrdersHistory() {
    if (!receivedOrders.length) return;
    openConfirmModal(
        "مسح السجل المستلم",
        "هل تريد مسح سجل الأوردرات المستلمة نهائياً؟",
        () => {
            receivedOrders = [];
            saveReceivedOrders();
            renderReceivedOrdersSection();
            showCaramelToast("تم مسح سجل الأوردرات المستلمة");
        },
        "مسح"
    );
}

function startAppendToOrder(orderId) {
    if (appendTargetOrderId === orderId) {
        appendTargetOrderId = null;
        renderAppendOrderBanner();
        renderActiveOrdersSection();
        showCaramelToast("تم إلغاء وضع الإضافة على الأوردر");
        return;
    }
    const target = activeOrders.find(o => o.orderId === orderId);
    if (!target) return;

    appendTargetOrderId = orderId;
    renderAppendOrderBanner();
    renderActiveOrdersSection();
    closeCart();
    scrollToProductsTop();
    showCaramelToast(`اختر المنتجات لإضافتها على الأوردر #${orderId}`);
}

function cancelAppendToOrderMode() {
    appendTargetOrderId = null;
    renderAppendOrderBanner();
    renderActiveOrdersSection();
    showCaramelToast("تم إنهاء وضع الإضافة على الأوردر");
}

function renderAppendOrderBanner() {
    const banner = document.getElementById("appendOrderBanner");
    const textEl = document.getElementById("appendOrderBannerText");
    if (!banner || !textEl) return;

    if (!appendTargetOrderId) {
        banner.classList.add("is-hidden");
        return;
    }

    const order = activeOrders.find(o => o.orderId === appendTargetOrderId);
    if (!order) {
        appendTargetOrderId = null;
        banner.classList.add("is-hidden");
        return;
    }

    banner.classList.remove("is-hidden");
    textEl.innerHTML = `وضع الإضافة نشط على الأوردر <strong>#${escapeHtml(order.orderId)}</strong> — أضف منتجات للسلة ثم أرسل التحديث على واتساب`;
}

function mergeItemsIntoOrder(order, itemsToMerge) {
    if (!order.items) order.items = [];
    itemsToMerge.forEach(newIt => {
        const idx = order.items.findIndex(existing => getCartItemKey(existing) === getCartItemKey(newIt));
        if (idx > -1) {
            order.items[idx].qty = (order.items[idx].qty || 1) + (newIt.qty || 1);
            if (newIt.note) {
                order.items[idx].note = order.items[idx].note ? `${order.items[idx].note} | ${newIt.note}` : newIt.note;
            }
        } else {
            order.items.push({ ...newIt });
        }
    });
}

function buildOrderWhatsAppMessage(order, isUpdate = false, customerInfo = {}) {
    const headerLine = isUpdate
        ? `تحديث وإضافة على أوردر رقم *#${order.orderId}* من متجر كارامل:`
        : `طلب جديد من متجر كارامل — أوردر رقم *#${order.orderId}*:`;

    const lines = [headerLine, ""];
    let total = 0;

    (order.items || []).forEach((item, idx) => {
        const unitP = Number(item.unitPrice || item.price) || 0;
        const qty = item.qty || 1;
        const lineTotal = unitP * qty;
        total += lineTotal;

        const opts = [];
        if (item.selectedSize) opts.push(`${resolveCartOptionShortTag(item)}: ${item.selectedSize}`);
        if (item.selectedColor) opts.push(`اللون: ${item.selectedColor}`);
        if (item.note) opts.push(`ملاحظة: ${item.note}`);
        if (item.merchant) opts.push(`التاجر: ${item.merchant}`);
        if (item.selectedImg || item.img) opts.push(`الصورة: ${item.selectedImg || item.img}`);

        const optsStr = opts.length ? ` (${opts.join(" - ")})` : "";
        lines.push(`${idx + 1}. ${item.title}${optsStr} × ${qty} = ${formatPriceNumber(lineTotal)} جنيه`);
    });

    lines.push("");
    lines.push(`*الإجمالي الكلي: ${formatPriceNumber(total)} جنيه*`);

    const cName = (customerInfo.name || order.customerName || "").trim();
    const cPhone = (customerInfo.phone || order.customerPhone || "").trim();
    const cAddress = (customerInfo.address || order.customerAddress || "").trim();
    const cLoc = customerInfo.location || order.customerLocation || null;

    if (cName || cPhone || cAddress || (cLoc && cLoc.lat && cLoc.lng)) {
        lines.push("");
        lines.push("*بيانات العميل والتوصيل:*");
        if (cName) lines.push(`الاسم: ${cName}`);
        if (cPhone) lines.push(`رقم التواصل: ${cPhone}`);
        if (cAddress) lines.push(`العنوان: ${cAddress}`);
        if (cLoc && cLoc.lat && cLoc.lng) {
            lines.push(`اللوكيشن: https://maps.google.com/?q=${cLoc.lat},${cLoc.lng}`);
        }
    }

    return lines.join("\n");
}

function sendOrderUpdateOnWhatsApp(orderId) {
    const order = activeOrders.find(o => o.orderId === orderId);
    if (!order) return;

    const customerInfo = getCustomerCheckoutInfo();
    if (customerInfo.name) order.customerName = customerInfo.name;
    if (customerInfo.phone) order.customerPhone = customerInfo.phone;
    if (customerInfo.address) order.customerAddress = customerInfo.address;
    if (customerInfo.location) order.customerLocation = customerInfo.location;

    if (appendTargetOrderId === orderId && cart.length > 0) {
        mergeItemsIntoOrder(order, cart);
        cart = [];
        saveCart();
        appendTargetOrderId = null;
        renderAppendOrderBanner();
        updateCartUI();
    }

    order.whatsappSent = true;
    order.appendedAt = new Date().toLocaleString("ar-EG");
    saveActiveOrders();
    renderActiveOrdersSection();

    const msg = buildOrderWhatsAppMessage(order, true, customerInfo);
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`);
}

function markOrderAsReceived(orderId) {
    const idx = activeOrders.findIndex(o => o.orderId === orderId);
    if (idx === -1) return;

    openConfirmModal(
        "تأكيد استلام الأوردر",
        `هل تم استلام الأوردر رقم #${orderId} بالفعل؟ سيتم نقله إلى سجل الأوردرات المستلمة.`,
        () => {
            const [finishedOrder] = activeOrders.splice(idx, 1);
            finishedOrder.status = "received";
            finishedOrder.receivedAt = new Date().toLocaleString("ar-EG");
            receivedOrders.unshift(finishedOrder);

            if (appendTargetOrderId === orderId) {
                appendTargetOrderId = null;
                renderAppendOrderBanner();
            }

            saveActiveOrders();
            saveReceivedOrders();
            updateCartUI();
            showCaramelToast(`تم نقل الأوردر #${orderId} إلى الأوردرات المستلمة ✓`);
        },
        "تم الاستلام"
    );
}

function cancelActiveOrder(orderId) {
    const idx = activeOrders.findIndex(o => o.orderId === orderId);
    if (idx === -1) return;

    openConfirmModal(
        "إلغاء الطلب",
        `هل أنت متأكد من إلغاء الطلب رقم #${orderId}؟`,
        () => {
            activeOrders.splice(idx, 1);
            if (appendTargetOrderId === orderId) {
                appendTargetOrderId = null;
                renderAppendOrderBanner();
            }
            saveActiveOrders();
            updateCartUI();
            showCaramelToast(`تم إلغاء الطلب #${orderId}`);
        },
        "إلغاء الطلب"
    );
}

let customerLocationCoords = null;

function getCustomerCheckoutInfo() {
    const nameInput = document.getElementById("checkoutCustomerName");
    const phoneInput = document.getElementById("checkoutCustomerPhone");
    const addrInput = document.getElementById("checkoutCustomerAddress");
    const name = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const address = addrInput ? addrInput.value.trim() : "";
    if (name || phone || address) {
        saveCustomerProfileInputs(name, phone, address);
    }
    return { name, phone, address, location: customerLocationCoords };
}

function syncLocationButtonUI() {
    const btn = document.getElementById("cartLocationBtn");
    const btnText = document.getElementById("cartLocationBtnText");
    const clearBtn = document.getElementById("cartLocationClearBtn");
    const preview = document.getElementById("cartLocationPreview");
    if (!btn || !btnText) return;

    if (customerLocationCoords && customerLocationCoords.lat && customerLocationCoords.lng) {
        btn.classList.add("located");
        btnText.textContent = "تم تحديد موقعك الحالي ✓";
        if (clearBtn) clearBtn.classList.add("visible");
        if (preview) {
            preview.classList.remove("is-hidden");
            const mapsUrl = `https://maps.google.com/?q=${customerLocationCoords.lat},${customerLocationCoords.lng}`;
            preview.innerHTML = `الموقع المحدد: <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${customerLocationCoords.lat.toFixed(5)}, ${customerLocationCoords.lng.toFixed(5)}</a>`;
        }
    } else {
        btn.classList.remove("located");
        btnText.textContent = "تحديد موقعي الحالي (اللوكيشن)";
        if (clearBtn) clearBtn.classList.remove("visible");
        if (preview) {
            preview.classList.add("is-hidden");
            preview.textContent = "";
        }
    }
}

function requestCustomerLocation() {
    if (!navigator.geolocation) {
        showCaramelToast("المتصفح لا يدعم تحديد الموقع الجغرافي");
        return;
    }
    const btnText = document.getElementById("cartLocationBtnText");
    if (btnText) btnText.textContent = "جاري تحديد موقعك...";

    navigator.geolocation.getCurrentPosition(
        pos => {
            customerLocationCoords = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            };
            syncLocationButtonUI();
            showCaramelToast("تم تحديد موقعك بنجاح وإرفاقه بالطلب");
        },
        err => {
            syncLocationButtonUI();
            if (err && err.code === 1) {
                showCaramelToast("تم رفض إذن الوصول للموقع — يمكنك إرسال الطلب بدون لوكيشن");
            } else {
                showCaramelToast("تعذر تحديد الموقع حالياً — حاول مرة أخرى");
            }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

function clearCustomerLocation() {
    customerLocationCoords = null;
    syncLocationButtonUI();
    showCaramelToast("تم إلغاء اللوكيشن المرفق");
}

function buildCurrentCartSummaryText() {
    if (!cart.length) return "";
    const customerInfo = getCustomerCheckoutInfo();
    const lines = ["*ملخص سلة متجر كارامل:*", ""];
    let total = 0;

    cart.forEach((item, idx) => {
        const unitP = getCartItemUnitPrice(item);
        const qty = item.qty || 1;
        const lineTotal = unitP * qty;
        total += lineTotal;

        const opts = [];
        if (item.selectedSize) opts.push(`${resolveCartOptionShortTag(item)}: ${item.selectedSize}`);
        if (item.selectedColor) opts.push(`اللون: ${item.selectedColor}`);
        if (item.note) opts.push(`ملاحظة: ${item.note}`);
        if (item.merchant) opts.push(`التاجر: ${item.merchant}`);
        if (item.selectedImg || item.img) opts.push(`الصورة: ${item.selectedImg || item.img}`);

        const optsStr = opts.length ? ` (${opts.join(" - ")})` : "";
        lines.push(`${idx + 1}. ${item.title}${optsStr} × ${qty} = ${formatPriceNumber(lineTotal)} جنيه`);
    });

    lines.push("");
    lines.push(`*الإجمالي: ${formatPriceNumber(total)} جنيه*`);

    if (customerInfo.name || customerInfo.phone || customerInfo.address || (customerInfo.location && customerInfo.location.lat)) {
        lines.push("");
        lines.push("*بيانات العميل:*");
        if (customerInfo.name) lines.push(`الاسم: ${customerInfo.name}`);
        if (customerInfo.phone) lines.push(`الهاتف: ${customerInfo.phone}`);
        if (customerInfo.address) lines.push(`العنوان: ${customerInfo.address}`);
        if (customerInfo.location && customerInfo.location.lat && customerInfo.location.lng) {
            lines.push(`اللوكيشن: https://maps.google.com/?q=${customerInfo.location.lat},${customerInfo.location.lng}`);
        }
    }

    return lines.join("\n");
}

function copyOrderSummaryText() {
    if (!cart.length) {
        showCaramelToast("السلة فارغة — أضف منتجات أولاً");
        return;
    }
    const summaryText = buildCurrentCartSummaryText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summaryText).then(() => {
            showCaramelToast("تم نسخ ملخص الطلب بنجاح!");
        }).catch(() => {
            showCaramelToast("تعذر النسخ التلقائي");
        });
    } else {
        showCaramelToast("تم تجهيز ملخص الطلب");
    }
}

function openWhatsAppChatDirect() {
    const msg = cart.length ? buildCurrentCartSummaryText() : "مرحباً متجر كارامل، أريد الاستفسار عن المنتجات والطلبات.";
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`);
}

function generateOrderId() {
    const now = new Date();
    const datePart = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const randPart = Math.floor(1000 + Math.random() * 9000);
    return `CRM-${datePart}-${randPart}`;
}

function checkoutOnWhatsApp() {
    if (!cart.length) {
        showCaramelToast("سلتك فارغة — أضف منتجات أولاً قبل إرسال الطلب");
        return;
    }

    const customerInfo = getCustomerCheckoutInfo();
    if (!customerInfo.name || !customerInfo.phone) {
        toggleProfileEditorPanel(true);
        showCaramelToast("يرجى كتابة الاسم ورقم التواصل أولاً");
        const focusTarget = !customerInfo.name
            ? document.getElementById("checkoutCustomerName")
            : document.getElementById("checkoutCustomerPhone");
        if (focusTarget) focusTarget.focus();
        return;
    }

    const clonedItems = cart.map(item => ({
        ...item,
        unitPrice: getCartItemUnitPrice(item),
        price: getCartItemUnitPrice(item)
    }));

    if (appendTargetOrderId) {
        const targetOrder = activeOrders.find(o => o.orderId === appendTargetOrderId);
        if (targetOrder) {
            mergeItemsIntoOrder(targetOrder, clonedItems);
            targetOrder.whatsappSent = true;
            targetOrder.appendedAt = new Date().toLocaleString("ar-EG");
            if (customerInfo.name) targetOrder.customerName = customerInfo.name;
            if (customerInfo.phone) targetOrder.customerPhone = customerInfo.phone;
            if (customerInfo.address) targetOrder.customerAddress = customerInfo.address;
            if (customerInfo.location) targetOrder.customerLocation = customerInfo.location;

            cart = [];
            saveCart();
            appendTargetOrderId = null;
            saveActiveOrders();
            renderAppendOrderBanner();
            updateCartUI();

            const updateMsg = buildOrderWhatsAppMessage(targetOrder, true, customerInfo);
            launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(updateMsg)}`);
            return;
        }
        appendTargetOrderId = null;
        renderAppendOrderBanner();
    }

    const newOrder = {
        orderId: generateOrderId(),
        createdAt: new Date().toLocaleString("ar-EG"),
        status: "pending",
        whatsappSent: true,
        items: clonedItems,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerAddress: customerInfo.address,
        customerLocation: customerInfo.location
    };

    activeOrders.unshift(newOrder);
    expandedOrderIds.add(newOrder.orderId);
    cart = [];
    saveCart();
    saveActiveOrders();
    updateCartUI();

    const msg = buildOrderWhatsAppMessage(newOrder, false, customerInfo);
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`);
}

function updateCartUI() {
    const container = document.getElementById("cartItemsContainer");
    const totalEl = document.getElementById("cartTotalAmount");
    const distinctEl = document.getElementById("cartDistinctCount");
    const piecesEl = document.getElementById("cartTotalPieces");
    const bottomBadge = document.getElementById("bottomCartCount");
    const currentCartTabBadge = document.getElementById("currentCartCountBadge");
    const currentCartPageChip = document.getElementById("currentCartPageChip");

    const totalPieces = getTotalCartPieces();
    const totalAmount = getTotalCartAmount();

    if (bottomBadge) {
        bottomBadge.textContent = String(totalPieces);
        bottomBadge.classList.toggle("visible", totalPieces > 0);
    }
    if (currentCartTabBadge) {
        currentCartTabBadge.textContent = String(totalPieces);
    }
    if (currentCartPageChip) {
        currentCartPageChip.textContent = `${totalPieces} ${totalPieces === 1 ? "قطعة" : "قطع"}`;
    }
    if (distinctEl) distinctEl.textContent = String(cart.length);
    if (piecesEl) piecesEl.textContent = String(totalPieces);
    if (totalEl) totalEl.textContent = `${formatPriceNumber(totalAmount)} جنيه`;

    if (container) {
        if (!cart.length) {
            container.innerHTML = `<div class="cart-empty">السلة فارغة حالياً<br>أضف منتجات من المتجر لبدء طلبك.</div>`;
        } else {
            container.innerHTML = cart.map((item, idx) => {
                const prod = PRODUCTS.find(p => p.id === item.id);
                const variantCfg = prod ? getProductVariantConfig(prod) : null;
                const unitP = getCartItemUnitPrice(item);
                const lineTotal = unitP * (item.qty || 1);
                const itemImg = item.selectedImg || item.img || (prod ? (getProductImagesList(prod)[0] || "") : "");

                let sizeControlHtml = "";
                if (variantCfg && variantCfg.sizes && variantCfg.sizes.length) {
                    const optTag = variantCfg.shortTag || resolveCartOptionShortTag(prod);
                    sizeControlHtml = `
                        <select class="cart-option-select" aria-label="${escapeHtmlAttr(optTag)}" onchange="updateCartItemSize(${idx}, this.value)">
                            ${variantCfg.sizes.map(sObj => `<option value="${escapeHtmlAttr(sObj.label)}" ${item.selectedSize === sObj.label ? "selected" : ""}>${escapeHtml(optTag)}: ${escapeHtml(sObj.label)}</option>`).join("")}
                        </select>
                    `;
                }

                let colorControlHtml = "";
                if (variantCfg && variantCfg.colors && variantCfg.colors.length) {
                    colorControlHtml = `
                        <select class="cart-option-select" aria-label="اللون" onchange="updateCartItemColor(${idx}, this.value)">
                            ${variantCfg.colors.map(c => `<option value="${escapeHtmlAttr(c)}" ${item.selectedColor === c ? "selected" : ""}>اللون: ${escapeHtml(c)}</option>`).join("")}
                        </select>
                    `;
                }

                return `
                    <div class="cart-item">
                        <div class="cart-item-top">
                            <img src="${escapeHtmlAttr(itemImg)}" alt="${escapeHtml(item.title)}" onerror="handleProductImageError(this, '${escapeHtmlAttr(item.id)}')">
                            <div class="cart-item-info">
                                <div class="cart-item-title">${escapeHtml(item.title)}</div>
                                ${item.merchant ? `<div class="cart-item-sub">التاجر: ${escapeHtml(item.merchant)}</div>` : ""}
                                <div class="cart-item-price">${formatPriceNumber(lineTotal)} جنيه</div>
                            </div>
                            <div class="qty-controls">
                                <button type="button" class="qty-btn" onclick="changeCartItemQty(${idx}, 1)">+</button>
                                <span class="qty-val">${item.qty || 1}</span>
                                <button type="button" class="qty-btn" onclick="changeCartItemQty(${idx}, -1)">-</button>
                                <button type="button" class="remove-item-btn" onclick="removeCartItem(${idx})" aria-label="حذف">✕</button>
                            </div>
                        </div>
                        ${(sizeControlHtml || colorControlHtml) ? `<div class="cart-item-options">${sizeControlHtml}${colorControlHtml}</div>` : ""}
                        <input type="text" class="cart-item-note-input" placeholder="ملاحظة خاصة بهذا المنتج (اختياري)..." value="${escapeHtmlAttr(item.note || "")}" onchange="updateCartItemNote(${idx}, this.value)">
                    </div>
                `;
            }).join("");
        }
    }

    renderActiveOrdersSection();
    renderReceivedOrdersSection();
    renderAppendOrderBanner();
    syncCartTabFooterVisibility();
}

function openCart(preferredTab = null) {
    closeCategoriesDrawer(false, true);
    if (preferredTab === "received" || preferredTab === "pending" || preferredTab === "cart") {
        switchCartOrdersTab(preferredTab);
    } else if (appendTargetOrderId) {
        switchCartOrdersTab("cart");
    } else if (!cart.length && activeOrders.length > 0) {
        switchCartOrdersTab("pending");
    } else {
        switchCartOrdersTab("cart");
    }

    loadCustomerProfileToInputs();
    updateCartUI();
    const drawer = document.getElementById("cartDrawer");
    const backdrop = document.getElementById("cartBackdrop");
    if (drawer) drawer.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("cart");
}

function closeCart(fromPopState = false, skipHistorySync = false) {
    const drawer = document.getElementById("cartDrawer");
    const backdrop = document.getElementById("cartBackdrop");
    if (drawer) drawer.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
    syncBodyScrollLock();
    if (!fromPopState && !skipHistorySync) removeOverlayState("cart");
}

function openCardProductPreview(imgBoxEl, productId) {
    const card = imgBoxEl ? imgBoxEl.closest(".product-card") : null;
    const prod = PRODUCTS.find(p => p.id === productId);
    const activeSrc = card && prod ? getActiveCardImageSrc(card, prod) : "";
    openImageModal(activeSrc, productId);
}

function renderPreviewModalSlide() {
    const modalImg = document.getElementById("modalImagePreview");
    const prevBtn = document.getElementById("previewPrevBtn");
    const nextBtn = document.getElementById("previewNextBtn");
    const thumbsRow = document.getElementById("previewThumbsRow");
    const waBtn = document.getElementById("previewWhatsAppBtn");
    const prod = PRODUCTS.find(p => p.id === previewModalState.productId);

    const imgs = previewModalState.imgs || [];
    const safeIdx = imgs.length ? (((previewModalState.idx % imgs.length) + imgs.length) % imgs.length) : 0;
    previewModalState.idx = safeIdx;
    const currentImg = imgs[safeIdx] || "";

    if (modalImg) {
        modalImg.setAttribute("data-retry-step", "0");
        modalImg.style.opacity = "1";
        modalImg.removeAttribute("data-broken");
        modalImg.src = currentImg;
        modalImg.setAttribute("data-product-id", previewModalState.productId || "");
    }

    const hasMany = imgs.length > 1;
    if (prevBtn) prevBtn.classList.toggle("is-hidden", !hasMany);
    if (nextBtn) nextBtn.classList.toggle("is-hidden", !hasMany);

    if (thumbsRow) {
        if (hasMany) {
            thumbsRow.classList.remove("is-hidden");
            thumbsRow.innerHTML = imgs.map((u, idx) => `
                <button type="button" class="preview-thumb-btn ${idx === safeIdx ? "active" : ""}" onclick="selectPreviewThumb(${idx}, event)" aria-label="صورة ${idx + 1}">
                    <img src="${escapeHtmlAttr(u)}" alt="">
                </button>
            `).join("");
        } else {
            thumbsRow.classList.add("is-hidden");
            thumbsRow.innerHTML = "";
        }
    }

    if (waBtn && prod) {
        waBtn.href = buildProductWhatsAppUrl(prod, currentImg);
    }
}

function stepPreviewImage(delta, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!previewModalState.imgs || previewModalState.imgs.length <= 1) return;
    previewModalState.idx += delta;
    renderPreviewModalSlide();
}

function selectPreviewThumb(idx, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    previewModalState.idx = Number(idx) || 0;
    renderPreviewModalSlide();
}

function openImageModal(src, productId = "") {
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImagePreview");
    const titleEl = document.getElementById("previewProductTitle");
    const priceEl = document.getElementById("previewMainPrice");
    const subPriceEl = document.getElementById("previewSubPrice");
    const catChip = document.getElementById("previewCategoryChip");
    const merchantChip = document.getElementById("previewMerchantChip");
    const storyEl = document.getElementById("previewStoryText");
    const hookEl = document.getElementById("previewHookNote");
    const relatedSection = document.getElementById("previewRelatedSection");
    const relatedList = document.getElementById("previewRelatedList");
    const addBtn = document.getElementById("previewAddToCartBtn");
    const waBtn = document.getElementById("previewWhatsAppBtn");
    const copyLinkBtn = document.getElementById("previewCopyLinkBtn");
    if (!modal || !modalImg) return;

    const prod = PRODUCTS.find(p => p.id === productId) || PRODUCTS.find(p => p.img === src) || null;
    const prodImgs = prod ? getProductImagesList(prod) : [];
    const normalizedSrc = normalizeProductImageUrl(src);
    const mergedImgs = Array.from(new Set([normalizedSrc, ...prodImgs].filter(Boolean)));
    const startIdx = normalizedSrc && mergedImgs.includes(normalizedSrc) ? mergedImgs.indexOf(normalizedSrc) : 0;

    previewModalState = {
        productId: prod ? prod.id : productId,
        imgs: mergedImgs,
        idx: startIdx
    };

    renderPreviewModalSlide();

    if (prod) {
        trackProductInterest(prod, 2, true);
        const displayPrice = formatPriceNumber(prod.priceLabel || prod.price);
        if (titleEl) titleEl.textContent = prod.title;
        if (priceEl) priceEl.innerHTML = `${displayPrice} <span>جنيه</span>`;
        if (subPriceEl) {
            if (prod.subPrice) {
                subPriceEl.textContent = prod.subPrice;
                subPriceEl.classList.remove("is-hidden");
            } else {
                subPriceEl.classList.add("is-hidden");
            }
        }
        if (catChip) catChip.textContent = CATEGORY_NAMES[prod.category] || "متجر كارامل";
        if (merchantChip) {
            if (prod.merchant) {
                merchantChip.textContent = `التاجر: ${prod.merchant}`;
                merchantChip.classList.remove("is-hidden");
                merchantChip.onclick = () => {
                    const mName = prod.merchant;
                    closeImageModal();
                    filterByMerchant(mName);
                };
            } else {
                merchantChip.classList.add("is-hidden");
            }
        }
        if (storyEl) storyEl.textContent = prod.desc || "اختيار مميز من تشكيلة متجر كارامل بجودة عالية وسعر مناسب.";
        if (hookEl) hookEl.textContent = prod.merchant ? `متاح للطلب الفوري من ${prod.merchant} عبر السلة أو واتساب.` : "متاح للطلب الفوري عبر السلة أو واتساب.";
        if (copyLinkBtn) {
            copyLinkBtn.classList.remove("is-hidden");
            copyLinkBtn.onclick = e => copyProductShareLink(prod.id, e);
        }

        if (relatedSection && relatedList) {
            const relatedPool = PRODUCTS.filter(item =>
                item.id !== prod.id &&
                !isProductOutOfStock(item) &&
                (
                    (prod.merchant && item.merchant === prod.merchant) ||
                    item.category === prod.category
                )
            ).slice(0, 4);

            if (relatedPool.length) {
                relatedSection.classList.remove("is-hidden");
                relatedList.innerHTML = relatedPool.map(rel => `
                    <button type="button" class="preview-related-chip" onclick="openImageModal('${escapeHtmlAttr(rel.img)}', '${escapeHtmlAttr(rel.id)}')">
                        <img src="${escapeHtmlAttr(rel.img)}" alt="${escapeHtml(rel.title)}" onerror="handleProductImageError(this, '${escapeHtmlAttr(rel.id)}')">
                        <div class="preview-related-meta">
                            <span class="preview-related-title">${escapeHtml(rel.title)}</span>
                            <span class="preview-related-price">${formatPriceNumber(rel.priceLabel || rel.price)} ج</span>
                        </div>
                    </button>
                `).join("");
            } else {
                relatedSection.classList.add("is-hidden");
                relatedList.innerHTML = "";
            }
        }

        if (addBtn) {
            const prodSoldOut = isProductOutOfStock(prod);
            addBtn.disabled = prodSoldOut;
            addBtn.classList.toggle("is-disabled", prodSoldOut);
            addBtn.textContent = prodSoldOut ? "نفدت الكمية" : "أضف للسلة الجارية";
            addBtn.onclick = prodSoldOut ? null : () => {
                const chosenPreviewImg = previewModalState.imgs[previewModalState.idx] || prod.img || "";
                closeImageModal();
                const variantCfg = getProductVariantConfig(prod);
                if (variantCfg) {
                    openProductOptionModal(prod, null, chosenPreviewImg);
                } else {
                    addToCart(prod.id, null, { selectedImg: chosenPreviewImg });
                }
            };
        }
        if (waBtn) {
            const chosenPreviewImg = previewModalState.imgs[previewModalState.idx] || prod.img || "";
            waBtn.href = buildProductWhatsAppUrl(prod, chosenPreviewImg);
            waBtn.onclick = e => {
                e.preventDefault();
                launchWhatsAppTarget(waBtn.href);
            };
        }
    } else {
        if (titleEl) titleEl.textContent = "معاينة المنتج";
        if (priceEl) priceEl.textContent = "";
        if (subPriceEl) subPriceEl.classList.add("is-hidden");
        if (catChip) catChip.textContent = "متجر كارامل";
        if (merchantChip) merchantChip.classList.add("is-hidden");
        if (storyEl) storyEl.textContent = "";
        if (hookEl) hookEl.textContent = "";
        if (relatedSection) relatedSection.classList.add("is-hidden");
        if (copyLinkBtn) copyLinkBtn.classList.add("is-hidden");
        if (addBtn) addBtn.onclick = closeImageModal;
        if (waBtn) {
            waBtn.href = `https://wa.me/${WHATSAPP_NUMBER}`;
            waBtn.onclick = e => {
                e.preventDefault();
                launchWhatsAppTarget(waBtn.href);
            };
        }
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

function openBecomeMerchantModal() {
    const modal = document.getElementById("becomeMerchantModal");
    if (!modal) return;
    modal.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("becomeMerchant");
    setTimeout(() => {
        const nameInput = document.getElementById("merchantRegName");
        if (nameInput) nameInput.focus();
    }, 60);
}

function closeBecomeMerchantModal(fromPopState = false) {
    const modal = document.getElementById("becomeMerchantModal");
    if (modal) modal.classList.remove("open");
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("becomeMerchant");
}

function submitBecomeMerchantForm(event) {
    if (event) event.preventDefault();
    const nameInput = document.getElementById("merchantRegName");
    const activityInput = document.getElementById("merchantRegActivity");
    const phoneInput = document.getElementById("merchantRegPhone");

    const merchantName = nameInput ? nameInput.value.trim() : "";
    const activityName = activityInput ? activityInput.value.trim() : "";
    const phoneNumber = phoneInput ? phoneInput.value.trim() : "";

    if (!merchantName || !activityName || !phoneNumber) {
        showCaramelToast("يرجى إدخال الاسم والنشاط ورقم التواصل");
        return;
    }

    const message = [
        "طلب انضمام تاجر جديد — متجر كارامل",
        `الاسم: ${merchantName}`,
        `النشاط: ${activityName}`,
        `رقم التواصل: ${phoneNumber}`
    ].join("\n");

    closeBecomeMerchantModal();
    if (event && event.target && typeof event.target.reset === "function") {
        event.target.reset();
    }
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`);
}

let suppressHistoryStep = false;

function hasAnyOverlayOpen() {
    return Boolean(
        document.getElementById("cartDrawer")?.classList.contains("open") ||
        document.getElementById("catsDrawer")?.classList.contains("open") ||
        document.getElementById("imageModal")?.classList.contains("open") ||
        document.getElementById("productOptionModal")?.classList.contains("open") ||
        document.getElementById("serviceInfoModal")?.classList.contains("open") ||
        document.getElementById("becomeMerchantModal")?.classList.contains("open") ||
        document.getElementById("confirmActionModal")?.classList.contains("open")
    );
}

function syncBodyScrollLock() {
    document.body.classList.toggle("modal-open", hasAnyOverlayOpen());
}

function pushOverlayState(kind) {
    overlayStack.push(kind);
    try {
        history.pushState({ caramelOverlay: kind, depth: overlayStack.length }, "");
    } catch (e) {}
}

function removeOverlayState(kind) {
    const idx = overlayStack.lastIndexOf(kind);
    if (idx !== -1) {
        overlayStack.splice(idx, 1);
    }
}

function closeTopOverlay(fromPopState = false) {
    const top = overlayStack.pop();
    if (!top) return;

    if (top === "image") closeImageModal(true);
    else if (top === "option") closeProductOptionModal(true);
    else if (top === "serviceInfo") closeServiceInfoModal(true);
    else if (top === "becomeMerchant") closeBecomeMerchantModal(true);
    else if (top === "confirm") closeConfirmModal(true, true);
    else if (top === "cart") closeCart(true, true);
    else if (top === "cats") closeCategoriesDrawer(true, true);

    if (!fromPopState && !suppressHistoryStep && window.history && window.history.state && window.history.state.caramelOverlay) {
        suppressHistoryStep = true;
        try {
            history.back();
        } catch (e) {
            suppressHistoryStep = false;
        }
        setTimeout(() => { suppressHistoryStep = false; }, 120);
    }
}

function closeAllOverlays() {
    while (overlayStack.length > 0) {
        closeTopOverlay(false);
    }
    closeImageModal(true);
    closeProductOptionModal(true);
    closeServiceInfoModal(true);
    closeBecomeMerchantModal(true);
    closeConfirmModal(true, false);
    closeCart(true, true);
    closeCategoriesDrawer(true, true);
}

let pushPillAutoHideTimer = null;

function renderPushPillIcon(isSubscribed) {
    const iconEl = document.getElementById("caramelPushIcon");
    if (!iconEl) return;
    if (isSubscribed) {
        iconEl.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
        iconEl.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
    }
}

function schedulePushPillAutoHide() {
    const btn = document.getElementById("caramelPushBtn");
    if (!btn) return;
    clearTimeout(pushPillAutoHideTimer);
    pushPillAutoHideTimer = setTimeout(() => {
        btn.classList.add("hiding-smooth");
        setTimeout(() => {
            btn.classList.remove("visible");
            btn.classList.remove("hiding-smooth");
        }, 320);
    }, 3000);
}

function syncPushButtonState() {
    const btn = document.getElementById("caramelPushBtn");
    const txt = document.getElementById("caramelPushBtnText");
    if (!btn || !txt) return;

    const isGranted = ("Notification" in window) && Notification.permission === "granted";
    renderPushPillIcon(isGranted);

    if (isGranted) {
        txt.textContent = "تم تفعيل الإشعارات";
        btn.classList.add("visible");
        btn.classList.add("circle-check-only");
        btn.setAttribute("aria-label", "الإشعارات مفعّلة");
        schedulePushPillAutoHide();
    } else {
        clearTimeout(pushPillAutoHideTimer);
        btn.classList.remove("circle-check-only");
        btn.classList.remove("hiding-smooth");
        btn.classList.add("visible");
        txt.textContent = "فعّل إشعارات العروض";
        btn.setAttribute("aria-label", "فعّل إشعارات العروض");
    }
}

async function enableCaramelPush() {
    if (!("Notification" in window)) {
        showCaramelToast("متصفحك لا يدعم إشعارات التنبيه المباشرة");
        return;
    }

    if (Notification.permission === "granted") {
        syncLiveCatalogNow({ force: true, silentIfUnchanged: false, showToastOnChange: true });
        syncPushButtonState();
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        syncPushButtonState();
        if (permission === "granted") {
            showCaramelToast("تم تفعيل إشعارات العروض والمنتجات الجديدة بنجاح!");
            if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.ready.catch(() => null);
                if (reg && reg.showNotification) {
                    reg.showNotification("متجر كارامل", {
                        body: "تم تفعيل إشعارات العروض والمنتجات الجديدة بنجاح!",
                        icon: BRAND_LOGO_URL,
                        badge: BRAND_LOGO_URL,
                        dir: "rtl",
                        lang: "ar"
                    });
                }
            }
        } else if (permission === "denied") {
            showCaramelToast("تم رفض الإشعارات — يمكنك تفعيلها من إعدادات المتصفح");
        }
    } catch (e) {
        showCaramelToast("تعذر تفعيل الإشعارات حالياً");
    }
}

function dismissSplashScreen() {
    const splash = document.getElementById("caramelSplashScreen");
    if (!splash || splash.classList.contains("hide")) return;
    splash.classList.add("hide");
    setTimeout(() => { if (splash && splash.parentNode) splash.remove(); }, 460);
}

function runSplashSloganSequence() {
    const subRect = document.getElementById("caramelSplashSubRect");
    const typedTextEl = document.getElementById("caramelSplashTypedText");
    const fullText = "كل قطعة وليها دور";

    if (typedTextEl) typedTextEl.textContent = fullText;
    if (!subRect) return;

    setTimeout(() => {
        subRect.classList.add("descend-in");
    }, 180);
}

(function initCaramelSplash() {
    syncBrandLogos();
    runSplashSloganSequence();
    setTimeout(dismissSplashScreen, 1350);
    window.addEventListener("load", () => {
        syncBrandLogos();
        setTimeout(dismissSplashScreen, 450);
    });
})();

initThemeMode();
syncBrandLogos();
syncSupportWhatsAppLinks();
renderMerchantsQuickStrip();
renderSmartSearchSuggestions();
renderSpotlightBoxes();
renderProducts("all");
updateCartUI();
updateWishlistUI();
setupInfiniteScrollObserver();
syncPushButtonState();
syncHeaderStickyOffsets();
loadMerchantProductsFromJson(false, { silentIfUnchanged: true, showToastOnChange: false });
startLiveCatalogAutoSync();
