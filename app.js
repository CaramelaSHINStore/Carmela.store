const APP_BUILD_VERSION = "v20261127-13";
const APPLIED_BUILD_KEY = "caramel_applied_build_version_v1";
const CART_STORAGE_KEY = "caramel_store_cart_v1";
const WISHLIST_STORAGE_KEY = "caramel_wishlist_v1";
const ACTIVE_ORDERS_STORAGE_KEY = "caramel_active_orders_v1";
const RECEIVED_ORDERS_STORAGE_KEY = "caramel_received_orders_v1";
const INTEREST_STORAGE_KEY = "caramel_smart_interest_v1";
const THEME_STORAGE_KEY = "caramel_store_theme_mode_v1";
const CUSTOMER_PROFILE_KEY = "caramel_customer_profile_v1";
const SEARCH_HISTORY_KEY = "caramel_search_history_v1";
const PUSH_SUBSCRIBED_KEY = "caramel_push_subscribed_v1";
const PUSH_PILL_COLLAPSED_KEY = "caramel_push_pill_collapsed_v1";

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

let WHATSAPP_NUMBER = "201055436305";
let STORE_URL = "https://caramelstoresuez.github.io/Carmelastore/";
let BRAND_LOGO_URL = "./compressed_1795766509611.jpeg?v=v20261127-13";

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

function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

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

function applyStoreConfigFromPayload(cfg) {
    if (!cfg || typeof cfg !== "object") return false;
    let changed = false;

    const rawWa = cfg.whatsappNumber ?? cfg.whatsapp ?? cfg.waNumber ?? cfg.phone ?? cfg.supportPhone ?? "";
    const cleanWa = String(rawWa || "").replace(/\D/g, "").trim();
    if (cleanWa && cleanWa.length >= 8) {
        WHATSAPP_NUMBER = cleanWa;
        changed = true;
    }

    const rawStoreUrl = cfg.storeUrl ?? cfg.siteUrl ?? cfg.url ?? cfg.website ?? "";
    if (typeof rawStoreUrl === "string" && rawStoreUrl.trim()) {
        const trimmedUrl = rawStoreUrl.trim();
        STORE_URL = trimmedUrl.endsWith("/") ? trimmedUrl : `${trimmedUrl}/`;
        changed = true;
    }

    const rawLogo = cfg.brandLogoUrl ?? cfg.logoUrl ?? cfg.logo ?? cfg.brandLogo ?? "";
    if (typeof rawLogo === "string" && rawLogo.trim()) {
        BRAND_LOGO_URL = normalizeProductImageUrl(rawLogo.trim()) || BRAND_LOGO_URL;
        changed = true;
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

async function loadStoreConfigFromJson(forceRefresh = false) {
    const qSuffix = forceRefresh ? `?ts=${Date.now()}` : "";
    for (const basePath of STORE_CONFIG_JSON_CANDIDATES) {
        const rawFallback = `https://raw.githubusercontent.com/${GITHUB_MERCHANTS_CONFIG.owner}/${GITHUB_MERCHANTS_CONFIG.repo}/${GITHUB_MERCHANTS_CONFIG.branch}/${basePath.replace(/^\.\//, "")}`;
        const urls = [`${basePath}${qSuffix}`, `${rawFallback}${qSuffix}`];
        for (const url of urls) {
            try {
                const resp = await fetch(url, { cache: forceRefresh ? "no-store" : "default" });
                if (resp && resp.ok) {
                    const text = (await resp.text()).replace(/^\uFEFF/, "").trim();
                    if (!text) continue;
                    const parsed = JSON.parse(text);
                    const targetObj = (parsed && typeof parsed === "object" && parsed.storeConfig && typeof parsed.storeConfig === "object")
                        ? parsed.storeConfig
                        : ((parsed && typeof parsed === "object" && parsed.config && typeof parsed.config === "object")
                            ? parsed.config
                            : parsed);
                    if (applyStoreConfigFromPayload(targetObj)) {
                        return targetObj;
                    }
                }
            } catch (e) {}
        }
    }
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
let pushPillHideTimer = null;
let suppressHistoryStep = false;
let overlayStack = [];
let customerLocationCoords = null;

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
            if (!img.getAttribute("src")) {
                img.src = BRAND_LOGO_URL;
            }
            img.alt = "لوجو متجر كارامل - Caramel Store";
        }
    });
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach(linkEl => {
        if (!linkEl.getAttribute("href")) {
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

function showCaramelToast(message) {
    const toastEl = document.getElementById("caramelToast");
    if (!toastEl || !message) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.classList.remove("show"); }, 3200);
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

function isProductOutOfStock(product) {
    if (!product) return false;
    return Boolean(product.outOfStock) || (typeof product.stock === "number" && product.stock <= 0);
}

function isProductImageSoldOut(product, imgSrc) {
    if (!product) return false;
    if (isProductOutOfStock(product)) return true;
    if (!Array.isArray(product.soldOutImages) || !product.soldOutImages.length) {
        return false;
    }
    const target = normalizeProductImageUrl(imgSrc);
    if (!target) return false;
    const soldSet = new Set(
        product.soldOutImages.map(u => normalizeProductImageUrl(u)).filter(Boolean)
    );
    return soldSet.has(target);
}

function syncSoldOutOverlayOnElement(mediaEl, isSoldOut, labelText = "نفدت الكمية") {
    if (!mediaEl || !mediaEl.parentElement) return;
    let wrap = mediaEl.parentElement.classList.contains("media-soldout-wrap")
        ? mediaEl.parentElement
        : mediaEl.parentElement.closest(".media-soldout-wrap");

    if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "media-soldout-wrap";
        mediaEl.parentNode.insertBefore(wrap, mediaEl);
        wrap.appendChild(mediaEl);
    }

    wrap.classList.toggle("is-soldout", Boolean(isSoldOut));
    let badge = wrap.querySelector(":scope > .soldout-badge-overlay");
    if (isSoldOut) {
        if (!badge) {
            badge = document.createElement("span");
            badge.className = "soldout-badge-overlay";
            badge.textContent = labelText;
            wrap.appendChild(badge);
        } else {
            badge.textContent = labelText;
        }
    } else if (badge) {
        badge.remove();
    }
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

function isAppRunningStandalone() {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.navigator && window.navigator.standalone === true) return true;
    return false;
}

function getSavedAppliedBuildVersion() {
    try { return localStorage.getItem(APPLIED_BUILD_KEY) || ""; } catch (e) { return ""; }
}

function setSavedAppliedBuildVersion(ver) {
    try { localStorage.setItem(APPLIED_BUILD_KEY, String(ver || "")); } catch (e) {}
}

let pendingUpdateAvailable = false;

function syncHeaderInstallOrUpdateButton() {
    const headerBtn = document.getElementById("headerInstallBtn");
    if (!headerBtn) return;

    const standalone = isAppRunningStandalone();
    const savedBuild = getSavedAppliedBuildVersion();
    const hasNewBuild = standalone && savedBuild !== APP_BUILD_VERSION;
    const needsUpdate = Boolean(pendingUpdateAvailable || hasNewBuild);

    if (needsUpdate) {
        headerBtn.textContent = "تحديث";
        headerBtn.classList.add("visible");
        headerBtn.style.display = "inline-flex";
        headerBtn.setAttribute("aria-label", "تحديث التطبيق");
        return;
    }

    if (standalone) {
        headerBtn.textContent = "تثبيت";
        headerBtn.classList.remove("visible");
        headerBtn.style.display = "none";
        return;
    }

    if (deferredInstallPrompt) {
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
    pendingUpdateAvailable = false;

    const cleanUrl = window.location.pathname + window.location.search + window.location.hash;
    const sep = cleanUrl.includes("?") ? "&" : "?";
    window.location.replace(`${cleanUrl}${sep}sw_refresh=${Date.now()}`);
}

function handleInstallOrUpdateAction() {
    const standalone = isAppRunningStandalone();
    const savedBuild = getSavedAppliedBuildVersion();
    const needsUpdate = Boolean(pendingUpdateAvailable || (standalone && savedBuild !== APP_BUILD_VERSION));

    if (needsUpdate) {
        applyStoreUpdateAndHideButton();
        return;
    }
    triggerInstallApp();
}

window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    setSavedAppliedBuildVersion(APP_BUILD_VERSION);
    pendingUpdateAvailable = false;
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
        setSavedAppliedBuildVersion("legacy-installed");
    }
    syncHeaderInstallOrUpdateButton();

    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", async () => {
        try {
            const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" });
            if (reg.waiting && navigator.serviceWorker.controller) {
                pendingUpdateAvailable = true;
                syncHeaderInstallOrUpdateButton();
            }
            reg.update().catch(() => {});
            reg.addEventListener("updatefound", () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener("statechange", () => {
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                        pendingUpdateAvailable = true;
                        syncHeaderInstallOrUpdateButton();
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

async function discoverMerchantJsonSources(forceRefresh = false) {
    const sourcesMap = new Map();
    const qSuffix = forceRefresh ? `?ts=${Date.now()}` : "";

    const registerJsonPath = (relPath, customDownloadUrl = "") => {
        const normalizedPath = String(relPath || "").replace(/^\.?\/+/ , "").trim();
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

    let loadedManifest = false;
    try {
        const indexJsonResp = await fetch(`./merchants/index.json${qSuffix}`, { cache: forceRefresh ? "no-store" : "default" });
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
            const apiUrl = `https://api.github.com/repos/${GITHUB_MERCHANTS_CONFIG.owner}/${GITHUB_MERCHANTS_CONFIG.repo}/contents/${GITHUB_MERCHANTS_CONFIG.folder}?ref=${GITHUB_MERCHANTS_CONFIG.branch}`;
            const apiResp = await fetch(apiUrl, { cache: forceRefresh ? "no-store" : "default" });
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
    const qSuffix = forceRefresh ? `?ts=${Date.now()}` : "";
    const urlsToTry = [
        `${source.localUrl}${qSuffix}`,
        `${source.rawUrl}${qSuffix}`
    ];
    for (const url of urlsToTry) {
        try {
            const resp = await fetch(url, { cache: forceRefresh ? "no-store" : "default" });
            if (resp && resp.ok) {
                const text = await resp.text();
                const cleanText = text.replace(/^\uFEFF/, "").trim();
                if (cleanText) return JSON.parse(cleanText);
            }
        } catch (e) {}
    }
    return null;
}

async function loadMerchantProductsFromJson(forceRefresh = false) {
    isLoadingJsonProducts = true;
    renderProducts(currentCategory);
    await loadStoreConfigFromJson(forceRefresh);

    const merchantSources = await discoverMerchantJsonSources(forceRefresh);
    const jsonProductsById = new Map();

    const fetchedPayloads = await Promise.all(
        merchantSources.map(async source => ({
            source,
            payload: await fetchJsonWithFallback(source, forceRefresh)
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
    PRODUCTS.splice(0, PRODUCTS.length, ...loadedList);
    rebuildSearchIndex();
    isLoadingJsonProducts = false;

    renderSmartSearchSuggestions();
    renderSpotlightBoxes();
    renderProducts(currentCategory);
    updateCartUI();
    updateWishlistUI();
    applyUrlDeepLinkParams();
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
        const cleanPath = currentSrc.replace(/^\.\?\//, "");
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
    try { localStorage.setItem(ACTIVE_ORDERS_STORAGE_KEY, JSON.stringify(activeOrders)); } catch (e) {}
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
    try { localStorage.setItem(RECEIVED_ORDERS_STORAGE_KEY, JSON.stringify(receivedOrders)); } catch (e) {}
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
    const arabicMap = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
    return String(str || "").replace(/[٠-٩۰-۹]/g, ch => arabicMap[ch] || ch);
}

function normalizeText(str) {
    return normalizeArabicDigits(str || "")
        .toLowerCase()
        .replace(/[ً-ٰٟ]/g, "")
        .replace(/[إأآاٱ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي")
        .replace(/[-_×*\/\()\[\]{}.,،:؛!؟+]+/g, " ")
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
    const skipKeys = new Set(["id", "code", "sku", "img", "image", "photo", "imgUrl", "imageUrl", "thumbnail", "thumb", "picture", "pic", "images", "photos", "imgs", "gallery", "_extraSearchText", "merchant", "seller", "vendor", "store", "owner"]);
    const parts = [];
    Object.entries(product).forEach(([k, v]) => {
        if (skipKeys.has(k) || v === null || v === undefined) return;
        if (typeof v === "string" || typeof v === "number") parts.push(String(v));
        else if (Array.isArray(v)) {
            v.forEach(item => {
                if (typeof item === "string" || typeof item === "number") parts.push(String(item));
            });
        }
    });
    product._extraSearchText = parts.join(" ");
    return product._extraSearchText;
}

function getSearchableText(product) {
    if (product._cachedSearchBlob) return product._cachedSearchBlob;
    const catName = CATEGORY_NAMES[product.category] || product.category || "";
    const extraCats = Array.isArray(product.categories) ? product.categories.map(c => CATEGORY_NAMES[c] || c).join(" ") : "";
    const extraDynamic = buildDynamicSearchTextForProduct(product);
    const rawBlob = `${product.id || ""} ${product.title || ""} ${product.desc || ""} ${product.merchant || ""} ${product.price || ""} ${product.priceLabel || ""} ${product.subPrice || ""} ${product.badge || ""} ${catName} ${extraCats} ${extraDynamic}`;
    const normBlob = normalizeText(rawBlob);
    product._cachedSearchBlob = normBlob;
    product._cachedSearchWords = normBlob ? normBlob.split(" ") : [];
    return normBlob;
}

function rebuildSearchIndex() {
    PRODUCTS.forEach(p => {
        delete p._cachedSearchBlob;
        delete p._cachedSearchWords;
        getSearchableText(p);
    });
}

function scoreProductForQuery(product, rawQuery) {
    const q = normalizeText(rawQuery);
    if (!q) return 0;

    const blob = getSearchableText(product);
    const words = product._cachedSearchWords || blob.split(" ");
    const normTitle = normalizeText(product.title || "");
    const normMerchant = normalizeText(product.merchant || "");

    const priceMatch = q.match(/(?:اقل من|تحت|حتى|ب|سعر|حدود)?\s*(\d+)\s*(?:ج|جنيه)?/);
    const maxPriceFilter = priceMatch ? parseFloat(priceMatch[1]) : 0;

    const terms = q.split(" ").filter(t => t && !["في", "من", "على", "عن", "ب", "ال", "سعر", "حدود", "اقل", "تحت", "حتى", "ج", "جنيه"].includes(t));

    if (!terms.length && maxPriceFilter > 0) {
        return Number(product.price) <= maxPriceFilter ? 50 : -1;
    }

    let totalScore = 0;

    for (const term of terms) {
        const variants = expandTermVariants(term);
        let termMatched = false;
        let bestTermScore = 0;

        for (const v of variants) {
            if (normTitle.includes(v)) {
                termMatched = true;
                bestTermScore = Math.max(bestTermScore, normTitle.startsWith(v) ? 120 : 95);
            }
            if (normMerchant.includes(v)) {
                termMatched = true;
                bestTermScore = Math.max(bestTermScore, 88);
            }
            if (blob.includes(v)) {
                termMatched = true;
                bestTermScore = Math.max(bestTermScore, 65);
            }
            if (!termMatched) {
                for (const w of words) {
                    if (termMatchesWord(v, w)) {
                        termMatched = true;
                        bestTermScore = Math.max(bestTermScore, 42);
                        break;
                    }
                }
            }
        }

        if (!termMatched) return -1;
        totalScore += bestTermScore;
    }

    if (maxPriceFilter > 0) {
        const pPrice = Number(product.price) || 0;
        if (pPrice > 0 && pPrice <= maxPriceFilter) totalScore += 35;
        else totalScore -= 15;
    }

    return totalScore;
}

function getAllUniqueMerchants() {
    const map = new Map();
    PRODUCTS.forEach(p => {
        if (p.merchant && p.merchant.trim()) {
            const m = p.merchant.trim();
            map.set(m, (map.get(m) || 0) + 1);
        }
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
}

function getMerchantAvatarInitial(merchantName) {
    const clean = String(merchantName || "ت").trim().replace(/^(ال|أبو|أبـو|أم|ام)\s+/i, "");
    return clean.charAt(0) || "ت";
}

function renderSideCategoriesList() {
    const container = document.getElementById("sideCategoriesList");
    if (!container) return;

    const merchants = getAllUniqueMerchants();
    const isDark = document.body.classList.contains("dark-theme");
    const catKeys = Object.keys(CATEGORY_NAMES);
    let html = catKeys.map(key => {
        const active = !currentMerchant && currentCategory === key;
        const label = CATEGORY_NAMES[key];
        const desc = CATEGORY_SUBTITLES[key] || "";
        const meta = CATEGORY_THEME_META[key] || CATEGORY_THEME_META.all;
        const badgeBg = isDark ? "rgba(255, 255, 255, 0.08)" : meta.bg;
        const iconStroke = isDark ? meta.bar : meta.stroke;
        return `
            <button type="button" class="clean-cat-tile ${active ? "active" : ""}" onclick="selectSideCategory('${key}')">
                <span class="clean-cat-top-row">
                    <span class="clean-cat-icon-badge" style="background:${badgeBg};">${buildCategoryGraphicSvg(key, iconStroke)}</span>
                    <span class="clean-cat-label">${escapeHtml(label)}</span>
                </span>
                ${desc ? `<span class="clean-cat-desc">${escapeHtml(desc)}</span>` : ""}
            </button>
        `;
    }).join("");

    if (merchants.length) {
        html += `
            <div style="grid-column:1 / -1; margin-top:10px; padding-top:10px; border-top:1px solid var(--border-subtle);">
                <div style="font-size:0.78rem; font-weight:800; color:var(--text-muted); margin-bottom:8px;">متاجر وأقسام التجار (${merchants.length})</div>
                <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:7px;">
                    ${merchants.map(m => {
                        const isSelectedMerchant = currentMerchant === m.name;
                        const initial = getMerchantAvatarInitial(m.name);
                        return `
                            <button type="button" class="clean-cat-tile ${isSelectedMerchant ? "active" : ""}" onclick="selectMerchantFromDrawer('${escapeHtmlAttr(m.name)}')">
                                <span class="clean-cat-top-row">
                                    <span class="clean-cat-icon-badge" style="background:rgba(200,150,102,0.18);font-weight:900;font-size:0.78rem;">${escapeHtml(initial)}</span>
                                    <span class="clean-cat-label">${escapeHtml(m.name)}</span>
                                </span>
                                <span class="clean-cat-desc">${m.count} منتج</span>
                            </button>
                        `;
                    }).join("")}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function selectSideCategory(categoryKey) {
    closeCategoriesDrawer();
    const tabBtn = document.querySelector(`.quick-top-tabs .quick-tab-item[data-quick="${categoryKey}"]`);
    filterByCategory(categoryKey, tabBtn || null);
    scrollToProductsTop();
}

function selectMerchantFromDrawer(merchantName) {
    closeCategoriesDrawer();
    filterByMerchant(merchantName);
    scrollToProductsTop();
}

function filterByMerchant(merchantName, silent = false) {
    currentMerchant = (merchantName || "").trim();
    currentCategory = "all";
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => {
        el.classList.toggle("active", el.getAttribute("data-quick") === "all");
    });
    applyCategoryPageMood("all");
    document.body.classList.toggle("merchant-storefront-mode", Boolean(currentMerchant));

    const banner = document.getElementById("activeMerchantBanner");
    const nameEl = document.getElementById("merchantBannerName");
    const countEl = document.getElementById("merchantBannerCount");
    const avatarEl = document.getElementById("merchantAvatarInitial");

    if (banner && nameEl && countEl) {
        if (currentMerchant) {
            const count = PRODUCTS.filter(p => p.merchant === currentMerchant).length;
            nameEl.textContent = currentMerchant;
            countEl.textContent = `${count} منتج متاح في قسم التاجر`;
            if (avatarEl) avatarEl.textContent = getMerchantAvatarInitial(currentMerchant);
            renderMerchantInnerCategories(currentMerchant);
            banner.classList.add("visible");
        } else {
            renderMerchantInnerCategories("");
            banner.classList.remove("visible");
        }
    }

    renderProducts("all");
    if (!silent && currentMerchant) showCaramelToast(`تم فتح صفحة التاجر: ${currentMerchant}`);
}

function clearMerchantFilter(scrollTop = false) {
    currentMerchant = "";
    currentCategory = "all";
    document.body.classList.remove("merchant-storefront-mode");
    renderMerchantInnerCategories("");
    const banner = document.getElementById("activeMerchantBanner");
    if (banner) banner.classList.remove("visible");
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => {
        el.classList.toggle("active", el.getAttribute("data-quick") === "all");
    });
    applyCategoryPageMood("all");
    renderProducts("all");
    if (scrollTop) scrollToProductsTop();
}

function buildProductCardHTML(product, badgeText = "") {
    const safeId = escapeHtmlAttr(product.id);
    const safeTitle = escapeHtml(product.title);
    const safeTitleAttr = escapeHtmlAttr(product.title);
    const displayPrice = product.priceLabel || product.price;
    const safePriceFormatted = escapeHtml(formatPriceNumber(displayPrice));
    const safeSub = product.subPrice ? escapeHtml(product.subPrice) : "";
    const safeDesc = product.desc ? escapeHtml(product.desc) : "";
    const imgs = getProductImagesList(product);
    const firstImg = imgs[0] || "";
    const hasMultipleImgs = imgs.length > 1;
    const safeFirstImgAttr = escapeHtmlAttr(firstImg);
    const safeMerchantAttr = escapeHtmlAttr(product.merchant || "");
    const safeMerchantText = escapeHtml(product.merchant || "");
    const waUrl = buildProductWhatsAppUrl(product, firstImg);
    const safeWaUrlAttr = escapeHtmlAttr(waUrl);
    const isFav = wishlistIds.includes(String(product.id));
    const badgeLabel = badgeText || product.badge || "";
    const customStyleClass = product.cardStyle === "gold" ? "card-style-gold" : "";
    const isOut = isProductOutOfStock(product);
    const isFirstSoldOut = isProductImageSoldOut(product, firstImg);
    const soldOutAttr = isOut ? "data-product-soldout="1"" : "";
    const soldOutCardCls = isOut ? "is-product-soldout" : "";
    const soldOutBadgeHtml = isFirstSoldOut ? `<span class="soldout-badge-overlay">نفدت الكمية</span>` : "";
    const addBtnDisabledAttr = isOut ? "disabled aria-disabled="true"" : "";
    const addBtnCls = isOut ? "add-cart-btn is-disabled" : "add-cart-btn";
    const addBtnText = isOut ? "نفدت الكمية" : "أضف للسلة";
    const addBtnOnClick = isOut ? "" : `onclick="handleAddOrSelectOptions('${safeId}', this)"`;

    return `
        <article class="product-card ${customStyleClass} ${soldOutCardCls}" data-product-id="${safeId}" ${soldOutAttr} onmouseenter="startCardAutoSlide(this, '${safeId}')" onmouseleave="stopCardAutoSlide()">
            ${badgeLabel ? `<span class="card-json-badge">${escapeHtml(badgeLabel)}</span>` : ""}
            <button type="button" class="fav-toggle-btn ${isFav ? "active" : ""}" data-fav-id="${safeId}" aria-label="إضافة للمفضلة" aria-pressed="${isFav}" onclick="toggleProductFavorite('${safeId}', this, event)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            <div class="product-img-box" onclick="openImageModal(this.querySelector('img')?.getAttribute('src') || '${safeFirstImgAttr}', '${safeId}', this.closest('.product-card'))">
                <div class="media-soldout-wrap ${isFirstSoldOut ? "is-soldout" : ""}">
                    <img src="${safeFirstImgAttr}" data-img-idx="0" data-retry-step="0" data-product-id="${safeId}" alt="${safeTitleAttr}" loading="lazy" decoding="async" onerror="handleProductImageError(this, '${safeId}')">
                    ${soldOutBadgeHtml}
                </div>
                ${hasMultipleImgs ? `
                    <button type="button" class="card-img-nav-btn prev" aria-label="الصورة السابقة" onclick="cycleCardImage(this, '${safeId}', -1, event)">›</button>
                    <button type="button" class="card-img-nav-btn next" aria-label="الصورة التالية" onclick="cycleCardImage(this, '${safeId}', 1, event)">‹</button>
                    <span class="card-img-counter">1/${imgs.length}</span>
                    <div class="card-img-dots">
                        ${imgs.map((_, i) => `<button type="button" class="card-img-dot ${i === 0 ? "active" : ""}" aria-label="صورة ${i + 1}" onclick="jumpCardImage(this, '${safeId}', ${i}, event)"></button>`).join("")}
                    </div>
                ` : ""}
            </div>
            <div class="product-details">
                <div>
                    ${safeMerchantText ? `<div class="product-merchant-row"><button type="button" class="product-merchant-link" onclick="filterByMerchant('${safeMerchantAttr}'); scrollToProductsTop();">التاجر: ${safeMerchantText}</button></div>` : ""}
                    <div class="product-title" title="${safeTitleAttr}">${safeTitle}</div>
                    <div class="product-price-row">
                        <div class="product-price">${safePriceFormatted} <span>جنيه</span></div>
                        ${safeSub ? `<div class="product-sub">${safeSub}</div>` : ""}
                    </div>
                    ${safeDesc ? `<div class="product-desc" title="${safeDesc}">${safeDesc}</div>` : ""}
                </div>
                <div class="card-btns">
                    <button type="button" class="${addBtnCls}" ${addBtnDisabledAttr} ${addBtnOnClick}>${addBtnText}</button>
                    <a href="${safeWaUrlAttr}" class="direct-wa-link" target="_blank" rel="noopener noreferrer" onclick="event.preventDefault(); launchWhatsAppTarget(this.closest('.product-card')?.querySelector('.direct-wa-link')?.href || this.href);">واتساب</a>
                </div>
            </div>
        </article>
    `;
}

function buildSkeletonCardsHTML(count = 6) {
    return Array.from({ length: count }).map(() => `
        <article class="product-card skeleton-card" aria-hidden="true">
            <div class="product-img-box skeleton-shimmer"></div>
            <div class="product-details">
                <div>
                    <div class="skeleton-line skeleton-shimmer w-82 h-14"></div>
                    <div class="skeleton-line skeleton-shimmer w-45 h-18 mt-6"></div>
                    <div class="skeleton-line skeleton-shimmer w-65 h-12 mt-6"></div>
                </div>
                <div class="skeleton-line skeleton-shimmer w-100 h-34 mt-10 rounded-12"></div>
            </div>
        </article>
    `).join("");
}

function trackProductInterest(product, weight = 1, markSeen = false) {
    if (!product) return;
    const cat = product.category || "home";
    interestData.categories[cat] = (interestData.categories[cat] || 0) + weight;

    const words = normalizeText(`${product.title || ""} ${product.merchant || ""}`).split(" ");
    words.forEach(w => {
        if (w.length >= 3) {
            interestData.keywords[w] = Math.min(25, (interestData.keywords[w] || 0) + weight * 0.5);
        }
    });

    if (markSeen && !interestData.seenIds.includes(product.id)) {
        interestData.seenIds.push(product.id);
        if (interestData.seenIds.length > 80) interestData.seenIds = interestData.seenIds.slice(-80);
    }
    saveInterest();
}

function getSmartProductScore(product) {
    let score = 0;
    const cat = product.category || "home";
    score += (interestData.categories[cat] || 0) * 14;

    const words = normalizeText(`${product.title || ""} ${product.merchant || ""}`).split(" ");
    words.forEach(w => {
        if (interestData.keywords[w]) score += interestData.keywords[w] * 6;
    });

    if (interestData.seenIds.includes(product.id)) score -= 18;
    const hash = Array.from(product.id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    score += ((hash + Math.floor(interestData.sessionRoll * 100)) % 17);
    return score;
}

function sortProductsList(list, sortMode = "smart") {
    const arr = [...list];
    if (sortMode === "price-asc") {
        return arr.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    }
    if (sortMode === "price-desc") {
        return arr.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    }
    if (currentFeedMode === "new") {
        return arr.reverse();
    }
    if (currentFeedMode === "deals") {
        return arr.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    }
    return arr.sort((a, b) => getSmartProductScore(b) - getSmartProductScore(a));
}

function getFilteredProducts(category, searchTerm = "") {
    let baseList = [...PRODUCTS];

    if (currentMerchant) {
        baseList = baseList.filter(p => p.merchant === currentMerchant);
    }

    if (category && category !== "all") {
        baseList = baseList.filter(p => p.category === category || (Array.isArray(p.categories) && p.categories.includes(category)));
    }

    if (onlyFavoritesMode) {
        const favSet = new Set(wishlistIds.map(String));
        baseList = baseList.filter(p => favSet.has(String(p.id)));
    }

    if (currentFeedMode === "deals") {
        const dealsOnly = baseList.filter(p => (Number(p.price) || 0) > 0 && (Number(p.price) || 0) <= 350);
        if (dealsOnly.length) baseList = dealsOnly;
    }

    renderSmartPriceChips(baseList);

    if (currentMaxPrice > 0) {
        baseList = baseList.filter(p => {
            const pr = Number(p.price) || 0;
            if (currentMaxPrice === 1001) return pr > 1000;
            return pr > 0 && pr <= currentMaxPrice;
        });
    }

    const q = (searchTerm || "").trim();
    if (q) {
        const scored = [];
        for (const p of baseList) {
            const s = scoreProductForQuery(p, q);
            if (s >= 0) scored.push({ product: p, score: s });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.map(entry => entry.product);
    }

    const sorted = sortProductsList(baseList, currentSortMode);
    if (currentFeedMode === "for-you" && currentSortMode === "smart" && !currentMerchant && (!category || category === "all")) {
        return interleaveMerchantsSmartly(sorted);
    }
    return sorted;
}

function setFeedMode(mode, btnEl) {
    currentFeedMode = mode || "for-you";
    document.querySelectorAll("#feedFilterPills .feed-pill-btn").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    else {
        const target = document.querySelector(`#feedFilterPills .feed-pill-btn[data-mode="${currentFeedMode}"]`);
        if (target) target.classList.add("active");
    }
    renderProducts(currentCategory);
}

function updateFeedHeading(category, count, searchTerm = "") {
    const titleEl = document.getElementById("activeCategoryTitle");
    const badgeEl = document.getElementById("resultsCountBadge");
    if (!titleEl) return;

    const catLabel = CATEGORY_NAMES[category] || "الكل";
    const modeLabel = currentFeedMode === "new" ? "مدخلات جديدة" : (currentFeedMode === "deals" ? "أسعار اقتصادية" : "من أجلك");

    if (onlyFavoritesMode) {
        titleEl.textContent = "المفضلة ♥";
    } else if (searchTerm.trim()) {
        titleEl.textContent = `نتائج البحث عن "${searchTerm.trim()}"`;
    } else if (currentMerchant) {
        titleEl.textContent = category && category !== "all"
            ? `${currentMerchant} — ${catLabel}`
            : `منتجات ${currentMerchant}`;
    } else {
        titleEl.textContent = `${catLabel} — ${modeLabel}`;
    }

    if (badgeEl) {
        badgeEl.textContent = `${count} منتج`;
        badgeEl.classList.toggle("is-hidden", count === 0);
    }
}

function updateSearchSummary(searchTerm, resultCount) {
    const bar = document.getElementById("searchResultsSummaryBar");
    const textEl = document.getElementById("searchResultsSummaryText");
    if (!bar || !textEl) return;
    const q = (searchTerm || "").trim();
    if (!q) {
        bar.classList.remove("visible");
        return;
    }
    textEl.textContent = resultCount > 0
        ? `تم العثور على ${resultCount} نتيجة مطابقة لـ "${q}"`
        : `لا توجد نتائج مطابقة لـ "${q}" حاليًا`;
    bar.classList.add("visible");
}

function renderEmptyState(grid, searchTerm) {
    const q = (searchTerm || "").trim();
    const msg = onlyFavoritesMode
        ? "لا توجد منتجات في المفضلة تطابق الفلتر الحالي."
        : (q ? `لم نجد منتجات مطابقة لـ "${escapeHtml(q)}"` : "لا توجد منتجات في هذا القسم أو السعر المحدد حالياً.");
    grid.innerHTML = `
        <div class="empty-state-box">
            <div class="empty-state-msg">${msg}</div>
            <div class="empty-state-actions">
                ${q ? `<button type="button" class="search-clear-inline-btn" onclick="cancelSearchMode()">إلغاء البحث</button>` : ""}
                ${currentMaxPrice > 0 ? `<button type="button" class="search-clear-inline-btn" onclick="setPriceFilter(0)">إلغاء فلتر السعر</button>` : ""}
                ${onlyFavoritesMode ? `<button type="button" class="search-clear-inline-btn" onclick="onlyFavoritesMode=false;updateWishlistUI();renderProducts(currentCategory);">عرض كل المنتجات</button>` : ""}
                <button type="button" class="search-clear-inline-btn" onclick="resetHomeFresh()">العودة للرئيسية</button>
            </div>
        </div>
    `;
}

function resetContinuationSection() {
    continuationItems = [];
    continuationBatchIndex = 0;
    continuationCursor = 0;
    const host = document.getElementById("continuationAfterRecommendations");
    if (host) host.innerHTML = "";
}

function getOtherProductsForContinuation(primaryList) {
    const primaryIds = new Set((primaryList || []).map(p => p.id));
    const others = PRODUCTS.filter(p => !primaryIds.has(p.id));
    return interleaveMerchantsSmartly(shuffleArray(others));
}

function ensureContinuationSectionInitialized(primaryList) {
    const host = document.getElementById("continuationAfterRecommendations");
    if (!host) return;
    if (isFullSelectionMode()) {
        host.innerHTML = "";
        return;
    }
    const candidates = getOtherProductsForContinuation(primaryList);
    if (!candidates.length) {
        host.innerHTML = "";
        return;
    }
    continuationItems = candidates;
    continuationBatchIndex = 1;
    continuationCursor = 0;

    const initialChunk = continuationItems.slice(0, CONTINUATION_STEP);
    continuationCursor = initialChunk.length;
    const hasMore = continuationCursor < continuationItems.length;

    host.innerHTML = `
        <section class="continuation-after-section" aria-label="منتجات أخرى من المتجر">
            <div class="continuation-after-header">
                <h3>منتجات أخرى قد تعجبك من المتجر</h3>
                <span class="smart-tag">تشكيلة متنوعة</span>
            </div>
            <div class="continuation-after-grid" id="continuationAfterGrid">
                ${initialChunk.map(item => buildProductCardHTML(item)).join("")}
            </div>
            ${hasMore ? `
                <div class="continuation-load-more-wrap" id="continuationLoadMoreWrap">
                    <button type="button" class="continuation-load-more-btn" onclick="appendNextContinuationBatch()">عرض المزيد من المنتجات</button>
                </div>
            ` : ""}
        </section>
    `;
    hydrateCardsInteractivity(host);
}

function appendNextContinuationBatch() {
    const grid = document.getElementById("continuationAfterGrid");
    const wrap = document.getElementById("continuationLoadMoreWrap");
    if (!grid || !continuationItems.length) return;

    const nextChunk = continuationItems.slice(continuationCursor, continuationCursor + CONTINUATION_STEP);
    if (!nextChunk.length) {
        if (wrap) wrap.remove();
        return;
    }

    continuationBatchIndex += 1;
    continuationCursor += nextChunk.length;
    grid.insertAdjacentHTML("beforeend", nextChunk.map(item => buildProductCardHTML(item)).join(""));
    hydrateCardsInteractivity(grid);

    if (continuationCursor >= continuationItems.length && wrap) {
        wrap.remove();
    }
}

function appendNextProductsBatch() {
    if (isAppendingBatch) return;
    const grid = document.getElementById("productsGrid");
    const sentinel = document.getElementById("feedSentinel");
    if (!grid) return;

    if (renderedCount >= currentFeedItems.length) {
        if (sentinel && !isFullSelectionMode()) {
            ensureContinuationSectionInitialized(currentFeedItems);
            sentinel.textContent = "";
        } else if (sentinel) {
            sentinel.textContent = currentFeedItems.length ? "تم عرض جميع المنتجات المتاحة" : "";
        }
        return;
    }

    isAppendingBatch = true;
    feedCycle += 1;
    const nextItems = currentFeedItems.slice(renderedCount, renderedCount + BATCH_SIZE);
    renderedCount += nextItems.length;

    grid.insertAdjacentHTML("beforeend", nextItems.map(item => buildProductCardHTML(item)).join(""));
    hydrateCardsInteractivity(grid);
    isAppendingBatch = false;

    if (sentinel) {
        if (renderedCount < currentFeedItems.length) {
            sentinel.textContent = `معروض ${renderedCount} من ${currentFeedItems.length} — اسحب للأسفل للمزيد`;
        } else if (!isFullSelectionMode()) {
            ensureContinuationSectionInitialized(currentFeedItems);
            sentinel.textContent = "";
        } else {
            sentinel.textContent = `تم عرض جميع المنتجات (${currentFeedItems.length})`;
        }
    }
}

function setupFeedObserver() {
    const sentinel = document.getElementById("feedSentinel");
    if (!sentinel || !("IntersectionObserver" in window)) return;
    if (feedObserver) feedObserver.disconnect();
    feedObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) appendNextProductsBatch();
        });
    }, { rootMargin: "240px 0px" });
    feedObserver.observe(sentinel);
}

function renderProducts(category, searchTerm = "") {
    const grid = document.getElementById("productsGrid");
    const sentinel = document.getElementById("feedSentinel");
    if (!grid) return;

    if (isLoadingJsonProducts && !PRODUCTS.length) {
        grid.innerHTML = buildSkeletonCardsHTML(6);
        updateFeedHeading(category, 0, searchTerm);
        if (sentinel) sentinel.textContent = "جاري تحميل منتجات التجار...";
        return;
    }

    const filtered = getFilteredProducts(category, searchTerm);
    currentFeedItems = filtered;
    renderedCount = 0;
    feedCycle = 0;
    resetContinuationSection();

    updateFeedHeading(category, filtered.length, searchTerm);
    updateSearchSummary(searchTerm, filtered.length);

    if (!filtered.length) {
        renderEmptyState(grid, searchTerm);
        if (sentinel) sentinel.textContent = "";
        return;
    }

    const initialLimit = isFullSelectionMode() ? FULL_MODE_INITIAL_BATCH : BATCH_SIZE;
    const initialItems = filtered.slice(0, initialLimit);
    renderedCount = initialItems.length;
    grid.innerHTML = initialItems.map(item => buildProductCardHTML(item)).join("");
    hydrateCardsInteractivity(grid);

    if (sentinel) {
        if (renderedCount < filtered.length) {
            sentinel.textContent = `معروض ${renderedCount} من ${filtered.length} — اسحب للأسفل للمزيد`;
        } else if (!isFullSelectionMode()) {
            ensureContinuationSectionInitialized(filtered);
            sentinel.textContent = "";
        } else {
            sentinel.textContent = `تم عرض جميع المنتجات (${filtered.length})`;
        }
    }
}

function getSpotlightPool(kind) {
    if (kind === "trends") {
        const trendTagged = PRODUCTS.filter(p => p.trend === true || /ترند|الأكثر|مطلوب|مميز/i.test(String(p.badge || "")));
        return trendTagged.length ? trendTagged : PRODUCTS.slice(0, 8);
    }
    const dealTagged = PRODUCTS.filter(p => (Number(p.price) || 0) > 0 && (Number(p.price) || 0) <= 250);
    return dealTagged.length ? dealTagged : PRODUCTS.slice(0, 8);
}

function buildVisualShowcaseHTML(kind, list, activeIdx) {
    if (!list.length) return `<div class="spotlight-empty-card">لا توجد عناصر حالياً</div>`;
    const safeIdx = ((activeIdx % list.length) + list.length) % list.length;
    const item = list[safeIdx];
    const imgs = getProductImagesList(item);
    const imgSrc = imgs[0] || "";
    const priceText = formatPriceNumber(item.priceLabel || item.price);
    const safeId = escapeHtmlAttr(item.id);
    const safeTitle = escapeHtmlAttr(item.title);

    return `
        <div class="visual-motion-card" onclick="openImageModal('${escapeHtmlAttr(imgSrc)}', '${safeId}')">
            <img src="${escapeHtmlAttr(imgSrc)}" alt="${safeTitle}" loading="lazy" onerror="handleProductImageError(this, '${safeId}')">
            <div class="visual-price-overlay">
                <span class="visual-price-pill">${escapeHtml(priceText)} <span>جنيه</span></span>
                <div class="showcase-dots-row" onclick="event.stopPropagation()">
                    ${list.slice(0, 6).map((_, idx) => `<button type="button" class="showcase-dot ${idx === safeIdx ? "active" : ""}" aria-label="عنصر ${idx + 1}" onclick="selectShowcaseSlide('${kind}', ${idx})"></button>`).join("")}
                </div>
            </div>
        </div>
    `;
}

function selectShowcaseSlide(kind, idx) {
    if (kind === "trends") {
        trendSlideIdx = idx;
        const el = document.getElementById("trendsSpotlightGrid");
        if (el) el.innerHTML = buildVisualShowcaseHTML("trends", trendSlideList, trendSlideIdx);
    } else {
        dealSlideIdx = idx;
        const el = document.getElementById("dealsSpotlightGrid");
        if (el) el.innerHTML = buildVisualShowcaseHTML("deals", dealSlideList, dealSlideIdx);
    }
}

function setMotionPaused(kind, paused) {
    pausedMotionKind[kind] = Boolean(paused);
}

function renderSpotlightBoxes() {
    trendSlideList = getSpotlightPool("trends");
    dealSlideList = getSpotlightPool("deals");
    const trendsEl = document.getElementById("trendsSpotlightGrid");
    const dealsEl = document.getElementById("dealsSpotlightGrid");
    if (trendsEl) trendsEl.innerHTML = buildVisualShowcaseHTML("trends", trendSlideList, trendSlideIdx);
    if (dealsEl) dealsEl.innerHTML = buildVisualShowcaseHTML("deals", dealSlideList, dealSlideIdx);
}

setInterval(() => {
    if (!pausedMotionKind.trends && trendSlideList.length > 1) {
        trendSlideIdx = (trendSlideIdx + 1) % trendSlideList.length;
        const el = document.getElementById("trendsSpotlightGrid");
        if (el) el.innerHTML = buildVisualShowcaseHTML("trends", trendSlideList, trendSlideIdx);
    }
    if (!pausedMotionKind.deals && dealSlideList.length > 1) {
        dealSlideIdx = (dealSlideIdx + 1) % dealSlideList.length;
        const el = document.getElementById("dealsSpotlightGrid");
        if (el) el.innerHTML = buildVisualShowcaseHTML("deals", dealSlideList, dealSlideIdx);
    }
}, 4200);

function scrollToProductsTop() {
    const target = document.getElementById("productsSectionHeading") || document.getElementById("productsGrid");
    if (!target) return;
    const header = document.querySelector(".top-app-bar");
    const topTabs = document.querySelector(".quick-top-tabs");
    const offset = (header ? header.getBoundingClientRect().height : 50) + (topTabs ? topTabs.getBoundingClientRect().height : 42) + 10;
    const y = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

function pulseBottomNavButton(btnId) {
    document.querySelectorAll(".bottom-nav-btn").forEach(b => b.classList.remove("active"));
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.classList.add("active");
        btn.classList.remove("pop");
        void btn.offsetWidth;
        btn.classList.add("pop");
    }
}

function filterByCategory(category, btnEl, silent = false) {
    currentCategory = category || "all";
    if (currentCategory !== "all") {
        interestData.categories[currentCategory] = (interestData.categories[currentCategory] || 0) + 1;
        saveInterest();
    }
    applyCategoryPageMood(currentCategory);
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => el.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    else {
        const matchingTab = document.querySelector(`.quick-top-tabs .quick-tab-item[data-quick="${currentCategory}"]`);
        if (matchingTab) matchingTab.classList.add("active");
    }

    if (currentMerchant) {
        renderMerchantInnerCategories(currentMerchant);
        const countEl = document.getElementById("merchantBannerCount");
        if (countEl) {
            const count = currentCategory === "all"
                ? PRODUCTS.filter(p => p.merchant === currentMerchant).length
                : PRODUCTS.filter(p => p.merchant === currentMerchant && (p.category === currentCategory || (Array.isArray(p.categories) && p.categories.includes(currentCategory)))).length;
            countEl.textContent = `${count} منتج متاح في قسم التاجر`;
        }
    }

    const searchInput = document.getElementById("homeSearchInput");
    const q = searchInput ? searchInput.value.trim() : "";
    renderProducts(currentCategory, q);
    if (!silent) scrollToProductsTop();
}

function selectTopQuickTab(category, btnEl) {
    filterByCategory(category, btnEl, false);
}

function resetHomeFresh() {
    closeAllOverlays();
    currentCategory = "all";
    currentMerchant = "";
    currentMaxPrice = 0;
    currentSortMode = "smart";
    currentFeedMode = "for-you";
    onlyFavoritesMode = false;
    document.body.classList.remove("merchant-storefront-mode");
    renderMerchantInnerCategories("");
    const mBanner = document.getElementById("activeMerchantBanner");
    if (mBanner) mBanner.classList.remove("visible");

    const sortSel = document.getElementById("productsSortSelect");
    if (sortSel) sortSel.value = "smart";
    document.querySelectorAll("#feedFilterPills .feed-pill-btn").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-mode") === "for-you");
    });

    const searchInput = document.getElementById("homeSearchInput");
    const cancelBtn = document.getElementById("searchCancelBtn");
    if (searchInput) searchInput.value = "";
    if (cancelBtn) cancelBtn.style.display = "none";
    updateSearchSummary("", 0);
    updateWishlistUI();

    applyCategoryPageMood("all");
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => {
        el.classList.toggle("active", el.getAttribute("data-quick") === "all");
    });
    renderProducts("all", "");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

const performSearchRender = createDebounced(() => {
    const input = document.getElementById("homeSearchInput");
    const cancelBtn = document.getElementById("searchCancelBtn");
    const val = input ? input.value : "";
    if (cancelBtn) cancelBtn.style.display = val.trim().length > 0 ? "inline-block" : "none";
    renderProducts(currentCategory, val);
}, 140);

function handleSearchInput() {
    performSearchRender();
}

function handleSearchKeyDown(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        const input = document.getElementById("homeSearchInput");
        if (input && input.value.trim()) saveSearchTermToHistory(input.value.trim());
        renderSmartSearchSuggestions();
        performSearchRender();
        scrollToProductsTop();
    } else if (e.key === "Escape") {
        cancelSearchMode(e);
    }
}

function cancelSearchMode(e) {
    if (e) e.stopPropagation();
    const input = document.getElementById("homeSearchInput");
    const cancelBtn = document.getElementById("searchCancelBtn");
    if (input) input.value = "";
    if (cancelBtn) cancelBtn.style.display = "none";
    updateSearchSummary("", 0);
    renderProducts(currentCategory, "");
    if (input) input.focus();
}

function syncBodyScrollLock() {
    const anyOpen = Boolean(
        document.getElementById("cartDrawer")?.classList.contains("open") ||
        document.getElementById("catsDrawer")?.classList.contains("open") ||
        document.getElementById("imageModal")?.classList.contains("open") ||
        document.getElementById("productOptionModal")?.classList.contains("open") ||
        document.getElementById("serviceInfoModal")?.classList.contains("open") ||
        document.getElementById("becomeMerchantModal")?.classList.contains("open") ||
        document.getElementById("confirmActionModal")?.classList.contains("open")
    );
    document.body.style.overflow = anyOpen ? "hidden" : "";
}

function pushOverlayState(overlayName) {
    if (suppressHistoryStep) return;
    if (overlayStack[overlayStack.length - 1] !== overlayName) {
        overlayStack.push(overlayName);
    }
    try { history.pushState({ caramelOverlay: overlayName, depth: overlayStack.length }, ""); } catch (e) {}
}

function removeOverlayState(overlayName) {
    const idx = overlayStack.lastIndexOf(overlayName);
    if (idx !== -1) overlayStack.splice(idx, 1);
    if (suppressHistoryStep) return;
    if (window.history.state && window.history.state.caramelOverlay) {
        suppressHistoryStep = true;
        try { window.history.back(); } catch (e) {}
        setTimeout(() => { suppressHistoryStep = false; }, 60);
    }
}

function closeTopOverlay(fromPopState = false) {
    const top = overlayStack.pop();
    if (!top) return;
    if (top === "image") closeImageModal(fromPopState);
    else if (top === "option") closeProductOptionModal(fromPopState);
    else if (top === "serviceInfo") closeServiceInfoModal(fromPopState);
    else if (top === "merchantSignup") closeBecomeMerchantModal(fromPopState);
    else if (top === "confirm") closeConfirmModal(fromPopState, true);
    else if (top === "cart") closeCart(fromPopState);
    else if (top === "cats") closeCategoriesDrawer(fromPopState);
}

function closeAllOverlays() {
    while (overlayStack.length > 0) {
        closeTopOverlay(true);
    }
    closeImageModal(true);
    closeProductOptionModal(true);
    closeServiceInfoModal(true);
    closeBecomeMerchantModal(true);
    closeConfirmModal(true, false);
    closeCart(true);
    closeCategoriesDrawer(true);
    syncBodyScrollLock();
}

function openCategoriesDrawer() {
    closeCart(true);
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

function openCart(targetTab = null) {
    closeCategoriesDrawer(true);
    if (targetTab === "received") activeCartOrdersTab = "received";
    else if (targetTab === "pending") activeCartOrdersTab = "pending";
    else if (targetTab === "cart") activeCartOrdersTab = "cart";
    else if (appendTargetOrderId) activeCartOrdersTab = "cart";

    const drawer = document.getElementById("cartDrawer");
    const backdrop = document.getElementById("cartBackdrop");
    if (drawer) drawer.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
    loadCustomerProfileToInputs();
    updateCartUI();
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

function openBecomeMerchantModal() {
    closeAllOverlays();
    const modal = document.getElementById("becomeMerchantModal");
    if (!modal) return;
    modal.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("merchantSignup");
    setTimeout(() => { document.getElementById("merchantRegName")?.focus(); }, 60);
}

function closeBecomeMerchantModal(fromPopState = false) {
    const modal = document.getElementById("becomeMerchantModal");
    if (modal) modal.classList.remove("open");
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("merchantSignup");
}

function submitBecomeMerchantForm(e) {
    if (e) e.preventDefault();
    const nameVal = (document.getElementById("merchantRegName")?.value || "").trim();
    const activityVal = (document.getElementById("merchantRegActivity")?.value || "").trim();
    const phoneVal = (document.getElementById("merchantRegPhone")?.value || "").trim();

    if (!nameVal || !activityVal || !phoneVal) {
        showCaramelToast("يرجى إدخال الاسم واسم النشاط ورقم التواصل");
        return;
    }

    const msgLines = [
        "طلب انضمام تاجر جديد - متجر كارامل",
        "------------------------",
        `الاسم: ${nameVal}`,
        `اسم النشاط: ${activityVal}`,
        `رقم التواصل: ${phoneVal}`
    ];
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msgLines.join("\n"))}`;
    closeBecomeMerchantModal(false);
    document.getElementById("becomeMerchantForm")?.reset();
    showCaramelToast("جاري فتح واتساب لإرسال طلب الانضمام...");
    launchWhatsAppTarget(waUrl);
}

function openImageModal(src, productId = "", sourceCardEl = null) {
    const modal = document.getElementById("imageModal");
    const img = document.getElementById("modalImagePreview");
    if (!modal || !img) return;

    const product = productId ? PRODUCTS.find(p => p.id === productId) : null;
    const cardEl = sourceCardEl || (productId ? document.querySelector(`.product-card[data-product-id="${CSS.escape(productId)}"]`) : null);
    const imgs = product ? getProductImagesList(product) : [];
    const normalizedSrc = normalizeProductImageUrl(src) || (cardEl ? getActiveCardImageSrc(cardEl, product) : "") || (imgs[0] || "");
    const startIdx = imgs.length ? Math.max(0, imgs.indexOf(normalizedSrc)) : 0;

    previewModalState = { productId: product ? product.id : "", imgs, idx: startIdx };
    img.setAttribute("data-retry-step", "0");
    img.setAttribute("data-product-id", product ? product.id : "");
    img.style.opacity = "1";
    img.removeAttribute("data-broken");
    img.src = imgs[startIdx] || normalizedSrc;
    img.alt = product ? product.title : "معاينة المنتج";

    syncPreviewGalleryUI(product);

    const catChip = document.getElementById("previewCategoryChip");
    const merchantChip = document.getElementById("previewMerchantChip");
    const copyLinkBtn = document.getElementById("previewCopyLinkBtn");
    const titleEl = document.getElementById("previewProductTitle");
    const mainPriceEl = document.getElementById("previewMainPrice");
    const subPriceEl = document.getElementById("previewSubPrice");
    const storyEl = document.getElementById("previewStoryText");
    const hookEl = document.getElementById("previewHookNote");
    const addBtn = document.getElementById("previewAddToCartBtn");
    const waBtn = document.getElementById("previewWhatsAppBtn");

    if (product) {
        trackProductInterest(product, 1.5, true);
        if (catChip) catChip.textContent = CATEGORY_NAMES[product.category] || "متجر كارامل";
        if (merchantChip) {
            if (product.merchant) {
                merchantChip.textContent = `التاجر: ${product.merchant}`;
                merchantChip.classList.remove("is-hidden");
                merchantChip.onclick = () => {
                    const mName = product.merchant;
                    closeImageModal();
                    filterByMerchant(mName);
                    scrollToProductsTop();
                };
            } else {
                merchantChip.classList.add("is-hidden");
            }
        }
        if (copyLinkBtn) copyLinkBtn.onclick = ev => copyProductShareLink(product.id, ev);
        if (titleEl) titleEl.textContent = product.title;
        if (mainPriceEl) mainPriceEl.innerHTML = `${escapeHtml(formatPriceNumber(product.priceLabel || product.price))} <span>جنيه</span>`;
        if (subPriceEl) {
            if (product.subPrice) { subPriceEl.textContent = product.subPrice; subPriceEl.classList.remove("is-hidden"); }
            else subPriceEl.classList.add("is-hidden");
        }
        if (storyEl) storyEl.textContent = product.desc || `قطعة مختارة بعناية من قسم ${CATEGORY_NAMES[product.category] || "المتجر"} تناسب الاستخدام اليومي والهدايا.`;
        if (hookEl) hookEl.textContent = "توصيل سريع داخل السويس وشحن للمحافظات مع تأكيد الطلب بسهولة.";
        if (addBtn) {
            const isOut = isProductOutOfStock(product);
            addBtn.disabled = isOut;
            addBtn.classList.toggle("is-disabled", isOut);
            addBtn.textContent = isOut ? "نفدت الكمية" : "أضف للسلة الجارية";
            addBtn.onclick = isOut ? null : () => {
                const activeSrc = previewModalState.imgs[previewModalState.idx] || img.src;
                closeImageModal();
                handleAddOrSelectOptions(product.id, null, activeSrc);
            };
        }
        if (waBtn) {
            const activeSrc = previewModalState.imgs[previewModalState.idx] || img.src;
            waBtn.href = buildProductWhatsAppUrl(product, activeSrc);
        }
        renderPreviewRelatedProducts(product);
    } else {
        if (catChip) catChip.textContent = "معاينة سريعة";
        if (merchantChip) merchantChip.classList.add("is-hidden");
        if (copyLinkBtn) copyLinkBtn.onclick = null;
        if (titleEl) titleEl.textContent = "صورة منتج من متجر كارامل";
        if (mainPriceEl) mainPriceEl.textContent = "";
        if (subPriceEl) subPriceEl.classList.add("is-hidden");
        if (storyEl) storyEl.textContent = "";
        if (hookEl) hookEl.textContent = "";
        document.getElementById("previewRelatedSection")?.classList.add("is-hidden");
        if (addBtn) addBtn.onclick = closeImageModal;
        if (waBtn) waBtn.href = `https://wa.me/${WHATSAPP_NUMBER}`;
    }

    modal.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("image");
}

function syncPreviewGalleryUI(product) {
    const prevBtn = document.getElementById("previewPrevBtn");
    const nextBtn = document.getElementById("previewNextBtn");
    const thumbsRow = document.getElementById("previewThumbsRow");
    const imgEl = document.getElementById("modalImagePreview");
    const waBtn = document.getElementById("previewWhatsAppBtn");
    const imgs = previewModalState.imgs || [];
    const activeSrc = imgs[previewModalState.idx] || imgEl?.getAttribute("src") || "";

    if (prevBtn) prevBtn.classList.toggle("is-hidden", imgs.length <= 1);
    if (nextBtn) nextBtn.classList.toggle("is-hidden", imgs.length <= 1);

    if (imgEl && product) {
        syncSoldOutOverlayOnElement(imgEl, isProductImageSoldOut(product, activeSrc));
    }
    if (waBtn && product) {
        waBtn.href = buildProductWhatsAppUrl(product, activeSrc);
    }

    if (!thumbsRow) return;
    if (imgs.length <= 1) {
        thumbsRow.classList.add("is-hidden");
        thumbsRow.innerHTML = "";
        return;
    }
    thumbsRow.classList.remove("is-hidden");
    thumbsRow.innerHTML = imgs.map((u, i) => `
        <button type="button" class="preview-thumb-btn ${i === previewModalState.idx ? "active" : ""}" onclick="selectPreviewImage(${i}, event)">
            <img src="${escapeHtmlAttr(u)}" alt="صورة ${i + 1}">
        </button>
    `).join("");
}

function selectPreviewImage(targetIdx, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const imgs = previewModalState.imgs || [];
    if (!imgs.length) return;
    const safeIdx = ((targetIdx % imgs.length) + imgs.length) % imgs.length;
    previewModalState.idx = safeIdx;
    const imgEl = document.getElementById("modalImagePreview");
    if (imgEl) {
        imgEl.setAttribute("data-retry-step", "0");
        imgEl.style.opacity = "1";
        imgEl.removeAttribute("data-broken");
        imgEl.src = imgs[safeIdx];
    }
    const product = previewModalState.productId ? PRODUCTS.find(p => p.id === previewModalState.productId) : null;
    syncPreviewGalleryUI(product);
}

function stepPreviewImage(delta, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    selectPreviewImage((previewModalState.idx || 0) + delta, event);
}

function renderPreviewRelatedProducts(currentProduct) {
    const sec = document.getElementById("previewRelatedSection");
    const listEl = document.getElementById("previewRelatedList");
    if (!sec || !listEl || !currentProduct) return;

    const candidates = PRODUCTS.filter(p => p.id !== currentProduct.id && (
        (currentProduct.merchant && p.merchant === currentProduct.merchant) ||
        p.category === currentProduct.category
    )).slice(0, 4);

    if (!candidates.length) { sec.classList.add("is-hidden"); return; }

    sec.classList.remove("is-hidden");
    listEl.innerHTML = candidates.map(item => `
        <button type="button" class="preview-related-chip" onclick="openImageModal('${escapeHtmlAttr(getProductImagesList(item)[0] || "")}', '${escapeHtmlAttr(item.id)}')">
            <img src="${escapeHtmlAttr(getProductImagesList(item)[0] || "")}" alt="${escapeHtmlAttr(item.title)}" onerror="handleProductImageError(this, '${escapeHtmlAttr(item.id)}')">
            <div class="preview-related-meta">
                <span class="preview-related-title">${escapeHtml(item.title)}</span>
                <span class="preview-related-price">${escapeHtml(formatPriceNumber(item.priceLabel || item.price))} ج</span>
            </div>
        </button>
    `).join("");
}

function closeImageModal(fromPopState = false) {
    const modal = document.getElementById("imageModal");
    if (modal) modal.classList.remove("open");
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("image");
}

function handleAddOrSelectOptions(productId, clickedBtn = null, preferredImgSrc = "") {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;
    if (isProductOutOfStock(product)) {
        showCaramelToast("عذراً، نفدت كمية هذا المنتج حالياً");
        return;
    }

    const cardEl = clickedBtn ? clickedBtn.closest(".product-card") : document.querySelector(`.product-card[data-product-id="${CSS.escape(productId)}"]`);
    const activeCardImg = normalizeProductImageUrl(preferredImgSrc) || getActiveCardImageSrc(cardEl, product);
    if (activeCardImg && isProductImageSoldOut(product, activeCardImg)) {
        showCaramelToast("عذراً، نفدت الكمية الخاصة بهذه الصورة");
        return;
    }

    const variantConfig = getProductVariantConfig(product);
    if (!variantConfig) {
        addToCart(product.id, clickedBtn, "", "", "", activeCardImg);
        return;
    }
    openProductOptionModal(product, variantConfig, clickedBtn ? clickedBtn.id : "", activeCardImg);
}

function syncOptionModalGallery(product, preferredImgSrc = "") {
    const imgs = getProductImagesList(product);
    const imgEl = document.getElementById("optionModalImg");
    const thumbsRow = document.getElementById("optionModalThumbsRow");
    const chosen = normalizeProductImageUrl(preferredImgSrc) || pendingOptionSelection.selectedImg || imgs[0] || "";
    pendingOptionSelection.selectedImg = chosen;

    if (imgEl) {
        imgEl.src = chosen;
        imgEl.alt = product.title;
        syncSoldOutOverlayOnElement(imgEl, isProductImageSoldOut(product, chosen));
    }

    if (!thumbsRow) return;
    if (imgs.length <= 1) {
        thumbsRow.classList.add("is-hidden");
        thumbsRow.innerHTML = "";
        return;
    }
    thumbsRow.classList.remove("is-hidden");
    thumbsRow.innerHTML = imgs.map((u, idx) => `
        <button type="button" class="preview-thumb-btn ${normalizeProductImageUrl(u) === chosen ? "active" : ""}" onclick="selectOptionModalImage(${idx}, event)">
            <img src="${escapeHtmlAttr(u)}" alt="صورة ${idx + 1}">
        </button>
    `).join("");
}

function selectOptionModalImage(idx, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const product = PRODUCTS.find(p => p.id === pendingOptionSelection.productId);
    if (!product) return;
    const imgs = getProductImagesList(product);
    if (!imgs[idx]) return;
    syncOptionModalGallery(product, imgs[idx]);
}

function openProductOptionModal(product, variantConfig, clickedBtnId = "", preferredImgSrc = "") {
    const modal = document.getElementById("productOptionModal");
    if (!modal || !product) return;

    const initialSizeObj = variantConfig.sizes && variantConfig.sizes.length ? variantConfig.sizes[0] : null;
    const initialSizeLabel = initialSizeObj ? (typeof initialSizeObj === "string" ? initialSizeObj : initialSizeObj.label) : "";
    const initialSizePrice = initialSizeObj && typeof initialSizeObj === "object" && initialSizeObj.price > 0
        ? initialSizeObj.price
        : (Number(product.price) || 0);
    const initialColor = variantConfig.colors && variantConfig.colors.length ? variantConfig.colors[0] : "";

    pendingOptionSelection = {
        productId: product.id,
        clickedBtnId,
        selectedSize: initialSizeLabel,
        selectedColor: initialColor,
        selectedImg: normalizeProductImageUrl(preferredImgSrc) || (getProductImagesList(product)[0] || ""),
        currentPrice: initialSizePrice,
        qty: 1
    };

    syncOptionModalGallery(product, pendingOptionSelection.selectedImg);
    document.getElementById("optionModalTitle").textContent = product.title;
    document.getElementById("optionModalPrice").innerHTML = `${escapeHtml(formatPriceNumber(initialSizePrice))} <span>جنيه</span>`;
    document.getElementById("optionModalQtyVal").textContent = "1";
    document.getElementById("optionModalNoteInput").value = "";

    const sizeGroup = document.getElementById("optionModalSizeGroup");
    const sizeLabelEl = document.getElementById("optionModalSizeLabel");
    const sizePills = document.getElementById("optionModalSizePills");
    if (variantConfig.sizes && variantConfig.sizes.length) {
        sizeGroup.classList.remove("is-hidden");
        if (sizeLabelEl) sizeLabelEl.textContent = variantConfig.sizeHeading || resolveProductOptionHeading(product);
        sizePills.innerHTML = variantConfig.sizes.map((s, idx) => {
            const sLabel = typeof s === "string" ? s : s.label;
            const sPrice = typeof s === "object" && s.price > 0 ? s.price : (Number(product.price) || 0);
            return `<button type="button" class="option-pill-btn ${idx === 0 ? "selected" : ""}" onclick="selectOptionPill('size', '${escapeHtmlAttr(sLabel)}', this, ${sPrice})">${escapeHtml(sLabel)}</button>`;
        }).join("");
    } else {
        sizeGroup.classList.add("is-hidden");
        sizePills.innerHTML = "";
    }

    const colorGroup = document.getElementById("optionModalColorGroup");
    const colorLabelEl = document.getElementById("optionModalColorLabel");
    const colorPills = document.getElementById("optionModalColorPills");
    if (variantConfig.colors && variantConfig.colors.length) {
        colorGroup.classList.remove("is-hidden");
        if (colorLabelEl) colorLabelEl.textContent = variantConfig.colorHeading || resolveProductColorHeading(product);
        colorPills.innerHTML = variantConfig.colors.map((c, idx) =>
            `<button type="button" class="option-pill-btn ${idx === 0 ? "selected" : ""}" onclick="selectOptionPill('color', '${escapeHtmlAttr(c)}', this)">${escapeHtml(c)}</button>`
        ).join("");
    } else {
        colorGroup.classList.add("is-hidden");
        colorPills.innerHTML = "";
    }

    modal.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("option");
}

function selectOptionPill(type, val, btnEl, optionPrice = 0) {
    const parent = btnEl ? btnEl.parentElement : null;
    if (parent) parent.querySelectorAll(".option-pill-btn").forEach(b => b.classList.remove("selected"));
    if (btnEl) btnEl.classList.add("selected");
    if (type === "size") {
        pendingOptionSelection.selectedSize = val;
        const product = PRODUCTS.find(p => p.id === pendingOptionSelection.productId);
        const resolvedPrice = optionPrice > 0 ? optionPrice : (Number(product?.price) || 0);
        pendingOptionSelection.currentPrice = resolvedPrice;
        const priceEl = document.getElementById("optionModalPrice");
        if (priceEl && resolvedPrice > 0) {
            priceEl.innerHTML = `${escapeHtml(formatPriceNumber(resolvedPrice))} <span>جنيه</span>`;
        }
    }
    if (type === "color") pendingOptionSelection.selectedColor = val;
}

function changeModalQty(delta) {
    const next = Math.max(1, (pendingOptionSelection.qty || 1) + delta);
    pendingOptionSelection.qty = next;
    const el = document.getElementById("optionModalQtyVal");
    if (el) el.textContent = String(next);
}

function confirmAddProductWithOptions() {
    const { productId, clickedBtnId, selectedSize, selectedColor, selectedImg, currentPrice, qty } = pendingOptionSelection;
    const note = (document.getElementById("optionModalNoteInput")?.value || "").trim();
    const btnEl = clickedBtnId ? document.getElementById(clickedBtnId) : null;
    closeProductOptionModal();
    addToCart(productId, btnEl, selectedSize, selectedColor, note, selectedImg, qty, currentPrice);
}

function closeProductOptionModal(fromPopState = false) {
    const modal = document.getElementById("productOptionModal");
    if (modal) modal.classList.remove("open");
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("option");
}

function addToCart(productId, btnEl = null, selectedSize = "", selectedColor = "", note = "", chosenImgSrc = "", qtyToAdd = 1, customUnitPrice = 0) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;
    if (isProductOutOfStock(product)) {
        showCaramelToast("عذراً، نفدت كمية هذا المنتج حالياً");
        return;
    }

    const cardEl = btnEl ? btnEl.closest(".product-card") : document.querySelector(`.product-card[data-product-id="${CSS.escape(productId)}"]`);
    const resolvedImg = normalizeProductImageUrl(chosenImgSrc) || getActiveCardImageSrc(cardEl, product) || (getProductImagesList(product)[0] || "");

    if (resolvedImg && isProductImageSoldOut(product, resolvedImg)) {
        showCaramelToast("عذراً، نفدت الكمية الخاصة بهذه الصورة");
        return;
    }

    trackProductInterest(product, 3, true);
    const variantConfig = getProductVariantConfig(product);
    const finalSize = selectedSize || (variantConfig?.sizes?.[0] ? (typeof variantConfig.sizes[0] === "string" ? variantConfig.sizes[0] : variantConfig.sizes[0].label) : "");
    const finalColor = selectedColor || (variantConfig?.colors?.[0] || "");
    const finalNote = (note || "").trim();
    const qtyNum = Math.max(1, Number(qtyToAdd) || 1);
    const effectivePrice = customUnitPrice > 0 ? customUnitPrice : (Number(product.price) || 0);

    const existing = cart.find(item =>
        item.id === product.id &&
        (item.selectedSize || "") === finalSize &&
        (item.selectedColor || "") === finalColor &&
        (item.note || "") === finalNote &&
        normalizeProductImageUrl(item.img || "") === resolvedImg &&
        (Number(item.price) || 0) === effectivePrice
    );

    if (existing) {
        existing.qty += qtyNum;
        if (resolvedImg) existing.img = resolvedImg;
        if (effectivePrice > 0) existing.price = effectivePrice;
    } else {
        cart.push({
            id: product.id,
            title: product.title,
            price: effectivePrice,
            img: resolvedImg || product.img,
            merchant: product.merchant || "",
            selectedSize: finalSize,
            selectedColor: finalColor,
            note: finalNote,
            qty: qtyNum
        });
    }

    saveCart();
    updateCartUI();

    if (appendTargetOrderId) {
        const targetOrder = activeOrders.find(o => o.orderId === appendTargetOrderId);
        if (targetOrder) {
            showCaramelToast(`تمت إضافة "${product.title}" — جاهز للإضافة للطلب ${targetOrder.orderId}`);
        }
    } else {
        showCaramelToast(`تمت إضافة "${product.title}" إلى السلة الجارية`);
    }

    if (btnEl) {
        const prevText = btnEl.textContent;
        btnEl.textContent = "تمت الإضافة ✓";
        btnEl.classList.add("added");
        setTimeout(() => { btnEl.textContent = prevText; btnEl.classList.remove("added"); }, 900);
    }
}

function updateCartItemOption(index, field, value) {
    if (!cart[index]) return;
    if (field === "size") {
        cart[index].selectedSize = value;
        const prod = PRODUCTS.find(p => p.id === cart[index].id);
        const vCfg = getProductVariantConfig(prod);
        const matchedOpt = vCfg?.sizes?.find(s => (typeof s === "string" ? s : s.label) === value);
        if (matchedOpt && typeof matchedOpt === "object" && matchedOpt.price > 0) {
            cart[index].price = matchedOpt.price;
        }
    }
    if (field === "color") cart[index].selectedColor = value;
    if (field === "note") cart[index].note = value;
    saveCart();
    updateCartUI();
}

function updateQty(index, delta) {
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
    if (!cart.length) return;
    openConfirmModal("تفريغ السلة الجارية", "هل تريد حذف جميع المنتجات من السلة الجارية؟", () => {
        cart = [];
        saveCart();
        updateCartUI();
        showCaramelToast("تم تفريغ السلة الجارية");
    }, "تفريغ");
}

function generateOrderCode() {
    const now = new Date();
    const y = String(now.getFullYear()).slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `CRL-${y}${m}${d}-${rand}`;
}

function formatOrderTimestamp() {
    try { return new Date().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }); }
    catch (e) { return new Date().toISOString().slice(0, 16).replace("T", " "); }
}

function getCustomerCheckoutDetails() {
    const nameInput = document.getElementById("checkoutCustomerName");
    const phoneInput = document.getElementById("checkoutCustomerPhone");
    const addrInput = document.getElementById("checkoutCustomerAddress");
    let customerName = nameInput ? nameInput.value.trim() : "";
    let customerPhone = phoneInput ? phoneInput.value.trim() : "";
    let customerAddress = addrInput ? addrInput.value.trim() : "";

    if (!customerName || !customerPhone) {
        try {
            const raw = localStorage.getItem(CUSTOMER_PROFILE_KEY);
            if (raw) {
                const prof = JSON.parse(raw);
                if (!customerName && prof.name) {
                    customerName = String(prof.name).trim();
                    if (nameInput) nameInput.value = customerName;
                }
                if (!customerPhone && prof.phone) {
                    customerPhone = String(prof.phone).trim();
                    if (phoneInput) phoneInput.value = customerPhone;
                }
                if (!customerAddress && prof.address) {
                    customerAddress = String(prof.address).trim();
                    if (addrInput) addrInput.value = customerAddress;
                }
            }
        } catch (e) {}
    }

    return { customerName, customerPhone, customerAddress };
}

function syncLocationButtonUI() {
    const btn = document.getElementById("cartLocationBtn");
    const btnText = document.getElementById("cartLocationBtnText");
    const clearBtn = document.getElementById("cartLocationClearBtn");
    const preview = document.getElementById("cartLocationPreview");
    if (!btn || !btnText || !preview) return;

    if (customerLocationCoords && customerLocationCoords.lat && customerLocationCoords.lng) {
        btn.classList.add("located");
        btnText.textContent = "تم تحديد موقعك ✓ (تحديث)";
        if (clearBtn) clearBtn.classList.add("visible");
        const mapsUrl = `https://maps.google.com/?q=${customerLocationCoords.lat},${customerLocationCoords.lng}`;
        preview.classList.remove("is-hidden");
        preview.innerHTML = `اللوكيشن محفوظ: <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-deep);font-weight:800;">فتح على الخريطة</a> (${customerLocationCoords.lat.toFixed(5)}, ${customerLocationCoords.lng.toFixed(5)})`;
    } else {
        btn.classList.remove("located");
        btnText.textContent = "تحديد موقعي الحالي (اللوكيشن)";
        if (clearBtn) clearBtn.classList.remove("visible");
        preview.classList.add("is-hidden");
        preview.textContent = "";
    }
}

function requestCustomerLocation() {
    if (!navigator.geolocation) {
        showCaramelToast("المتصفح الحالي لا يدعم تحديد الموقع الجغرافي");
        return;
    }
    const btnText = document.getElementById("cartLocationBtnText");
    if (btnText) btnText.textContent = "جاري تحديد الموقع...";
    navigator.geolocation.getCurrentPosition(
        pos => {
            customerLocationCoords = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: Math.round(pos.coords.accuracy || 0)
            };
            syncLocationButtonUI();
            showCaramelToast("تم تحديد موقعك وإرفاقه مع بيانات الطلب");
        },
        () => {
            syncLocationButtonUI();
            showCaramelToast("تعذر الوصول للموقع — تأكد من تفعيل GPS والسماح بالصلاحية");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

function clearCustomerLocation() {
    customerLocationCoords = null;
    syncLocationButtonUI();
    showCaramelToast("تم إلغاء اللوكيشن المرفق");
}

function validateCustomerBeforeCheckout(customerName, customerPhone) {
    if (!customerName) {
        toggleProfileEditorPanel(true);
        document.getElementById("checkoutCustomerName")?.focus();
        showCaramelToast("يرجى إدخال الاسم بالكامل أولاً");
        return false;
    }
    if (!customerPhone) {
        toggleProfileEditorPanel(true);
        document.getElementById("checkoutCustomerPhone")?.focus();
        showCaramelToast("يرجى إدخال رقم التواصل أولاً");
        return false;
    }
    return true;
}

function buildOrderSummaryPayload(items, orderId, customerName, customerPhone, customerAddress = "", isAppend = false) {
    let total = 0;
    let totalPieces = 0;
    const lines = items.map((item, idx) => {
        const linePrice = (Number(item.price) || 0) * item.qty;
        total += linePrice;
        totalPieces += item.qty;
        const prodObj = PRODUCTS.find(p => p.id === item.id);
        const optTag = resolveCartOptionShortTag(prodObj);
        const opts = [
            item.selectedSize ? `${optTag}: ${item.selectedSize}` : "",
            item.selectedColor ? `اللون: ${item.selectedColor}` : "",
            item.note ? `ملاحظة: ${item.note}` : ""
        ].filter(Boolean).join(" | ");
        const merchantTag = item.merchant ? ` [التاجر: ${item.merchant}]` : "";
        const imgLine = item.img ? `\n   الصورة: ${item.img}` : "";
        return `${idx + 1}. ${item.title}${merchantTag} × ${item.qty} = ${linePrice} جنيه${opts ? ` (${opts})` : ""}${imgLine}`;
    });

    const headerTitle = isAppend
        ? `إضافة منتجات على الطلب رقم: ${orderId}`
        : `طلب جديد من متجر كارامل — رقم الطلب: ${orderId}`;

    const msgParts = [
        headerTitle,
        `العميل: ${customerName}`,
        `رقم التواصل: ${customerPhone}`
    ];
    if (customerAddress) msgParts.push(`العنوان: ${customerAddress}`);
    if (customerLocationCoords && customerLocationCoords.lat && customerLocationCoords.lng) {
        msgParts.push(`اللوكيشن: https://maps.google.com/?q=${customerLocationCoords.lat},${customerLocationCoords.lng}`);
    }
    msgParts.push("------------------------", ...lines, "------------------------", `عدد القطع: ${totalPieces}`, `الإجمالي: ${total} جنيه`);

    return { total, totalPieces, text: msgParts.join("\n") };
}

function copyOrderSummaryText() {
    if (!cart.length) {
        showCaramelToast("السلة فارغة — أضف منتجات أولاً لنسخ ملخص الطلب");
        return;
    }
    const { customerName, customerPhone, customerAddress } = getCustomerCheckoutDetails();
    const previewCode = appendTargetOrderId || "معاينة";
    const summary = buildOrderSummaryPayload(
        cart,
        previewCode,
        customerName || "غير محدد",
        customerPhone || "غير محدد",
        customerAddress,
        Boolean(appendTargetOrderId)
    );

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summary.text).then(() => {
            showCaramelToast("تم نسخ ملخص الطلب بالكامل ✓");
        }).catch(() => {
            showCaramelToast("تعذر النسخ التلقائي — حاول مرة أخرى");
        });
    } else {
        showCaramelToast("المتصفح لا يدعم النسخ التلقائي");
    }
}

function toggleOrderAccordion(orderId) {
    if (!orderId) return;
    if (expandedOrderIds.has(orderId)) expandedOrderIds.delete(orderId);
    else expandedOrderIds.add(orderId);
    updateCartUI();
}

function copyOrderIdToClipboard(orderId, event) {
    if (event) event.stopPropagation();
    if (!orderId) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(orderId).then(() => showCaramelToast(`تم نسخ رقم الطلب: ${orderId}`)).catch(() => showCaramelToast(`رقم الطلب: ${orderId}`));
    } else {
        showCaramelToast(`رقم الطلب: ${orderId}`);
    }
}

function startAppendToOrder(orderId) {
    const target = activeOrders.find(o => o.orderId === orderId);
    if (!target) return;
    appendTargetOrderId = orderId;
    activeCartOrdersTab = "cart";
    updateCartUI();
    showCaramelToast(`وضع الإضافة على الطلب ${orderId} مفعّل — اختر المنتجات ثم أرسل التحديث`);
}

function cancelAppendToOrderMode() {
    appendTargetOrderId = null;
    updateCartUI();
    showCaramelToast("تم إنهاء وضع الإضافة على الطلب");
}

function sendActiveOrderUpdateOnWhatsApp(orderId) {
    const order = activeOrders.find(o => o.orderId === orderId);
    if (!order) return;
    const { customerName, customerPhone, customerAddress } = getCustomerCheckoutDetails();
    const finalName = customerName || order.customerName || "عميل كارامل";
    const finalPhone = customerPhone || order.customerPhone || "";
    const finalAddr = customerAddress || order.customerAddress || "";
    const summary = buildOrderSummaryPayload(order.items, order.orderId, finalName, finalPhone, finalAddr, false);
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`متابعة وتأكيد الطلب رقم ${order.orderId}\n${summary.text}`)}`);
}

function markOrderAsReceived(orderId) {
    const idx = activeOrders.findIndex(o => o.orderId === orderId);
    if (idx === -1) return;
    const [order] = activeOrders.splice(idx, 1);
    order.status = "received";
    order.receivedAt = formatOrderTimestamp();
    receivedOrders.unshift(order);
    if (appendTargetOrderId === orderId) appendTargetOrderId = null;
    expandedOrderIds.add(order.orderId);
    saveActiveOrders();
    saveReceivedOrders();
    updateCartUI();
    showCaramelToast(`تم نقل الطلب ${order.orderId} إلى الأوردرات المستلمة ✓`);
}

function cancelActiveOrder(orderId) {
    openConfirmModal("إلغاء الطلب", `هل تريد إلغاء وحذف الطلب رقم ${orderId} من الطلبات قيد التنفيذ؟`, () => {
        activeOrders = activeOrders.filter(o => o.orderId !== orderId);
        if (appendTargetOrderId === orderId) appendTargetOrderId = null;
        saveActiveOrders();
        updateCartUI();
        showCaramelToast(`تم إلغاء الطلب ${orderId}`);
    }, "إلغاء الطلب");
}

function reorderReceivedItem(title, price, img, merchant = "", selectedSize = "", selectedColor = "") {
    const matchedProd = PRODUCTS.find(p => p.title === title);
    if (matchedProd) {
        addToCart(matchedProd.id, null, selectedSize, selectedColor, "", img || matchedProd.img);
        activeCartOrdersTab = "cart";
        updateCartUI();
        return;
    }
    const existing = cart.find(c => c.title === title && (c.selectedSize || "") === selectedSize && (c.selectedColor || "") === selectedColor);
    if (existing) existing.qty += 1;
    else cart.push({ id: `reorder-${Date.now()}`, title, price: Number(price) || 0, img: img || "", merchant, selectedSize, selectedColor, note: "", qty: 1 });
    saveCart();
    activeCartOrdersTab = "cart";
    updateCartUI();
    showCaramelToast(`تمت إعادة إضافة "${title}" إلى السلة`);
}

function clearReceivedOrdersHistory() {
    if (!receivedOrders.length) return;
    openConfirmModal("مسح سجل المستلمة", "هل تريد مسح سجل الأوردرات المستلمة بالكامل؟", () => {
        receivedOrders = [];
        saveReceivedOrders();
        updateCartUI();
        showCaramelToast("تم مسح سجل الأوردرات المستلمة");
    }, "مسح");
}

function checkoutOnWhatsApp() {
    if (!cart.length) {
        showCaramelToast("السلة فارغة — أضف منتجات أولاً");
        return;
    }
    const { customerName, customerPhone, customerAddress } = getCustomerCheckoutDetails();
    if (!validateCustomerBeforeCheckout(customerName, customerPhone)) return;
    saveCustomerProfileInputs(customerName, customerPhone, customerAddress);

    const itemsSnapshot = cart.map(item => ({ ...item }));
    const isAppending = Boolean(appendTargetOrderId);
    let targetOrder = isAppending ? activeOrders.find(o => o.orderId === appendTargetOrderId) : null;

    if (targetOrder) {
        itemsSnapshot.forEach(newItem => {
            const existing = targetOrder.items.find(it =>
                it.title === newItem.title &&
                (it.selectedSize || "") === (newItem.selectedSize || "") &&
                (it.selectedColor || "") === (newItem.selectedColor || "") &&
                (it.note || "") === (newItem.note || "")
            );
            if (existing) existing.qty += newItem.qty;
            else targetOrder.items.push({ ...newItem });
        });
        targetOrder.total = targetOrder.items.reduce((sum, it) => sum + ((Number(it.price) || 0) * it.qty), 0);
        targetOrder.updatedAt = formatOrderTimestamp();
        targetOrder.customerName = customerName;
        targetOrder.customerPhone = customerPhone;
        targetOrder.customerAddress = customerAddress;
        expandedOrderIds.add(targetOrder.orderId);
    } else {
        const orderCode = generateOrderCode();
        const totalVal = itemsSnapshot.reduce((sum, it) => sum + ((Number(it.price) || 0) * it.qty), 0);
        targetOrder = {
            orderId: orderCode,
            createdAt: formatOrderTimestamp(),
            status: "pending",
            customerName,
            customerPhone,
            customerAddress,
            items: itemsSnapshot,
            total: totalVal
        };
        activeOrders.unshift(targetOrder);
        expandedOrderIds.add(orderCode);
    }

    const summary = buildOrderSummaryPayload(targetOrder.items, targetOrder.orderId, customerName, customerPhone, customerAddress, isAppending);
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(summary.text)}`;

    cart = [];
    appendTargetOrderId = null;
    saveCart();
    saveActiveOrders();
    activeCartOrdersTab = "pending";
    updateCartUI();
    showCaramelToast(`تم حفظ الطلب ${targetOrder.orderId} وجاري فتح واتساب...`);
    launchWhatsAppTarget(waUrl);
}

function openWhatsAppChatDirect() {
    const { customerName, customerPhone } = getCustomerCheckoutDetails();
    let msg = "مرحباً متجر كارامل، أريد الاستفسار عن طلب أو منتجات";
    if (customerName || customerPhone) msg += ` (العميل: ${customerName || "-"} | الهاتف: ${customerPhone || "-"})`;
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`);
}

function renderActiveOrdersSection() {
    const container = document.getElementById("activeOrdersContainer");
    const badge = document.getElementById("activeOrdersCountBadge");
    const pageChip = document.getElementById("pendingOrdersPageChip");
    if (!container) return;

    if (badge) badge.textContent = String(activeOrders.length);
    if (pageChip) pageChip.textContent = `${activeOrders.length} طلب`;

    if (!activeOrders.length) {
        container.innerHTML = `<div class="active-orders-empty">لا توجد طلبات قيد التنفيذ حالياً.</div>`;
        return;
    }

    container.innerHTML = activeOrders.map(order => {
        const isAppendingHere = appendTargetOrderId === order.orderId;
        const isExpanded = expandedOrderIds.has(order.orderId);
        const orderTotal = order.items.reduce((sum, it) => sum + ((Number(it.price) || 0) * it.qty), 0);
        const orderPieces = order.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
        const safeOrderIdAttr = escapeHtmlAttr(order.orderId);
        const safeOrderIdText = escapeHtml(order.orderId);

        const itemsHtml = order.items.map(it => {
            const prodObj = PRODUCTS.find(p => p.id === it.id);
            const optTag = resolveCartOptionShortTag(prodObj);
            const metaParts = [
                it.merchant ? `التاجر: ${it.merchant}` : "",
                it.selectedSize ? `${optTag}: ${it.selectedSize}` : "",
                it.selectedColor ? `اللون: ${it.selectedColor}` : "",
                it.note ? `ملاحظة: ${it.note}` : ""
            ].filter(Boolean).join(" • ");
            return `
                <div class="active-order-item-row">
                    <img src="${escapeHtmlAttr(it.img || "")}" alt="${escapeHtmlAttr(it.title)}" onerror="handleProductImageError(this, '${escapeHtmlAttr(it.id)}')">
                    <div class="active-order-item-meta">
                        <div class="cart-item-title">${escapeHtml(it.title)} × ${it.qty}</div>
                        ${metaParts ? `<div class="cart-item-sub">${escapeHtml(metaParts)}</div>` : ""}
                        <div class="cart-item-price">${formatPriceNumber((Number(it.price) || 0) * it.qty)} جنيه</div>
                    </div>
                </div>
            `;
        }).join("");

        return `
            <div class="order-accordion-card ${isAppendingHere ? "appending-target" : ""} ${isExpanded ? "is-expanded" : ""}">
                <button type="button" class="order-number-trigger" onclick="toggleOrderAccordion('${safeOrderIdAttr}')" aria-expanded="${isExpanded}">
                    <div>
                        <div class="order-id-row">
                            <span class="order-id-badge-label">رقم الطلب:</span>
                            <span class="order-id-code">${safeOrderIdText}</span>
                            <span class="order-id-hint">(${orderPieces} قطعة • ${formatPriceNumber(orderTotal)} ج)</span>
                        </div>
                        <div class="order-trigger-sub">${escapeHtml(order.createdAt || "")}${isAppendingHere ? " • جاري الإضافة عليه الآن" : ""}</div>
                    </div>
                    <div class="order-trigger-right">
                        <span class="active-order-status-pill">${isAppendingHere ? "إضافة منتجات" : "قيد التنفيذ"}</span>
                        <span class="order-chevron-icon">⌄</span>
                    </div>
                </button>
                <div class="order-accordion-panel">
                    <div class="order-stage-stepper">
                        <span class="order-stage-step done"><span class="order-stage-dot"></span>تم إرسال الطلب</span>
                        <span class="order-stage-step done"><span class="order-stage-dot"></span>قيد التجهيز</span>
                        <span class="order-stage-step"><span class="order-stage-dot"></span>بانتظار الاستلام</span>
                    </div>
                    <div class="active-order-head">
                        <span class="active-order-date">تفاصيل الطلب</span>
                        <button type="button" class="order-copy-id-btn" onclick="copyOrderIdToClipboard('${safeOrderIdAttr}', event)">نسخ الرقم</button>
                    </div>
                    <div class="active-order-items">${itemsHtml}</div>
                    <div class="active-order-total-line">
                        <span>إجمالي الطلب:</span>
                        <strong>${formatPriceNumber(orderTotal)} جنيه</strong>
                    </div>
                    <div class="active-order-actions">
                        <button type="button" class="order-add-more-btn" onclick="startAppendToOrder('${safeOrderIdAttr}')">+ إضافة منتجات</button>
                        <button type="button" class="order-send-update-btn" onclick="sendActiveOrderUpdateOnWhatsApp('${safeOrderIdAttr}')">إرسال واتساب</button>
                        <button type="button" class="order-received-btn" onclick="markOrderAsReceived('${safeOrderIdAttr}')">تم الاستلام ✓</button>
                        <button type="button" class="order-cancel-btn" onclick="cancelActiveOrder('${safeOrderIdAttr}')">إلغاء الطلب</button>
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
    if (pageChip) pageChip.textContent = `${receivedOrders.length} طلب`;

    if (!receivedOrders.length) {
        container.innerHTML = `<div class="received-orders-empty">لا توجد أوردرات مستلمة بعد.</div>`;
        return;
    }

    const cardsHtml = receivedOrders.map(order => {
        const isExpanded = expandedOrderIds.has(order.orderId);
        const orderTotal = order.items.reduce((sum, it) => sum + ((Number(it.price) || 0) * it.qty), 0);
        const orderPieces = order.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
        const safeOrderIdAttr = escapeHtmlAttr(order.orderId);
        const safeOrderIdText = escapeHtml(order.orderId);

        const rowsHtml = order.items.map(it => {
            const prodObj = PRODUCTS.find(p => p.id === it.id);
            const optTag = resolveCartOptionShortTag(prodObj);
            const subInfo = [
                it.merchant ? `التاجر: ${it.merchant}` : "",
                it.selectedSize ? `${optTag}: ${it.selectedSize}` : "",
                it.selectedColor ? `اللون: ${it.selectedColor}` : "",
                `الكمية: ${it.qty}`
            ].filter(Boolean).join(" • ");
            return `
                <div class="received-order-item-row">
                    <div>
                        <div class="received-order-item-title">${escapeHtml(it.title)}</div>
                        <div class="received-order-item-sub">${escapeHtml(subInfo)} — ${formatPriceNumber((Number(it.price) || 0) * it.qty)} جنيه</div>
                    </div>
                    <button type="button" class="received-reorder-btn" onclick="reorderReceivedItem('${escapeHtmlAttr(it.title)}', ${Number(it.price) || 0}, '${escapeHtmlAttr(it.img || "")}', '${escapeHtmlAttr(it.merchant || "")}', '${escapeHtmlAttr(it.selectedSize || "")}', '${escapeHtmlAttr(it.selectedColor || "")}')">إعادة طلب</button>
                </div>
            `;
        }).join("");

        return `
            <div class="order-accordion-card ${isExpanded ? "is-expanded" : ""}">
                <button type="button" class="order-number-trigger" onclick="toggleOrderAccordion('${safeOrderIdAttr}')" aria-expanded="${isExpanded}">
                    <div>
                        <div class="order-id-row">
                            <span class="order-id-badge-label">رقم الطلب:</span>
                            <span class="order-id-code">${safeOrderIdText}</span>
                            <span class="order-id-hint">(${orderPieces} قطعة • ${formatPriceNumber(orderTotal)} ج)</span>
                        </div>
                        <div class="order-trigger-sub">استُلم في: ${escapeHtml(order.receivedAt || order.createdAt || "")}</div>
                    </div>
                    <div class="order-trigger-right">
                        <span class="received-order-status-pill">مستلم ✓</span>
                        <span class="order-chevron-icon">⌄</span>
                    </div>
                </button>
                <div class="order-accordion-panel">
                    <div class="active-order-head">
                        <span class="active-order-date">منتجات الطلب</span>
                        <button type="button" class="order-copy-id-btn" onclick="copyOrderIdToClipboard('${safeOrderIdAttr}', event)">نسخ الرقم</button>
                    </div>
                    ${rowsHtml}
                </div>
            </div>
        `;
    }).join("");

    container.innerHTML = `${cardsHtml}<button type="button" class="received-clear-btn" onclick="clearReceivedOrdersHistory()">مسح سجل الأوردرات المستلمة</button>`;
}

function updateCartUI() {
    const cartItemsContainer = document.getElementById("cartItemsContainer");
    const cartTotalAmount = document.getElementById("cartTotalAmount");
    const bottomCartCount = document.getElementById("bottomCartCount");
    const currentCartCountBadge = document.getElementById("currentCartCountBadge");
    const currentCartPageChip = document.getElementById("currentCartPageChip");
    const cartDistinctCount = document.getElementById("cartDistinctCount");
    const cartTotalPieces = document.getElementById("cartTotalPieces");
    const appendBanner = document.getElementById("appendOrderBanner");
    const appendBannerText = document.getElementById("appendOrderBannerText");
    const checkoutBtn = document.querySelector(".whatsapp-checkout-btn");

    let total = 0;
    let totalCount = 0;

    if (appendBanner && appendBannerText) {
        if (appendTargetOrderId) {
            appendBanner.classList.remove("is-hidden");
            appendBannerText.innerHTML = `إضافة منتجات على الطلب رقم <strong>${escapeHtml(appendTargetOrderId)}</strong>`;
        } else {
            appendBanner.classList.add("is-hidden");
            appendBannerText.textContent = "";
        }
    }

    if (checkoutBtn) {
        checkoutBtn.textContent = appendTargetOrderId
            ? `تأكيد وإضافة المنتجات للطلب ${appendTargetOrderId} عبر واتساب`
            : "إرسال وتأكيد الطلب عبر واتساب";
    }

    if (!cart.length) {
        if (cartItemsContainer) {
            cartItemsContainer.innerHTML = appendTargetOrderId
                ? `<div class="cart-empty">اختر المنتجات التي تريد إضافتها للطلب ${escapeHtml(appendTargetOrderId)} ثم اضغط تأكيد الإضافة.</div>`
                : `<div class="cart-empty">السلة الجارية فارغة حالياً — أضف منتجات من المتجر.</div>`;
        }
    } else if (cartItemsContainer) {
        cartItemsContainer.innerHTML = cart.map((item, idx) => {
            const unitPrice = Number(item.price) || 0;
            const itemTotal = unitPrice * item.qty;
            total += itemTotal;
            totalCount += item.qty;

            const prod = PRODUCTS.find(p => p.id === item.id);
            const variantConfig = getProductVariantConfig(prod);
            let optionsHtml = "";

            if (variantConfig) {
                if (variantConfig.sizes && variantConfig.sizes.length) {
                    const sTag = variantConfig.shortTag || resolveCartOptionShortTag(prod);
                    optionsHtml += `<select class="cart-option-select" aria-label="${escapeHtmlAttr(sTag)}" onchange="updateCartItemOption(${idx}, 'size', this.value)">${variantConfig.sizes.map(s => {
                        const sLbl = typeof s === "string" ? s : s.label;
                        return `<option value="${escapeHtmlAttr(sLbl)}" ${item.selectedSize === sLbl ? "selected" : ""}>${escapeHtml(sTag)}: ${escapeHtml(sLbl)}</option>`;
                    }).join("")}</select>`;
                }
                if (variantConfig.colors && variantConfig.colors.length) {
                    optionsHtml += `<select class="cart-option-select" aria-label="اللون" onchange="updateCartItemOption(${idx}, 'color', this.value)">${variantConfig.colors.map(c => `<option value="${escapeHtmlAttr(c)}" ${item.selectedColor === c ? "selected" : ""}>اللون: ${escapeHtml(c)}</option>`).join("")}</select>`;
                }
            }

            return `
                <div class="cart-item">
                    <div class="cart-item-top">
                        <img src="${escapeHtmlAttr(item.img || "")}" alt="${escapeHtmlAttr(item.title)}" onerror="handleProductImageError(this, '${escapeHtmlAttr(item.id)}')">
                        <div class="cart-item-info">
                            <div class="cart-item-title">${escapeHtml(item.title)}</div>
                            ${item.merchant ? `<div class="cart-item-sub">التاجر: ${escapeHtml(item.merchant)}</div>` : ""}
                            <div class="cart-item-price">${formatPriceNumber(itemTotal)} جنيه</div>
                        </div>
                        <div class="qty-controls">
                            <button type="button" class="qty-btn" onclick="updateQty(${idx}, 1)">+</button>
                            <span class="qty-val">${item.qty}</span>
                            <button type="button" class="qty-btn" onclick="updateQty(${idx}, -1)">-</button>
                            <button type="button" class="remove-item-btn" onclick="removeCartItem(${idx})" aria-label="حذف">✕</button>
                        </div>
                    </div>
                    ${optionsHtml ? `<div class="cart-item-options">${optionsHtml}</div>` : ""}
                    <input type="text" class="cart-item-note-input" placeholder="ملاحظة على القطعة (اختياري)..." value="${escapeHtmlAttr(item.note || "")}" onchange="updateCartItemOption(${idx}, 'note', this.value)">
                </div>
            `;
        }).join("");
    }

    if (cartTotalAmount) cartTotalAmount.textContent = `${formatPriceNumber(total)} جنيه`;
    if (cartDistinctCount) cartDistinctCount.textContent = String(cart.length);
    if (cartTotalPieces) cartTotalPieces.textContent = String(totalCount);
    if (currentCartCountBadge) currentCartCountBadge.textContent = String(cart.length);
    if (currentCartPageChip) currentCartPageChip.textContent = `${totalCount} قطعة`;

    if (bottomCartCount) {
        bottomCartCount.textContent = String(totalCount);
        bottomCartCount.classList.toggle("visible", totalCount > 0);
    }

    renderActiveOrdersSection();
    renderReceivedOrdersSection();
    switchCartOrdersTab(activeCartOrdersTab);
    syncLocationButtonUI();
    syncMyDataButtonBadge();
}

function isPushSubscribed() {
    try { return localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "1" || (typeof Notification !== "undefined" && Notification.permission === "granted"); }
    catch (e) { return false; }
}

function isPushPillCollapsed() {
    try { return localStorage.getItem(PUSH_PILL_COLLAPSED_KEY) === "1"; } catch (e) { return false; }
}

function setPushPillCollapsed(val) {
    try { localStorage.setItem(PUSH_PILL_COLLAPSED_KEY, val ? "1" : "0"); } catch (e) {}
}

function schedulePushPillAutoCollapse() {
    clearTimeout(pushPillHideTimer);
    pushPillHideTimer = setTimeout(() => {
        const btn = document.getElementById("caramelPushBtn");
        if (!btn || !isPushSubscribed()) return;
        setPushPillCollapsed(true);
        btn.classList.add("circle-check-only");
    }, 3000);
}

function syncPushButtonUI() {
    const btn = document.getElementById("caramelPushBtn");
    const textEl = document.getElementById("caramelPushBtnText");
    const iconEl = document.getElementById("caramelPushIcon");
    if (!btn || !textEl) return;

    const subscribed = isPushSubscribed();
    btn.classList.add("visible");
    if (subscribed) {
        textEl.textContent = "تم تفعيل الإشعارات";
        if (iconEl) iconEl.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        if (isPushPillCollapsed()) {
            btn.classList.add("circle-check-only");
            btn.classList.remove("hiding-smooth");
        } else {
            btn.classList.remove("circle-check-only", "hiding-smooth");
            schedulePushPillAutoCollapse();
        }
    } else {
        btn.classList.remove("circle-check-only", "hiding-smooth");
        textEl.textContent = "فعّل إشعارات العروض";
        if (iconEl) iconEl.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
    }
}

async function enableCaramelPush() {
    if (isPushSubscribed()) {
        const btn = document.getElementById("caramelPushBtn");
        if (btn && btn.classList.contains("circle-check-only")) {
            btn.classList.remove("circle-check-only");
            setPushPillCollapsed(false);
            schedulePushPillAutoCollapse();
        }
        showCaramelToast("إشعارات متجر كارامل مفعّلة بالفعل ✓");
        return;
    }

    try {
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
            await Notification.requestPermission();
        }
        localStorage.setItem(PUSH_SUBSCRIBED_KEY, "1");
        setPushPillCollapsed(false);
        syncPushButtonUI();
        showCaramelToast("تم تفعيل إشعارات عروض متجر كارامل بنجاح ✓");
    } catch (e) {
        showCaramelToast("تعذر تفعيل الإشعارات على هذا المتصفح");
    }
}

function runSplashScreenSequence() {
    const splash = document.getElementById("caramelSplashScreen");
    const subRect = document.getElementById("caramelSplashSubRect");
    const typedEl = document.getElementById("caramelSplashTypedText");
    if (!splash) return;

    const fullText = "كل قطعة وليها دور";
    if (typedEl) typedEl.textContent = fullText;

    setTimeout(() => {
        if (subRect) subRect.classList.add("descend-in");
    }, 120);

    setTimeout(() => {
        splash.classList.add("hide");
        setTimeout(() => { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 450);
    }, 1150);
}

initThemeMode();
syncBrandLogos();
syncSupportWhatsAppLinks();
syncHeaderStickyOffsets();
runSplashScreenSequence();
loadCustomerProfileToInputs();
updateCartUI();
updateWishlistUI();
renderSmartSearchSuggestions();
renderSpotlightBoxes();
renderProducts("all");
setupFeedObserver();
syncPushButtonUI();
loadMerchantProductsFromJson(false);
