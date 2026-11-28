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

let WHATSAPP_NUMBER = "201055436305";
let STORE_URL = "https://caramelstoresuez.github.io/Carmelastore/";
let BRAND_LOGO_URL = "./compressed_1795766509611.jpeg?v=5";

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

const DEFAULT_APPAREL_SIZES = ["S", "M", "L", "XL", "XXL"];
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

    document.querySelectorAll("[data-brand-bg]").forEach(el => {
        el.style.backgroundImage = `url("${BRAND_LOGO_URL}")`;
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
    if (pushedHistoryDepth > 0) pushedHistoryDepth -= 1;
    suppressHistoryStep = true;
    try {
        if (overlayStack.length > 0) {
            closeTopOverlay(true);
            return;
        }
        if (document.getElementById("confirmActionModal")?.classList.contains("open")) {
            closeConfirmModal(true, true);
        } else if (document.getElementById("imageModal")?.classList.contains("open")) {
            closeImageModal(true);
        } else if (document.getElementById("productOptionModal")?.classList.contains("open")) {
            closeProductOptionModal(true);
        } else if (document.getElementById("serviceInfoModal")?.classList.contains("open")) {
            closeServiceInfoModal(true);
        } else if (document.getElementById("becomeMerchantModal")?.classList.contains("open")) {
            closeBecomeMerchantModal(true);
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

const APP_BUILD_VERSION = "v20261127-12";
const APPLIED_BUILD_KEY = "caramel_applied_build_version_v1";
let pendingUpdateAvailable = false;

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

    renderMerchantsQuickStrip();
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
        const fullHaystack = `${normTitle} ${normMerchant} ${normDesc} ${normCats} ${normPrice} ${normExtra}`;
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

    const idxEntry = SEARCH_INDEX_MAP.get(product.id);
    const normTitle = idxEntry ? idxEntry.normTitle : normalizeText(product.title || "");
    const normMerchant = idxEntry ? idxEntry.normMerchant : normalizeText(product.merchant || "");
    const fullHaystack = idxEntry ? idxEntry.fullHaystack : normalizeText(`${product.title || ""} ${product.merchant || ""} ${product.desc || ""} ${buildDynamicSearchTextForProduct(product)}`);
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
        if (normMerchant.includes(term)) {
            termBestScore = Math.max(termBestScore, 70);
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

    if (wishlistIds.includes(String(product.id))) catScore += 16;

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
    const hasTaste = Object.keys(interestData.categories).length > 0 || Object.keys(interestData.keywords).length > 0 || cart.length > 0 || wishlistIds.length > 0;

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

function selectTopQuickTab(catKey, tabEl) {
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => el.classList.remove("active"));
    if (tabEl) tabEl.classList.add("active");
    filterByCategory(catKey, tabEl, true);
}

function hydrateQuickTopTabsIcons() {
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(btn => {
        const catKey = btn.getAttribute("data-quick") || "all";
        if (btn.querySelector(".quick-tab-icon")) return;
        const span = document.createElement("span");
        span.className = "quick-tab-icon";
        span.innerHTML = buildCategoryGraphicSvg(catKey, "currentColor");
        btn.prepend(span);
    });
}

function updateActiveMerchantBanner() {
    const banner = document.getElementById("activeMerchantBanner");
    const nameEl = document.getElementById("merchantBannerName");
    const countEl = document.getElementById("merchantBannerCount");
    const avatarEl = document.getElementById("merchantAvatarInitial");
    if (!banner || !nameEl || !countEl) return;

    if (currentMerchant) {
        document.body.classList.add("merchant-storefront-mode");
        const allMerchantProds = PRODUCTS.filter(p => p.merchant === currentMerchant);
        const visibleCount = currentFeedItems.length;
        nameEl.textContent = currentMerchant;
        if (avatarEl) {
            const firstChar = Array.from(currentMerchant.trim())[0] || "ت";
            avatarEl.textContent = firstChar;
        }
        countEl.textContent = `إجمالي منتجات التاجر: ${allMerchantProds.length} منتج${visibleCount !== allMerchantProds.length ? ` (المعروض حالياً: ${visibleCount})` : ""}`;
        banner.classList.add("visible");
        renderMerchantInnerCategories(currentMerchant);
    } else {
        document.body.classList.remove("merchant-storefront-mode");
        banner.classList.remove("visible");
        renderMerchantInnerCategories("");
    }
}

function filterByMerchant(merchantName, shouldScroll = false) {
    if (!merchantName) return;
    currentMerchant = merchantName;
    currentCategory = "all";
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => {
        el.classList.toggle("active", el.getAttribute("data-quick") === "all");
    });
    renderMerchantsQuickStrip();
    renderProducts("all");
    if (shouldScroll) scrollToProductsTop();
}

function clearMerchantFilter(shouldScroll = false) {
    currentMerchant = "";
    renderMerchantsQuickStrip();
    renderProducts(currentCategory);
    if (shouldScroll) scrollToProductsTop();
}

function buildSkeletonCardHTML() {
    return `
        <div class="product-card skeleton-card" aria-hidden="true">
            <div class="product-img-box skeleton-shimmer"></div>
            <div class="product-details">
                <div>
                    <div class="skeleton-line skeleton-shimmer w-82 h-14"></div>
                    <div class="skeleton-line skeleton-shimmer w-45 h-18 mt-6"></div>
                    <div class="skeleton-line skeleton-shimmer w-65 h-12 mt-6"></div>
                </div>
                <div class="skeleton-line skeleton-shimmer w-100 h-34 mt-10 rounded-12"></div>
            </div>
        </div>
    `;
}

function showSkeletonGrid(count = 8) {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    grid.innerHTML = Array.from({ length: count }, () => buildSkeletonCardHTML()).join("");
}

function buildProductCardHTML(product, isContinuation = false) {
    const imgs = getProductImagesList(product);
    const primaryImg = imgs[0] || "";
    const hasMultipleImgs = imgs.length > 1;
    const displayPrice = formatPriceNumber(product.priceLabel || product.price);
    const hookText = product.desc || buildEngagingHookForProduct(product);
    const merchantName = product.merchant || "متجر كارامل";
    const cardId = isContinuation ? `cont-${product.id}-${feedCycle}` : `prod-${product.id}`;
    const btnId = isContinuation ? `cont-btn-${product.id}-${feedCycle}` : `btn-${product.id}`;
    const styleCls = product.cardStyle === "gold" ? " card-style-gold" : "";
    const isFav = wishlistIds.includes(String(product.id));
    const badgeLabel = product.badge || (currentMerchant ? merchantName : (CATEGORY_NAMES[product.category] || ""));

    const multiImgControls = hasMultipleImgs ? `
        <button type="button" class="card-img-nav-btn prev" onclick="cycleCardImage(this, '${escapeHtmlAttr(product.id)}', -1, event)" aria-label="الصورة السابقة">›</button>
        <button type="button" class="card-img-nav-btn next" onclick="cycleCardImage(this, '${escapeHtmlAttr(product.id)}', 1, event)" aria-label="الصورة التالية">‹</button>
        <span class="card-img-counter" aria-hidden="true">1/${imgs.length}</span>
        <div class="card-img-dots" aria-hidden="true">
            ${imgs.map((_, i) => `<button type="button" class="card-img-dot ${i === 0 ? "active" : ""}" onclick="jumpCardImage(this, '${escapeHtmlAttr(product.id)}', ${i}, event)"></button>`).join("")}
        </div>
    ` : "";

    const isPrimarySoldOut = isProductImageSoldOut(product, primaryImg);
    const imgTag = primaryImg
        ? `<span class="media-soldout-wrap ${isPrimarySoldOut ? "is-soldout" : ""}">
            <img src="${escapeHtmlAttr(primaryImg)}" alt="${escapeHtmlAttr(product.title)}" data-img-idx="0" data-retry-step="0" loading="lazy" decoding="async" onload="this.style.opacity='1'" onerror="handleProductImageError(this, '${escapeHtmlAttr(product.id)}')">
            ${isPrimarySoldOut ? `<span class="soldout-badge-overlay">نفدت الكمية</span>` : ""}
           </span>`
        : "";

    const merchantBadgeRow = `
        <div class="product-merchant-row">
            <button type="button" class="product-merchant-link" onclick="event.stopPropagation(); filterByMerchant('${escapeHtmlAttr(merchantName)}', true)" title="عرض منتجات ${escapeHtmlAttr(merchantName)}">${escapeHtmlAttr(merchantName)}</button>
        </div>
    `;

    return `
        <div class="product-card${styleCls}" id="${escapeHtmlAttr(cardId)}" data-product-id="${escapeHtmlAttr(product.id)}" onmouseenter="startCardAutoSlide(this, '${escapeHtmlAttr(product.id)}')" onmouseleave="stopCardAutoSlide()">
            ${badgeLabel ? `<span class="card-json-badge">${escapeHtmlAttr(badgeLabel)}</span>` : ""}
            <button type="button" class="fav-toggle-btn ${isFav ? "active" : ""}" data-fav-id="${escapeHtmlAttr(product.id)}" aria-pressed="${isFav}" aria-label="إضافة للمفضلة" onclick="toggleProductFavorite('${escapeHtmlAttr(product.id)}', this, event)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            <div class="product-img-box" onclick="openCurrentCardPreview(this, '${escapeHtmlAttr(product.id)}')">
                ${imgTag}
                ${multiImgControls}
            </div>
            <div class="product-details">
                <div>
                    ${merchantBadgeRow}
                    <div class="product-title">${escapeHtmlAttr(product.title)}</div>
                    <div class="product-price-row">
                        <div class="product-price">${displayPrice}<span>جنيه</span></div>
                        ${product.subPrice ? `<span class="product-sub">${escapeHtmlAttr(product.subPrice)}</span>` : ""}
                    </div>
                    <div class="product-desc">${escapeHtmlAttr(hookText)}</div>
                </div>
                <div class="card-btns">
                    <button type="button" class="add-cart-btn" id="${escapeHtmlAttr(btnId)}" onclick="handleAddOrSelectOptions('${escapeHtmlAttr(product.id)}', '${escapeHtmlAttr(btnId)}', this)">+ أضف للسلة</button>
                    <a href="${escapeHtmlAttr(buildProductWhatsAppUrl(product, primaryImg))}" class="direct-wa-link" target="_blank" rel="noopener noreferrer" onclick="event.preventDefault(); launchWhatsAppTarget(this.href);">واتساب</a>
                </div>
            </div>
        </div>
    `;
}

function appendNextFeedBatch() {
    if (isAppendingBatch) return;
    const grid = document.getElementById("productsGrid");
    const sentinel = document.getElementById("feedSentinel");
    if (!grid) return;

    if (renderedCount >= currentFeedItems.length) {
        if (sentinel) {
            if (currentFeedItems.length > 0 && !isFullSelectionMode()) {
                sentinel.textContent = "اكتملت التوصيات — تصفح المزيد بالأسفل";
                renderContinuationAfterRecommendations();
            } else {
                sentinel.textContent = currentFeedItems.length > 0 ? `تم عرض جميع المنتجات (${currentFeedItems.length})` : "";
                clearContinuationAfterRecommendations();
            }
        }
        return;
    }

    isAppendingBatch = true;
    const nextSlice = currentFeedItems.slice(renderedCount, renderedCount + BATCH_SIZE);
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = nextSlice.map(p => buildProductCardHTML(p, false)).join("");
    const fragment = document.createDocumentFragment();
    while (tempDiv.firstChild) fragment.appendChild(tempDiv.firstChild);
    grid.appendChild(fragment);
    hydrateCardsInteractivity(grid);
    renderedCount += nextSlice.length;
    isAppendingBatch = false;

    if (sentinel) {
        if (renderedCount < currentFeedItems.length) {
            sentinel.textContent = `معروض ${renderedCount} من ${currentFeedItems.length} — اسحب للأسفل للمزيد`;
        } else if (!isFullSelectionMode()) {
            sentinel.textContent = "اكتملت التوصيات — تصفح المزيد بالأسفل";
            renderContinuationAfterRecommendations();
        } else {
            sentinel.textContent = `تم عرض جميع المنتجات (${currentFeedItems.length})`;
            clearContinuationAfterRecommendations();
        }
    }
}

function clearContinuationAfterRecommendations() {
    const wrap = document.getElementById("continuationAfterRecommendations");
    if (wrap) wrap.innerHTML = "";
    continuationItems = [];
    continuationBatchIndex = 0;
    continuationCursor = 0;
}

function renderContinuationAfterRecommendations() {
    const wrap = document.getElementById("continuationAfterRecommendations");
    if (!wrap) return;
    if (isFullSelectionMode()) {
        clearContinuationAfterRecommendations();
        return;
    }

    const searchQuery = document.getElementById("homeSearchInput")?.value.trim() || "";
    const recommendedIds = new Set(currentFeedItems.map(p => p.id));
    let pool = PRODUCTS.filter(p => !recommendedIds.has(p.id));
    if (onlyFavoritesMode) pool = pool.filter(p => wishlistIds.includes(String(p.id)));
    if (currentMaxPrice > 0) {
        pool = currentMaxPrice === 1001
            ? pool.filter(p => (Number(p.price) || 0) > 1000)
            : pool.filter(p => (Number(p.price) || 0) <= currentMaxPrice);
    }
    if (searchQuery) pool = pool.filter(p => matchesSearchQuery(p, searchQuery));

    if (!pool.length) {
        clearContinuationAfterRecommendations();
        return;
    }

    feedCycle += 1;
    continuationItems = interleaveMerchantsSmartly(shuffleArray(pool));
    continuationBatchIndex = 1;
    continuationCursor = Math.min(CONTINUATION_STEP, continuationItems.length);
    const initialSlice = continuationItems.slice(0, continuationCursor);

    wrap.innerHTML = `
        <section class="continuation-after-section" aria-label="اختيارات إضافية">
            <div class="continuation-after-header">
                <h3>اختيارات إضافية من المتجر</h3>
                <span class="smart-tag">مجموعة ${continuationBatchIndex}</span>
            </div>
            <div class="continuation-after-grid" id="continuationAfterGrid">
                ${initialSlice.map(p => buildProductCardHTML(p, true)).join("")}
            </div>
            <div class="continuation-load-more-wrap" id="continuationLoadMoreWrap">
                <button type="button" class="continuation-load-more-btn" onclick="loadMoreContinuationItems()">عرض المزيد من المتجر</button>
            </div>
        </section>
    `;
    hydrateCardsInteractivity(wrap);
    syncContinuationButtonState();
}

function syncContinuationButtonState() {
    const loadMoreWrap = document.getElementById("continuationLoadMoreWrap");
    if (!loadMoreWrap) return;
    if (continuationCursor < continuationItems.length) {
        const remaining = continuationItems.length - continuationCursor;
        loadMoreWrap.innerHTML = `<button type="button" class="continuation-load-more-btn" onclick="loadMoreContinuationItems()">عرض المزيد من المتجر (${remaining} متبقي)</button>`;
    } else {
        loadMoreWrap.innerHTML = `<button type="button" class="continuation-load-more-btn" onclick="shuffleContinuationItems()">تبديل وتجديد المنتجات</button>`;
    }
}

function loadMoreContinuationItems() {
    const grid = document.getElementById("continuationAfterGrid");
    if (!grid) return;
    if (continuationCursor >= continuationItems.length) {
        shuffleContinuationItems();
        return;
    }
    const nextSlice = continuationItems.slice(continuationCursor, continuationCursor + CONTINUATION_STEP);
    continuationCursor += nextSlice.length;
    const temp = document.createElement("div");
    temp.innerHTML = nextSlice.map(p => buildProductCardHTML(p, true)).join("");
    while (temp.firstChild) grid.appendChild(temp.firstChild);
    hydrateCardsInteractivity(grid);
    syncContinuationButtonState();
}

function shuffleContinuationItems() {
    const grid = document.getElementById("continuationAfterGrid");
    const section = document.querySelector(".continuation-after-section");
    if (!grid || !continuationItems.length) return;
    feedCycle += 1;
    continuationBatchIndex += 1;
    continuationItems = interleaveMerchantsSmartly(shuffleArray(continuationItems));
    continuationCursor = Math.min(CONTINUATION_STEP, continuationItems.length);
    const nextSlice = continuationItems.slice(0, continuationCursor);
    grid.innerHTML = nextSlice.map(p => buildProductCardHTML(p, true)).join("");
    hydrateCardsInteractivity(grid);
    const badge = section?.querySelector(".smart-tag");
    if (badge) badge.textContent = `مجموعة ${continuationBatchIndex}`;
    syncContinuationButtonState();
    try { section.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {}
}

function setupInfiniteScrollObserver() {
    const sentinel = document.getElementById("feedSentinel");
    if (!sentinel) return;
    if (feedObserver) feedObserver.disconnect();
    if (!("IntersectionObserver" in window)) return;
    feedObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && renderedCount < currentFeedItems.length) appendNextFeedBatch();
        });
    }, { root: null, rootMargin: "420px 0px", threshold: 0.01 });
    feedObserver.observe(sentinel);
}

function renderProducts(category = "all") {
    currentCategory = category;
    applyCategoryPageMood(currentMerchant ? "all" : category);
    const grid = document.getElementById("productsGrid");
    const titleEl = document.getElementById("activeCategoryTitle");
    const badgeEl = document.getElementById("resultsCountBadge");
    const sentinel = document.getElementById("feedSentinel");
    const summaryBar = document.getElementById("searchResultsSummaryBar");
    const summaryText = document.getElementById("searchResultsSummaryText");
    if (!grid) return;

    if (isLoadingJsonProducts && PRODUCTS.length === 0) {
        if (titleEl) titleEl.textContent = "جاري تحميل منتجات المتجر...";
        if (badgeEl) badgeEl.textContent = "";
        if (sentinel) sentinel.textContent = "";
        showSkeletonGrid(8);
        return;
    }

    const searchQuery = document.getElementById("homeSearchInput")?.value.trim() || "";
    const hasSearch = searchQuery.length > 0;

    let basePool = PRODUCTS;
    if (currentMerchant) {
        basePool = basePool.filter(p => p.merchant === currentMerchant);
    }

    renderSmartPriceChips(basePool);

    let filtered = basePool;
    if (category && category !== "all") {
        filtered = filtered.filter(p => p.category === category || (Array.isArray(p.categories) && p.categories.includes(category)));
    }

    if (onlyFavoritesMode) {
        filtered = filtered.filter(p => wishlistIds.includes(String(p.id)));
    }

    if (currentMaxPrice > 0) {
        filtered = currentMaxPrice === 1001
            ? filtered.filter(p => (Number(p.price) || 0) > 1000)
            : filtered.filter(p => (Number(p.price) || 0) <= currentMaxPrice);
    }

    let searchScores = null;
    if (hasSearch) {
        searchScores = new Map();
        filtered = filtered.filter(p => {
            const sc = getProductSearchScore(p, searchQuery);
            if (sc > 0) {
                searchScores.set(p.id, sc);
                return true;
            }
            return false;
        });
    }

    if (currentFeedMode === "deals") {
        filtered = [...filtered].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (currentFeedMode === "new") {
        filtered = interleaveMerchantsSmartly([...filtered].reverse());
    } else {
        filtered = [...filtered].sort((a, b) => scoreProductForUser(b, 1) - scoreProductForUser(a, 1));
        if (!currentMerchant && (!category || category === "all") && !hasSearch) {
            filtered = interleaveMerchantsSmartly(filtered);
        }
    }

    if (hasSearch && searchScores && currentSortMode === "smart") {
        filtered = [...filtered].sort((a, b) => (searchScores.get(b.id) || 0) - (searchScores.get(a.id) || 0));
    }

    if (currentSortMode === "price-asc") {
        filtered = [...filtered].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (currentSortMode === "price-desc") {
        filtered = [...filtered].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    }

    currentFeedItems = filtered;
    updateActiveMerchantBanner();

    const catLabel = CATEGORY_NAMES[category] || "الكل";
    const modeLabel = currentFeedMode === "deals" ? "أسعار اقتصادية" : (currentFeedMode === "new" ? "مدخلات جديدة" : "من أجلك");

    if (titleEl) {
        if (currentMerchant) {
            titleEl.textContent = category && category !== "all" ? `${currentMerchant} — ${catLabel}` : `منتجات ${currentMerchant}`;
        } else if (onlyFavoritesMode) {
            titleEl.textContent = "المفضلة ♥";
        } else if (hasSearch) {
            titleEl.textContent = `نتائج البحث: "${searchQuery}"`;
        } else {
            titleEl.textContent = `${catLabel} — ${modeLabel}`;
        }
    }

    if (badgeEl) {
        badgeEl.textContent = "";
        badgeEl.style.display = "none";
    }

    if (summaryBar && summaryText) {
        if (hasSearch) {
            const suggestion = filtered.length === 0 ? getSmartQuerySuggestion(searchQuery) : "";
            const hintHtml = suggestion
                ? ` — هل تقصد: <button type="button" class="search-clear-inline-btn" onclick="applyQuickSearch('${escapeHtmlAttr(suggestion)}')">${escapeHtmlAttr(suggestion)}</button>`
                : "";
            summaryText.innerHTML = `نتائج البحث عن "<strong>${escapeHtmlAttr(searchQuery)}</strong>": <strong>${filtered.length}</strong> منتج${hintHtml}`;
            summaryBar.classList.add("visible");
        } else {
            summaryBar.classList.remove("visible");
        }
    }

    if (filtered.length === 0) {
        const suggestion = hasSearch ? getSmartQuerySuggestion(searchQuery) : "";
        const suggestionBtnHtml = suggestion
            ? `<button type="button" class="continuation-load-more-btn" onclick="applyQuickSearch('${escapeHtmlAttr(suggestion)}')">بحث عن "${escapeHtmlAttr(suggestion)}"</button>`
            : "";
        grid.innerHTML = `
            <div class="empty-state-box">
                <p class="empty-state-msg">لا توجد منتجات مطابقة لاختياراتك الحالية.</p>
                <div class="empty-state-actions">
                    ${suggestionBtnHtml}
                    <button type="button" class="continuation-load-more-btn" onclick="resetHomeFresh()">عرض كل المنتجات</button>
                </div>
            </div>`;
        if (sentinel) sentinel.textContent = "";
        clearContinuationAfterRecommendations();
        return;
    }

    renderedCount = 0;
    const initialBatchSize = isFullSelectionMode() ? FULL_MODE_INITIAL_BATCH : BATCH_SIZE;
    const initialSlice = currentFeedItems.slice(0, initialBatchSize);
    grid.innerHTML = initialSlice.map(p => buildProductCardHTML(p, false)).join("");
    hydrateCardsInteractivity(grid);
    renderedCount = initialSlice.length;

    if (sentinel) {
        if (renderedCount < currentFeedItems.length) {
            sentinel.textContent = `معروض ${renderedCount} من ${currentFeedItems.length} — اسحب للأسفل للمزيد`;
        } else if (!isFullSelectionMode()) {
            sentinel.textContent = "اكتملت التوصيات — تصفح المزيد بالأسفل";
            renderContinuationAfterRecommendations();
        } else {
            sentinel.textContent = `تم عرض جميع المنتجات (${currentFeedItems.length})`;
            clearContinuationAfterRecommendations();
        }
    } else if (!isFullSelectionMode() && renderedCount >= currentFeedItems.length) {
        renderContinuationAfterRecommendations();
    }

    renderSideCategoriesList();
}

function filterByCategory(category, tabElement, shouldScroll = false) {
    currentCategory = category;
    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => el.classList.remove("active"));
    if (tabElement) tabElement.classList.add("active");
    else {
        const matchedTab = document.querySelector(`.quick-top-tabs .quick-tab-item[data-quick="${category}"]`);
        if (matchedTab) matchedTab.classList.add("active");
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
    onlyFavoritesMode = false;
    currentFeedMode = "for-you";
    interestData.sessionRoll = Math.random();

    const searchInput = document.getElementById("homeSearchInput");
    if (searchInput) searchInput.value = "";
    updateSearchCancelButton();
    toggleHeaderSearchBar(false);

    const sortSelect = document.getElementById("productsSortSelect");
    if (sortSelect) sortSelect.value = "smart";

    document.querySelectorAll(".quick-top-tabs .quick-tab-item").forEach(el => {
        el.classList.toggle("active", el.getAttribute("data-quick") === "all");
    });
    document.querySelectorAll("#feedFilterPills .feed-pill-btn").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-mode") === "for-you");
    });

    updateWishlistUI();
    renderMerchantsQuickStrip();
    renderSpotlightBoxes();
    renderProducts("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToProductsTop() {
    const heading = document.getElementById("productsSectionHeading");
    if (!heading) return;
    const headerHeight = document.querySelector(".top-app-bar")?.getBoundingClientRect().height || 50;
    const quickTabsHeight = document.querySelector(".quick-top-tabs")?.getBoundingClientRect().height || 42;
    const topPos = heading.getBoundingClientRect().top + window.scrollY - (headerHeight + quickTabsHeight + 10);
    window.scrollTo({ top: Math.max(0, topPos), behavior: "smooth" });
}

function getCartTotals() {
    let distinctCount = cart.length;
    let totalPieces = 0;
    let totalAmount = 0;
    cart.forEach(item => {
        const qty = Number(item.qty) || 1;
        totalPieces += qty;
        totalAmount += (Number(item.price) || 0) * qty;
    });
    return { distinctCount, totalPieces, totalAmount };
}

function getOrderTotalAmount(order) {
    if (!order || !Array.isArray(order.items)) return 0;
    return order.items.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)), 0);
}

function getOrderTotalPieces(order) {
    if (!order || !Array.isArray(order.items)) return 0;
    return order.items.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
}

function generateOrderNumber() {
    const usedNumbers = new Set();
    [...activeOrders, ...receivedOrders].forEach(o => {
        const match = String(o.orderId || "").match(/CRM-(\d+)/i);
        if (match) usedNumbers.add(parseInt(match[1], 10));
    });
    let num = 101;
    while (usedNumbers.has(num)) num++;
    return `CRM-${num}`;
}

function setOrderAccordionExpanded(orderId, expanded) {
    if (!orderId) return;
    if (expanded) expandedOrderIds.add(orderId);
    else expandedOrderIds.delete(orderId);
    const card = document.querySelector(`.order-accordion-card[data-order-id="${CSS.escape(orderId)}"]`);
    if (card) {
        card.classList.toggle("is-expanded", expanded);
        const trigger = card.querySelector(".order-number-trigger");
        if (trigger) trigger.setAttribute("aria-expanded", String(expanded));
    }
}

function toggleOrderAccordion(orderId) {
    if (!orderId) return;
    setOrderAccordionExpanded(orderId, !expandedOrderIds.has(orderId));
}

function renderActiveOrdersSection() {
    const container = document.getElementById("activeOrdersContainer");
    const badge = document.getElementById("activeOrdersCountBadge");
    const chip = document.getElementById("pendingOrdersPageChip");
    if (!container) return;

    if (badge) badge.textContent = String(activeOrders.length);
    if (chip) chip.textContent = `${activeOrders.length} طلب`;

    if (!activeOrders.length) {
        container.innerHTML = `<div class="active-orders-empty">لا توجد طلبات قيد التنفيذ حالياً.</div>`;
        return;
    }

    container.innerHTML = activeOrders.map(order => {
        const totalAmt = getOrderTotalAmount(order);
        const totalPcs = getOrderTotalPieces(order);
        const isAppendingHere = appendTargetOrderId === order.orderId;
        const isExpanded = expandedOrderIds.has(order.orderId);
        const stage = order.stage || (order.sentAt ? "confirmed" : "sent");
        const isConfirmedStage = stage === "confirmed";

        const itemsHtml = (order.items || []).map(item => {
            const optionTag = resolveCartOptionShortTag(PRODUCTS.find(p => p.id === item.id));
            const optsText = [
                item.selectedSize ? `${optionTag}: ${item.selectedSize}` : "",
                item.selectedColor ? `لون: ${item.selectedColor}` : ""
            ].filter(Boolean).join(" | ");
            const safeItemImg = normalizeProductImageUrl(item.img);
            const safeQty = Math.max(1, Number(item.qty) || 1);
            return `
                <div class="active-order-item-row">
                    ${safeItemImg ? `<img src="${escapeHtmlAttr(safeItemImg)}" alt="${escapeHtmlAttr(item.title)}" onerror="handleProductImageError(this, '${escapeHtmlAttr(item.id)}')">` : ""}
                    <div class="active-order-item-meta">
                        <div class="cart-item-title">${escapeHtml(item.title)}</div>
                        ${optsText ? `<div class="cart-item-sub">${escapeHtml(optsText)}</div>` : ""}
                        ${item.note ? `<div class="cart-item-note">ملاحظة: ${escapeHtml(item.note)}</div>` : ""}
                        <div class="cart-item-sub">الكمية: ${safeQty} × ${escapeHtml(formatPriceNumber(item.price))} جنيه</div>
                    </div>
                    <div class="cart-item-price">${formatPriceNumber((Number(item.price) || 0) * (Number(item.qty) || 1))} جنيه</div>
                </div>
            `;
        }).join("");

        return `
            <div class="order-accordion-card ${isAppendingHere ? "appending-target" : ""} ${isExpanded ? "is-expanded" : ""}" data-order-id="${escapeHtmlAttr(order.orderId)}">
                <button type="button" class="order-number-trigger" aria-expanded="${isExpanded}" onclick="toggleOrderAccordion('${escapeHtmlAttr(order.orderId)}')">
                    <div>
                        <div class="order-id-row">
                            <span class="order-id-badge-label">رقم الأوردر</span>
                            <span class="order-id-code">${escapeHtmlAttr(order.orderId)}</span>
                            <span class="order-id-hint">${isExpanded ? "إخفاء التفاصيل" : "اضغط لعرض التفاصيل"}</span>
                        </div>
                        <div class="order-trigger-sub">${totalPcs} قطعة • ${escapeHtmlAttr(order.createdAtText || "")}</div>
                    </div>
                    <div class="order-trigger-right">
                        <span class="active-order-status-pill">${isAppendingHere ? "جاري الإضافة" : "قيد التنفيذ"}</span>
                        <span class="order-chevron-icon" aria-hidden="true">⌄</span>
                    </div>
                </button>
                <div class="order-accordion-panel">
                    <div class="order-stage-stepper">
                        <span class="order-stage-step done"><span class="order-stage-dot"></span>تم الإرسال</span>
                        <span class="order-stage-step ${isConfirmedStage ? "done" : ""}"><span class="order-stage-dot"></span>قيد التجهيز</span>
                        <span class="order-stage-step"><span class="order-stage-dot"></span>تم الاستلام</span>
                    </div>
                    <div class="active-order-head">
                        <span class="active-order-date">تفاصيل الأوردر ${escapeHtmlAttr(order.orderId)}</span>
                        <button type="button" class="order-copy-id-btn" onclick="copyOrderIdToClipboard('${escapeHtmlAttr(order.orderId)}')">نسخ الرقم</button>
                    </div>
                    <div class="active-order-items">${itemsHtml}</div>
                    <div class="active-order-total-line">
                        <span>إجمالي الأوردر (${totalPcs} قطعة):</span>
                        <strong>${formatPriceNumber(totalAmt)} جنيه</strong>
                    </div>
                    <div class="active-order-actions">
                        <button type="button" class="order-add-more-btn" onclick="startAppendToOrder('${escapeHtmlAttr(order.orderId)}')">${isAppendingHere ? "جاري الإضافة..." : "+ إضافة منتجات"}</button>
                        <button type="button" class="order-send-update-btn" onclick="sendOrderUpdateOnWhatsApp('${escapeHtmlAttr(order.orderId)}')">إرسال / تحديث واتساب</button>
                        <button type="button" class="order-received-btn" onclick="markOrderAsReceived('${escapeHtmlAttr(order.orderId)}')">تم الاستلام</button>
                        <button type="button" class="order-cancel-btn" onclick="cancelActiveOrder('${escapeHtmlAttr(order.orderId)}')">إلغاء الأوردر</button>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

function renderReceivedOrdersSection() {
    const container = document.getElementById("receivedOrdersContainer");
    const badge = document.getElementById("receivedOrdersCountBadge");
    const chip = document.getElementById("receivedOrdersPageChip");
    if (!container) return;

    if (badge) badge.textContent = String(receivedOrders.length);
    if (chip) chip.textContent = `${receivedOrders.length} طلب`;

    if (!receivedOrders.length) {
        container.innerHTML = `<div class="received-orders-empty">لا توجد أوردرات مستلمة بعد.</div>`;
        return;
    }

    const ordersHtml = receivedOrders.map(order => {
        const totalAmt = getOrderTotalAmount(order);
        const totalPcs = getOrderTotalPieces(order);
        const isExpanded = expandedOrderIds.has(order.orderId);
        const itemsHtml = (order.items || []).map(item => {
            const optionTag = resolveCartOptionShortTag(PRODUCTS.find(p => p.id === item.id));
            const optsText = [
                item.selectedSize ? `${optionTag}: ${item.selectedSize}` : "",
                item.selectedColor ? `لون: ${item.selectedColor}` : ""
            ].filter(Boolean).join(" | ");
            const safeQty = Math.max(1, Number(item.qty) || 1);
            return `
                <div class="received-order-item-row">
                    <div>
                        <div class="received-order-item-title">${escapeHtml(item.title)}</div>
                        ${optsText ? `<div class="received-order-item-sub">${escapeHtml(optsText)}</div>` : ""}
                        <div class="received-order-item-sub">الكمية: ${safeQty} × ${escapeHtml(formatPriceNumber(item.price))} جنيه</div>
                    </div>
                    <button type="button" class="received-reorder-btn" onclick="reorderItemToCart('${escapeHtmlAttr(order.orderId)}', '${escapeHtmlAttr(item.cartKey || "")}')">+ إعادة طلب</button>
                </div>
            `;
        }).join("");

        return `
            <div class="order-accordion-card ${isExpanded ? "is-expanded" : ""}" data-order-id="${escapeHtmlAttr(order.orderId)}">
                <button type="button" class="order-number-trigger" aria-expanded="${isExpanded}" onclick="toggleOrderAccordion('${escapeHtmlAttr(order.orderId)}')">
                    <div>
                        <div class="order-id-row">
                            <span class="order-id-badge-label">رقم الأوردر</span>
                            <span class="order-id-code">${escapeHtmlAttr(order.orderId)}</span>
                            <span class="order-id-hint">${isExpanded ? "إخفاء التفاصيل" : "اضغط لعرض التفاصيل"}</span>
                        </div>
                        <div class="order-trigger-sub">${totalPcs} قطعة • استُلم ${escapeHtmlAttr(order.receivedAtText || order.createdAtText || "")}</div>
                    </div>
                    <div class="order-trigger-right">
                        <span class="received-order-status-pill">تم الاستلام</span>
                        <span class="order-chevron-icon" aria-hidden="true">⌄</span>
                    </div>
                </button>
                <div class="order-accordion-panel">
                    <div class="order-stage-stepper">
                        <span class="order-stage-step done"><span class="order-stage-dot"></span>تم الإرسال</span>
                        <span class="order-stage-step done"><span class="order-stage-dot"></span>قيد التجهيز</span>
                        <span class="order-stage-step done"><span class="order-stage-dot"></span>تم الاستلام</span>
                    </div>
                    <div class="active-order-head">
                        <span class="active-order-date">أوردر مستلم ${escapeHtmlAttr(order.orderId)}</span>
                        <button type="button" class="order-copy-id-btn" onclick="copyOrderIdToClipboard('${escapeHtmlAttr(order.orderId)}')">نسخ الرقم</button>
                    </div>
                    <div class="active-order-items">${itemsHtml}</div>
                    <div class="active-order-total-line">
                        <span>إجمالي الأوردر (${totalPcs} قطعة):</span>
                        <strong>${formatPriceNumber(totalAmt)} جنيه</strong>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    container.innerHTML = `${ordersHtml}<button type="button" class="received-clear-btn" onclick="clearReceivedOrdersHistory()">مسح سجل الأوردرات المستلمة</button>`;
}

function copyOrderIdToClipboard(orderId) {
    if (!orderId) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(orderId).then(() => showCaramelToast(`تم نسخ رقم الأوردر ${orderId}`)).catch(() => showCaramelToast(`رقم الأوردر: ${orderId}`));
    } else showCaramelToast(`رقم الأوردر: ${orderId}`);
}

function startAppendToOrder(orderId) {
    const target = activeOrders.find(o => o.orderId === orderId);
    if (!target) return;
    appendTargetOrderId = orderId;
    expandedOrderIds.add(orderId);
    updateAppendModeBanner();
    renderActiveOrdersSection();
    closeCart();
    showCaramelToast(`أنت الآن تضيف منتجات جديدة على الأوردر ${orderId}`);
}

function cancelAppendToOrderMode() {
    appendTargetOrderId = null;
    updateAppendModeBanner();
    renderActiveOrdersSection();
}

function updateAppendModeBanner() {
    const banner = document.getElementById("appendOrderBanner");
    const textEl = document.getElementById("appendOrderBannerText");
    if (!banner || !textEl) return;
    if (!appendTargetOrderId) {
        banner.classList.add("is-hidden");
        return;
    }
    const target = activeOrders.find(o => o.orderId === appendTargetOrderId);
    if (!target) {
        appendTargetOrderId = null;
        banner.classList.add("is-hidden");
        return;
    }
    textEl.innerHTML = `<strong>وضع الإضافة على الأوردر ${escapeHtmlAttr(target.orderId)}:</strong> أي منتج تضيفه الآن يُضاف مباشرة على هذا الأوردر.`;
    banner.classList.remove("is-hidden");
}

function appendProductDirectlyToActiveOrder(product, qty = 1, selectedSize = "", selectedColor = "", note = "", customImg = "") {
    if (!appendTargetOrderId || !product) return false;
    const orderIdx = activeOrders.findIndex(o => o.orderId === appendTargetOrderId);
    if (orderIdx === -1) {
        appendTargetOrderId = null;
        updateAppendModeBanner();
        return false;
    }
    const order = activeOrders[orderIdx];
    const unitPrice = resolveUnitPriceWithVariant(product, selectedSize);
    const chosenImg = normalizeProductImageUrl(customImg || product.img);
    const itemKey = `${product.id}__${selectedSize || ""}__${selectedColor || ""}__${chosenImg}`;
    const existingItem = (order.items || []).find(it => (it.cartKey || it.id) === itemKey && (it.note || "") === (note || ""));
    if (existingItem) existingItem.qty = (Number(existingItem.qty) || 1) + (Number(qty) || 1);
    else {
        order.items = order.items || [];
        order.items.push({
            id: product.id,
            cartKey: itemKey,
            title: product.title,
            price: unitPrice,
            img: chosenImg,
            merchant: product.merchant || "متجر كارامل",
            qty: Number(qty) || 1,
            selectedSize: selectedSize || "",
            selectedColor: selectedColor || "",
            note: note || ""
        });
    }
    order.updatedAtText = new Date().toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
    expandedOrderIds.add(order.orderId);
    saveActiveOrders();
    updateCartUI();
    showCaramelToast(`تمت إضافة "${product.title}" إلى الأوردر ${order.orderId}`);
    return true;
}

function sendOrderUpdateOnWhatsApp(orderId) {
    const order = activeOrders.find(o => o.orderId === orderId);
    if (!order) return;
    order.stage = "confirmed";
    order.sentAt = Date.now();
    saveActiveOrders();
    renderActiveOrdersSection();

    const customerName = (document.getElementById("checkoutCustomerName")?.value || order.customerName || "").trim();
    const customerPhone = (document.getElementById("checkoutCustomerPhone")?.value || order.customerPhone || "").trim();
    const customerAddress = (document.getElementById("checkoutCustomerAddress")?.value || order.customerAddress || "").trim();
    const locUrl = customerLocationCoords ? `https://maps.google.com/?q=${customerLocationCoords.lat},${customerLocationCoords.lng}` : (order.locationUrl || "");
    const lines = (order.items || []).map((item, idx) => {
        const details = [item.selectedSize ? `${resolveCartOptionShortTag(PRODUCTS.find(p => p.id === item.id))}: ${item.selectedSize}` : "", item.selectedColor ? `لون: ${item.selectedColor}` : "", item.note ? `ملاحظة: ${item.note}` : ""].filter(Boolean).join(" | ");
        const imgPart = item.img ? ` | صورة: ${item.img}` : "";
        return `${idx + 1}. ${item.title} (الكمية: ${item.qty} × ${formatPriceNumber(item.price)} جنيه = ${formatPriceNumber((Number(item.price) || 0) * (Number(item.qty) || 1))} جنيه)${details ? ` [${details}]` : ""}${imgPart}`;
    });
    const totalAmt = getOrderTotalAmount(order);
    const totalPcs = getOrderTotalPieces(order);
    let msg = `متابعة / تحديث أوردر رقم *${order.orderId}* من *متجر كارامل*:\n\n`;
    if (customerName) msg += `الاسم: ${customerName}\n`;
    if (customerPhone) msg += `رقم التواصل: ${customerPhone}\n`;
    if (customerAddress) msg += `العنوان: ${customerAddress}\n`;
    if (locUrl) msg += `اللوكيشن: ${locUrl}\n`;
    msg += `\nالمنتجات:\n${lines.join("\n")}\n\nإجمالي القطع: ${totalPcs}\nالإجمالي الكلي: ${formatPriceNumber(totalAmt)} جنيه`;
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`);
}

function markOrderAsReceived(orderId) {
    const idx = activeOrders.findIndex(o => o.orderId === orderId);
    if (idx === -1) return;
    const [order] = activeOrders.splice(idx, 1);
    order.stage = "received";
    order.receivedAtText = new Date().toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
    receivedOrders.unshift(order);
    expandedOrderIds.add(order.orderId);
    if (appendTargetOrderId === orderId) {
        appendTargetOrderId = null;
        updateAppendModeBanner();
    }
    saveActiveOrders();
    saveReceivedOrders();
    updateCartUI();
    switchCartOrdersTab("received");
    showCaramelToast(`تم نقل الأوردر ${orderId} إلى الأوردرات المستلمة`);
}

function cancelActiveOrder(orderId) {
    const idx = activeOrders.findIndex(o => o.orderId === orderId);
    if (idx === -1) return;
    openConfirmModal("إلغاء الأوردر", `هل تريد إلغاء الأوردر ${orderId} وحذفه من الطلبات قيد التنفيذ؟`, () => {
        activeOrders.splice(idx, 1);
        expandedOrderIds.delete(orderId);
        if (appendTargetOrderId === orderId) {
            appendTargetOrderId = null;
            updateAppendModeBanner();
        }
        saveActiveOrders();
        updateCartUI();
        showCaramelToast(`تم إلغاء الأوردر ${orderId}`);
    }, "نعم، إلغاء");
}

function reorderItemToCart(orderId, cartKey) {
    const order = receivedOrders.find(o => o.orderId === orderId);
    if (!order) return;
    const item = (order.items || []).find(it => (it.cartKey || "") === cartKey);
    if (!item) return;
    const prod = PRODUCTS.find(p => p.id === item.id) || { id: item.id, title: item.title, price: item.price, img: item.img, merchant: item.merchant };
    addToCart(prod, null, null, 1, item.selectedSize || "", item.selectedColor || "", item.note || "", item.img || "");
    switchCartOrdersTab("cart");
}

function clearReceivedOrdersHistory() {
    if (!receivedOrders.length) return;
    openConfirmModal("مسح السجل", "هل تريد مسح سجل الأوردرات المستلمة بالكامل؟", () => {
        receivedOrders = [];
        saveReceivedOrders();
        renderReceivedOrdersSection();
        showCaramelToast("تم مسح سجل الأوردرات المستلمة");
    }, "مسح");
}

let customerLocationCoords = null;

function setCustomerLocationStatus(text, isLocated = false, previewText = "") {
    const btn = document.getElementById("cartLocationBtn");
    const btnText = document.getElementById("cartLocationBtnText");
    const clearBtn = document.getElementById("cartLocationClearBtn");
    const preview = document.getElementById("cartLocationPreview");
    if (btnText) btnText.textContent = text;
    if (btn) btn.classList.toggle("located", isLocated);
    if (clearBtn) clearBtn.classList.toggle("visible", isLocated);
    if (preview) {
        if (previewText) {
            preview.textContent = previewText;
            preview.classList.remove("is-hidden");
        } else {
            preview.textContent = "";
            preview.classList.add("is-hidden");
        }
    }
}

function requestCustomerLocation() {
    if (!navigator.geolocation) {
        showCaramelToast("المتصفح لا يدعم تحديد الموقع الجغرافي");
        return;
    }
    setCustomerLocationStatus("جاري تحديد موقعك...", false, "");
    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = Number(pos.coords.latitude.toFixed(6));
            const lng = Number(pos.coords.longitude.toFixed(6));
            customerLocationCoords = { lat, lng };
            const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
            setCustomerLocationStatus("تم تحديد الموقع بنجاح ✓", true, `رابط اللوكيشن: ${mapsLink}`);
            showCaramelToast("تم إرفاق موقعك الجغرافي بنجاح!");
        },
        err => {
            customerLocationCoords = null;
            let msg = "تعذر الوصول للموقع، تأكد من تفعيل GPS والصلاحيات";
            if (err && err.code === 1) msg = "تم رفض صلاحية الوصول للموقع";
            setCustomerLocationStatus("تحديد موقعي الحالي (اللوكيشن)", false, "");
            showCaramelToast(msg);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

function clearCustomerLocation() {
    customerLocationCoords = null;
    setCustomerLocationStatus("تحديد موقعي الحالي (اللوكيشن)", false, "");
    showCaramelToast("تم إلغاء اللوكيشن");
}

function pulseBottomNavButton(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.remove("pop");
    void btn.offsetWidth;
    btn.classList.add("pop");
    setTimeout(() => btn.classList.remove("pop"), 300);
}

let suppressHistoryStep = false;
let pushedHistoryDepth = 0;

function pushOverlayState(name) {
    overlayStack = overlayStack.filter(n => n !== name);
    overlayStack.push(name);
    if (!suppressHistoryStep) {
        try {
            history.pushState({ caramelOverlay: name, ts: Date.now() }, "");
            pushedHistoryDepth += 1;
        } catch (e) {}
    }
}

function removeOverlayState(name) {
    const hadOverlay = overlayStack.includes(name);
    overlayStack = overlayStack.filter(n => n !== name);
    if (hadOverlay && !suppressHistoryStep && pushedHistoryDepth > 0 && history.state && history.state.caramelOverlay === name) {
        pushedHistoryDepth = Math.max(0, pushedHistoryDepth - 1);
        suppressHistoryStep = true;
        try {
            history.back();
        } catch (e) {
            suppressHistoryStep = false;
        }
        setTimeout(() => { suppressHistoryStep = false; }, 60);
    }
}

function isAnyOverlayOpen() {
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
    if (isAnyOverlayOpen()) document.body.classList.add("modal-open");
    else document.body.classList.remove("modal-open");
}

function closeTopOverlay(fromPopState = false) {
    if (!overlayStack.length) { syncBodyScrollLock(); return false; }
    const topName = overlayStack.pop();
    suppressHistoryStep = true;
    try {
        if (topName === "cart") closeCart(true);
        else if (topName === "cats") closeCategoriesDrawer(true);
        else if (topName === "image") closeImageModal(true);
        else if (topName === "option") closeProductOptionModal(true);
        else if (topName === "serviceInfo") closeServiceInfoModal(true);
        else if (topName === "becomeMerchant") closeBecomeMerchantModal(true);
        else if (topName === "confirm") closeConfirmModal(true, true);
    } finally {
        setTimeout(() => { suppressHistoryStep = false; }, 0);
    }
    syncBodyScrollLock();
    return true;
}

function closeAllOverlays() {
    while (overlayStack.length > 0) closeTopOverlay(false);
    closeCart(true);
    closeCategoriesDrawer(true);
    closeImageModal(true);
    closeProductOptionModal(true);
    closeServiceInfoModal(true);
    closeBecomeMerchantModal(true);
    closeConfirmModal(true, true);
    overlayStack = [];
    syncBodyScrollLock();
}

function openCart() {
    closeCategoriesDrawer(true);
    loadCustomerProfileToInputs();
    updateCartUI();
    switchCartOrdersTab(activeCartOrdersTab);
    document.getElementById("cartDrawer")?.classList.add("open");
    document.getElementById("cartBackdrop")?.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("cart");
}

function closeCart(fromPopState = false) {
    document.getElementById("cartDrawer")?.classList.remove("open");
    if (!document.getElementById("catsDrawer")?.classList.contains("open")) {
        document.getElementById("cartBackdrop")?.classList.remove("open");
    }
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("cart");
}

function openCategoriesDrawer() {
    closeCart(true);
    renderSideCategoriesList();
    document.getElementById("catsDrawer")?.classList.add("open");
    document.getElementById("catsBackdrop")?.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("cats");
}

function closeCategoriesDrawer(fromPopState = false) {
    document.getElementById("catsDrawer")?.classList.remove("open");
    if (!document.getElementById("cartDrawer")?.classList.contains("open")) {
        document.getElementById("catsBackdrop")?.classList.remove("open");
    }
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("cats");
}

function openCurrentCardPreview(imgBoxEl, productId) {
    const card = imgBoxEl ? imgBoxEl.closest(".product-card") : null;
    const product = PRODUCTS.find(p => p.id === productId);
    const activeSrc = getActiveCardImageSrc(card, product);
    openImageModal(activeSrc, productId);
}

function syncPreviewGalleryUI() {
    const modalImg = document.getElementById("modalImagePreview");
    const prevBtn = document.getElementById("previewPrevBtn");
    const nextBtn = document.getElementById("previewNextBtn");
    const thumbsRow = document.getElementById("previewThumbsRow");
    const imgs = previewModalState.imgs || [];
    const idx = previewModalState.idx || 0;
    const currentSrc = imgs[idx] || "";

    const previewProduct = PRODUCTS.find(p => p.id === previewModalState.productId);
    const isMainSoldOut = isProductImageSoldOut(previewProduct, currentSrc);

    if (modalImg && currentSrc) {
        modalImg.style.opacity = "1";
        modalImg.removeAttribute("data-broken");
        modalImg.setAttribute("data-retry-step", "0");
        modalImg.src = currentSrc;
        syncSoldOutOverlayOnElement(modalImg, isMainSoldOut);
    }

    const hasMany = imgs.length > 1;
    if (prevBtn) prevBtn.classList.toggle("is-hidden", !hasMany);
    if (nextBtn) nextBtn.classList.toggle("is-hidden", !hasMany);

    if (thumbsRow) {
        if (!hasMany) {
            thumbsRow.innerHTML = "";
            thumbsRow.classList.add("is-hidden");
        } else {
            thumbsRow.classList.remove("is-hidden");
            thumbsRow.innerHTML = imgs.map((u, i) => {
                const thumbSoldOut = isProductImageSoldOut(previewProduct, u);
                return `
                <button type="button" class="preview-thumb-btn ${i === idx ? "active" : ""} ${thumbSoldOut ? "is-soldout" : ""}" onclick="selectPreviewThumb(${i}, event)" aria-label="صورة ${i + 1}">
                    <span class="media-soldout-wrap ${thumbSoldOut ? "is-soldout" : ""}">
                        <img src="${escapeHtmlAttr(u)}" alt="" onerror="handleProductImageError(this, '${escapeHtmlAttr(previewModalState.productId || "")}')">
                        ${thumbSoldOut ? `<span class="soldout-badge-overlay">نفدت الكمية</span>` : ""}
                    </span>
                </button>
            `;
            }).join("");
        }
    }

    const product = PRODUCTS.find(p => p.id === previewModalState.productId);
    const waBtn = document.getElementById("previewWhatsAppBtn");
    if (product && waBtn) {
        waBtn.href = buildProductWhatsAppUrl(product, currentSrc);
    }
}

function stepPreviewImage(delta, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const imgs = previewModalState.imgs || [];
    if (imgs.length <= 1) return;
    previewModalState.idx = ((previewModalState.idx + delta) % imgs.length + imgs.length) % imgs.length;
    syncPreviewGalleryUI();
}

function selectPreviewThumb(idx, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const imgs = previewModalState.imgs || [];
    if (!imgs.length) return;
    previewModalState.idx = Math.max(0, Math.min(imgs.length - 1, Number(idx) || 0));
    syncPreviewGalleryUI();
}

function openImageModal(src, productId = "") {
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImagePreview");
    const titleEl = document.getElementById("previewProductTitle");
    const mainPriceEl = document.getElementById("previewMainPrice");
    const subPriceEl = document.getElementById("previewSubPrice");
    const storyEl = document.getElementById("previewStoryText");
    const hookEl = document.getElementById("previewHookNote");
    const catChipEl = document.getElementById("previewCategoryChip");
    const merchantChipEl = document.getElementById("previewMerchantChip");
    const copyLinkBtn = document.getElementById("previewCopyLinkBtn");
    const addBtn = document.getElementById("previewAddToCartBtn");
    const waBtn = document.getElementById("previewWhatsAppBtn");
    const relatedSection = document.getElementById("previewRelatedSection");
    const relatedList = document.getElementById("previewRelatedList");
    if (!modal || !modalImg) return;

    const product = PRODUCTS.find(p => p.id === productId);
    const imgs = product ? getProductImagesList(product) : [normalizeProductImageUrl(src)].filter(Boolean);
    const normalizedClickedSrc = normalizeProductImageUrl(src);
    let initialIdx = 0;
    if (normalizedClickedSrc && imgs.length) {
        const foundIdx = imgs.indexOf(normalizedClickedSrc);
        if (foundIdx >= 0) initialIdx = foundIdx;
    }

    previewModalState = { productId: product ? product.id : (productId || ""), imgs, idx: initialIdx };

    modalImg.setAttribute("data-product-id", productId || "");
    modalImg.setAttribute("data-retry-step", "0");
    modalImg.style.opacity = "1";
    modalImg.removeAttribute("data-broken");
    modalImg.src = imgs[initialIdx] || normalizeProductImageUrl(src) || "";
    syncPreviewGalleryUI();

    if (product) {
        trackProductInterest(product, 1.5, true);
        if (titleEl) titleEl.textContent = product.title;
        if (mainPriceEl) mainPriceEl.innerHTML = `${formatPriceNumber(product.priceLabel || product.price)} <span>جنيه</span>`;
        if (subPriceEl) {
            if (product.subPrice) { subPriceEl.textContent = product.subPrice; subPriceEl.classList.remove("is-hidden"); }
            else subPriceEl.classList.add("is-hidden");
        }
        if (storyEl) storyEl.textContent = product.desc || "منتج مختار بعناية من متجر كارامل بجودة عملية وسعر مناسب.";
        if (hookEl) hookEl.textContent = buildEngagingHookForProduct(product);
        if (catChipEl) catChipEl.textContent = CATEGORY_NAMES[product.category] || "متجر كارامل";
        if (merchantChipEl) {
            const mName = product.merchant || "متجر كارامل";
            merchantChipEl.textContent = `التاجر: ${mName}`;
            merchantChipEl.classList.remove("is-hidden");
            merchantChipEl.onclick = () => {
                closeImageModal();
                filterByMerchant(mName, true);
            };
        }
        if (copyLinkBtn) {
            copyLinkBtn.onclick = ev => copyProductShareLink(product.id, ev);
        }
        if (addBtn) {
            addBtn.onclick = () => {
                const chosenPreviewImg = previewModalState.imgs[previewModalState.idx] || product.img || "";
                closeImageModal();
                handleAddOrSelectOptions(product.id, `btn-${product.id}`, null, chosenPreviewImg);
            };
        }
        if (waBtn) {
            const activePreviewImg = previewModalState.imgs[previewModalState.idx] || product.img || "";
            waBtn.href = buildProductWhatsAppUrl(product, activePreviewImg);
        }

        if (relatedSection && relatedList) {
            const sameMerchantOrCat = PRODUCTS.filter(p => p.id !== product.id && (p.merchant === product.merchant || p.category === product.category)).slice(0, 4);
            if (sameMerchantOrCat.length) {
                relatedList.innerHTML = sameMerchantOrCat.map(rp => `
                    <button type="button" class="preview-related-chip" onclick="openImageModal('${escapeHtmlAttr(rp.img)}', '${escapeHtmlAttr(rp.id)}')">
                        <img src="${escapeHtmlAttr(rp.img)}" alt="${escapeHtmlAttr(rp.title)}" onerror="handleProductImageError(this, '${escapeHtmlAttr(rp.id)}')">
                        <span class="preview-related-meta">
                            <span class="preview-related-title">${escapeHtmlAttr(rp.title)}</span>
                            <span class="preview-related-price">${formatPriceNumber(rp.priceLabel || rp.price)} جنيه</span>
                        </span>
                    </button>
                `).join("");
                relatedSection.classList.remove("is-hidden");
            } else relatedSection.classList.add("is-hidden");
        }
    } else {
        if (titleEl) titleEl.textContent = "معاينة المنتج";
        if (mainPriceEl) mainPriceEl.textContent = "";
        if (subPriceEl) subPriceEl.classList.add("is-hidden");
        if (storyEl) storyEl.textContent = "صورة مكبرة للمنتج من متجر كارامل.";
        if (hookEl) hookEl.textContent = "";
        if (catChipEl) catChipEl.textContent = "متجر كارامل";
        if (merchantChipEl) merchantChipEl.classList.add("is-hidden");
        if (relatedSection) relatedSection.classList.add("is-hidden");
        if (addBtn) addBtn.onclick = () => closeImageModal();
        if (waBtn) waBtn.href = `https://wa.me/${WHATSAPP_NUMBER}`;
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

function resolveSizeOptionLabel(sizeEntry) {
    if (!sizeEntry) return "";
    if (typeof sizeEntry === "string") return sizeEntry;
    return sizeEntry.label || sizeEntry.name || sizeEntry.value || "";
}

function resolveSizeOptionPrice(sizeEntry, fallbackPrice = 0) {
    if (sizeEntry && typeof sizeEntry === "object") {
        const parsed = parseNumericPrice(sizeEntry.price ?? sizeEntry.cost ?? sizeEntry.amount);
        if (parsed > 0) return parsed;
    }
    return Number(fallbackPrice) || 0;
}

function resolveUnitPriceWithVariant(product, selectedSize) {
    const basePrice = Number(product?.price) || 0;
    if (!product || !selectedSize) return basePrice;
    const cfg = getProductVariantConfig(product);
    if (!cfg || !Array.isArray(cfg.sizes) || !cfg.sizes.length) return basePrice;
    const matched = cfg.sizes.find(s => resolveSizeOptionLabel(s) === selectedSize);
    if (!matched) return basePrice;
    const variantPrice = resolveSizeOptionPrice(matched, basePrice);
    return variantPrice > 0 ? variantPrice : basePrice;
}

function syncOptionModalPriceDisplay(product) {
    const priceEl = document.getElementById("optionModalPrice");
    if (!priceEl || !product) return;
    const unitPrice = resolveUnitPriceWithVariant(product, pendingOptionSelection.selectedSize);
    pendingOptionSelection.currentPrice = unitPrice;
    const totalLine = unitPrice * (pendingOptionSelection.qty || 1);
    priceEl.innerHTML = `${formatPriceNumber(unitPrice)} <span>جنيه</span>${(pendingOptionSelection.qty || 1) > 1 ? ` <small>(الإجمالي: ${formatPriceNumber(totalLine)} جنيه)</small>` : ""}`;
}

function syncOptionModalGallery(product) {
    const imgs = getProductImagesList(product);
    const imgEl = document.getElementById("optionModalImg");
    const thumbsRow = document.getElementById("optionModalThumbsRow");
    const currentSrc = normalizeProductImageUrl(pendingOptionSelection.selectedImg) || imgs[0] || "";
    const isCurrentSoldOut = isProductImageSoldOut(product, currentSrc);

    if (imgEl && currentSrc) {
        imgEl.style.opacity = "1";
        imgEl.removeAttribute("data-broken");
        imgEl.src = currentSrc;
        syncSoldOutOverlayOnElement(imgEl, isCurrentSoldOut);
    }

    if (thumbsRow) {
        if (imgs.length <= 1) {
            thumbsRow.innerHTML = "";
            thumbsRow.classList.add("is-hidden");
        } else {
            thumbsRow.classList.remove("is-hidden");
            thumbsRow.innerHTML = imgs.map((u, idx) => {
                const thumbSoldOut = isProductImageSoldOut(product, u);
                return `
                <button type="button" class="preview-thumb-btn ${u === currentSrc ? "active" : ""} ${thumbSoldOut ? "is-soldout" : ""}" onclick="selectOptionModalThumb(${idx})" aria-label="صورة ${idx + 1}">
                    <span class="media-soldout-wrap ${thumbSoldOut ? "is-soldout" : ""}">
                        <img src="${escapeHtmlAttr(u)}" alt="" onerror="handleProductImageError(this, '${escapeHtmlAttr(product.id)}')">
                        ${thumbSoldOut ? `<span class="soldout-badge-overlay">نفدت الكمية</span>` : ""}
                    </span>
                </button>
            `;
            }).join("");
        }
    }
}

function selectOptionModalThumb(idx) {
    const product = PRODUCTS.find(p => p.id === pendingOptionSelection.productId);
    if (!product) return;
    const imgs = getProductImagesList(product);
    if (!imgs.length) return;
    const safeIdx = Math.max(0, Math.min(imgs.length - 1, Number(idx) || 0));
    pendingOptionSelection.selectedImg = imgs[safeIdx];
    syncOptionModalGallery(product);
}

function handleAddOrSelectOptions(productId, clickedBtnId, sourceBtnEl = null, preferredImg = "") {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;
    trackProductInterest(product, 2.5, true);

    const cardEl = sourceBtnEl ? sourceBtnEl.closest(".product-card") : document.getElementById(`prod-${productId}`);
    const activeCardImg = preferredImg || getActiveCardImageSrc(cardEl, product);

    const variantCfg = getProductVariantConfig(product);
    if (!variantCfg) {
        addToCart(product, clickedBtnId, sourceBtnEl, 1, "", "", "", activeCardImg);
        return;
    }

    const modal = document.getElementById("productOptionModal");
    const imgEl = document.getElementById("optionModalImg");
    const titleEl = document.getElementById("optionModalTitle");
    const sizeGroup = document.getElementById("optionModalSizeGroup");
    const sizePills = document.getElementById("optionModalSizePills");
    const colorGroup = document.getElementById("optionModalColorGroup");
    const colorPills = document.getElementById("optionModalColorPills");
    const qtyVal = document.getElementById("optionModalQtyVal");
    const noteInput = document.getElementById("optionModalNoteInput");
    if (!modal || !titleEl) {
        addToCart(product, clickedBtnId, sourceBtnEl, 1, "", "", "", activeCardImg);
        return;
    }

    const defaultSize = (variantCfg.sizes && variantCfg.sizes.length) ? resolveSizeOptionLabel(variantCfg.sizes[0]) : "";
    const defaultColor = (variantCfg.colors && variantCfg.colors.length) ? variantCfg.colors[0] : "";
    pendingOptionSelection = {
        productId: product.id,
        clickedBtnId,
        selectedSize: defaultSize,
        selectedColor: defaultColor,
        selectedImg: activeCardImg || product.img || "",
        currentPrice: resolveUnitPriceWithVariant(product, defaultSize),
        qty: 1
    };

    syncOptionModalGallery(product);
    if (imgEl && !pendingOptionSelection.selectedImg) imgEl.classList.add("img-hidden");
    else if (imgEl) imgEl.classList.remove("img-hidden");
    titleEl.textContent = product.title;
    syncOptionModalPriceDisplay(product);
    if (qtyVal) qtyVal.textContent = "1";
    if (noteInput) noteInput.value = "";

    const sizeLabelEl = document.getElementById("optionModalSizeLabel");
    if (variantCfg.sizes && variantCfg.sizes.length) {
        if (sizeLabelEl) sizeLabelEl.textContent = variantCfg.sizeHeading || resolveProductOptionHeading(product);
        sizeGroup.classList.remove("is-hidden");
        sizePills.innerHTML = variantCfg.sizes.map((sz, idx) => {
            const label = resolveSizeOptionLabel(sz);
            return `<button type="button" class="option-pill-btn ${idx === 0 ? "selected" : ""}" onclick="selectOptionPill('size', '${escapeHtmlAttr(label)}', this)">${escapeHtmlAttr(label)}</button>`;
        }).join("");
    } else sizeGroup.classList.add("is-hidden");

    const colorLabelEl = document.getElementById("optionModalColorLabel");
    if (variantCfg.colors && variantCfg.colors.length) {
        if (colorLabelEl) colorLabelEl.textContent = variantCfg.colorHeading || resolveProductColorHeading(product);
        colorGroup.classList.remove("is-hidden");
        colorPills.innerHTML = variantCfg.colors.map((col, idx) => `<button type="button" class="option-pill-btn ${idx === 0 ? "selected" : ""}" onclick="selectOptionPill('color', '${escapeHtmlAttr(col)}', this)">${escapeHtmlAttr(col)}</button>`).join("");
    } else colorGroup.classList.add("is-hidden");

    modal.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("option");
}

function selectOptionPill(kind, value, btnEl) {
    const parent = btnEl?.parentElement;
    if (parent) parent.querySelectorAll(".option-pill-btn").forEach(b => b.classList.remove("selected"));
    if (btnEl) btnEl.classList.add("selected");
    if (kind === "size") {
        pendingOptionSelection.selectedSize = value;
        const product = PRODUCTS.find(p => p.id === pendingOptionSelection.productId);
        if (product) syncOptionModalPriceDisplay(product);
    } else if (kind === "color") {
        pendingOptionSelection.selectedColor = value;
    }
}

function changeModalQty(delta) {
    const nextQty = Math.max(1, (pendingOptionSelection.qty || 1) + delta);
    pendingOptionSelection.qty = nextQty;
    const qtyVal = document.getElementById("optionModalQtyVal");
    if (qtyVal) qtyVal.textContent = String(nextQty);
    const product = PRODUCTS.find(p => p.id === pendingOptionSelection.productId);
    if (product) syncOptionModalPriceDisplay(product);
}

function confirmAddProductWithOptions() {
    const product = PRODUCTS.find(p => p.id === pendingOptionSelection.productId);
    if (!product) { closeProductOptionModal(); return; }
    const noteVal = document.getElementById("optionModalNoteInput")?.value.trim() || "";
    const { clickedBtnId, selectedSize, selectedColor, selectedImg, qty } = pendingOptionSelection;
    closeProductOptionModal();
    addToCart(product, clickedBtnId, null, qty, selectedSize, selectedColor, noteVal, selectedImg);
}

function closeProductOptionModal(fromPopState = false) {
    const modal = document.getElementById("productOptionModal");
    if (modal) modal.classList.remove("open");
    syncBodyScrollLock();
    if (!fromPopState) removeOverlayState("option");
}

function addToCart(product, clickedBtnId = null, sourceBtnEl = null, qtyToAdd = 1, selectedSize = "", selectedColor = "", note = "", customImg = "") {
    if (!product) return;
    trackProductInterest(product, 3, true);
    const addQty = Math.max(1, Number(qtyToAdd) || 1);
    const chosenImg = normalizeProductImageUrl(customImg || product.img);

    if (appendTargetOrderId) {
        const appended = appendProductDirectlyToActiveOrder(product, addQty, selectedSize, selectedColor, note, chosenImg);
        if (appended) {
            const btn = sourceBtnEl || (clickedBtnId ? document.getElementById(clickedBtnId) : null);
            if (btn) {
                const origText = btn.textContent;
                btn.textContent = "✓ أُضيف للأوردر";
                btn.classList.add("added");
                setTimeout(() => { btn.textContent = origText; btn.classList.remove("added"); }, 1100);
            }
            return;
        }
    }

    const unitPrice = resolveUnitPriceWithVariant(product, selectedSize);
    const itemKey = `${product.id}__${selectedSize || ""}__${selectedColor || ""}__${chosenImg}`;
    const existingItem = cart.find(item => (item.cartKey || item.id) === itemKey && (item.note || "") === (note || ""));
    if (existingItem) {
        existingItem.qty = (Number(existingItem.qty) || 1) + addQty;
        if (unitPrice > 0) existingItem.price = unitPrice;
        if (chosenImg) existingItem.img = chosenImg;
    } else {
        cart.push({
            id: product.id,
            cartKey: itemKey,
            title: product.title,
            price: unitPrice,
            img: chosenImg,
            merchant: product.merchant || "متجر كارامل",
            qty: addQty,
            selectedSize: selectedSize || "",
            selectedColor: selectedColor || "",
            note: note || ""
        });
    }

    saveCart();
    updateCartUI();

    const btn = sourceBtnEl || (clickedBtnId ? document.getElementById(clickedBtnId) : null);
    if (btn) {
        const origText = btn.textContent;
        btn.textContent = "✓ تمت الإضافة";
        btn.classList.add("added");
        setTimeout(() => { btn.textContent = origText; btn.classList.remove("added"); }, 1100);
    }
    showCaramelToast(`تمت إضافة "${product.title}" إلى السلة`);
}

function updateCartUI() {
    const cartItemsContainer = document.getElementById("cartItemsContainer");
    const cartTotalAmount = document.getElementById("cartTotalAmount");
    const bottomCartCount = document.getElementById("bottomCartCount");
    const distinctCountEl = document.getElementById("cartDistinctCount");
    const totalPiecesEl = document.getElementById("cartTotalPieces");
    const currentCartBadge = document.getElementById("currentCartCountBadge");
    const currentCartChip = document.getElementById("currentCartPageChip");

    const { distinctCount, totalPieces, totalAmount } = getCartTotals();

    if (bottomCartCount) {
        bottomCartCount.textContent = String(totalPieces);
        bottomCartCount.classList.toggle("visible", totalPieces > 0);
    }
    if (currentCartBadge) currentCartBadge.textContent = String(totalPieces);
    if (currentCartChip) currentCartChip.textContent = `${totalPieces} قطعة`;
    if (distinctCountEl) distinctCountEl.textContent = String(distinctCount);
    if (totalPiecesEl) totalPiecesEl.textContent = String(totalPieces);
    if (cartTotalAmount) cartTotalAmount.textContent = `${formatPriceNumber(totalAmount)} جنيه`;

    if (cartItemsContainer) {
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = `<div class="cart-empty">سلتك فارغة حالياً — أضف منتجات لبدء طلبك.</div>`;
        } else {
            cartItemsContainer.innerHTML = cart.map((item, index) => {
                const product = PRODUCTS.find(p => p.id === item.id);
                const variantCfg = getProductVariantConfig(product);
                const itemTotal = (Number(item.price) || 0) * (Number(item.qty) || 1);
                const safeImg = normalizeProductImageUrl(item.img);

                let sizeSelectHtml = "";
                if (variantCfg?.sizes?.length) {
                    const shortTag = variantCfg.shortTag || resolveCartOptionShortTag(product);
                    const opts = variantCfg.sizes.map(sz => {
                        const lbl = resolveSizeOptionLabel(sz);
                        return `<option value="${escapeHtmlAttr(lbl)}" ${item.selectedSize === lbl ? "selected" : ""}>${escapeHtmlAttr(lbl)}</option>`;
                    }).join("");
                    sizeSelectHtml = `<select class="cart-option-select" onchange="updateCartItemOption(${index}, 'size', this.value)" aria-label="${escapeHtmlAttr(shortTag)}"><option value="">${escapeHtmlAttr(shortTag)}</option>${opts}</select>`;
                }

                let colorSelectHtml = "";
                if (variantCfg?.colors?.length) {
                    const opts = variantCfg.colors.map(col => `<option value="${escapeHtmlAttr(col)}" ${item.selectedColor === col ? "selected" : ""}>${escapeHtmlAttr(col)}</option>`).join("");
                    colorSelectHtml = `<select class="cart-option-select" onchange="updateCartItemOption(${index}, 'color', this.value)" aria-label="اللون"><option value="">اللون</option>${opts}</select>`;
                }

                const optionsRowHtml = (sizeSelectHtml || colorSelectHtml) ? `<div class="cart-item-options">${sizeSelectHtml}${colorSelectHtml}</div>` : "";
                const noteInputHtml = `<input type="text" class="cart-item-note-input" value="${escapeHtmlAttr(item.note || "")}" placeholder="ملاحظة لهذا المنتج (اختياري)..." onchange="updateCartItemOption(${index}, 'note', this.value)">`;

                return `
                    <div class="cart-item">
                        <div class="cart-item-top">
                            ${safeImg ? `<img src="${escapeHtmlAttr(safeImg)}" alt="${escapeHtmlAttr(item.title)}" onerror="handleProductImageError(this, '${escapeHtmlAttr(item.id)}')">` : ""}
                            <div class="cart-item-info">
                                <div class="cart-item-title">${escapeHtmlAttr(item.title)}</div>
                                <div class="cart-item-price">${formatPriceNumber(itemTotal)} جنيه</div>
                                <div class="cart-item-sub">${item.qty} × ${formatPriceNumber(item.price)} جنيه</div>
                            </div>
                            <div class="qty-controls">
                                <button type="button" class="qty-btn" onclick="changeQty(${index}, 1)">+</button>
                                <span class="qty-val">${item.qty}</span>
                                <button type="button" class="qty-btn" onclick="changeQty(${index}, -1)">-</button>
                                <button type="button" class="remove-item-btn" onclick="removeItem(${index})" aria-label="حذف">✕</button>
                            </div>
                        </div>
                        ${optionsRowHtml}
                        ${noteInputHtml}
                    </div>
                `;
            }).join("");
        }
    }

    renderActiveOrdersSection();
    renderReceivedOrdersSection();
    updateAppendModeBanner();
    syncCartTabFooterVisibility();
}

function updateCartItemOption(index, field, value) {
    const item = cart[index];
    if (!item) return;
    if (field === "size") {
        item.selectedSize = value;
        const product = PRODUCTS.find(p => p.id === item.id);
        if (product) {
            item.price = resolveUnitPriceWithVariant(product, value);
        }
    } else if (field === "color") item.selectedColor = value;
    else if (field === "note") item.note = value;
    saveCart();
    updateCartUI();
}

function changeQty(index, delta) {
    if (!cart[index]) return;
    const newQty = (Number(cart[index].qty) || 1) + delta;
    if (newQty <= 0) cart.splice(index, 1);
    else cart[index].qty = newQty;
    saveCart();
    updateCartUI();
}

function removeItem(index) {
    if (!cart[index]) return;
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function clearCart() {
    if (!cart.length) return;
    openConfirmModal("تفريغ السلة", "هل تريد تفريغ جميع المنتجات من السلة الحالية؟", () => {
        cart = [];
        saveCart();
        updateCartUI();
        showCaramelToast("تم تفريغ السلة");
    }, "تفريغ");
}


function copyOrderSummaryText() {
    if (!cart.length) {
        showCaramelToast("السلة فارغة — أضف منتجات أولاً");
        return;
    }
    const name = (document.getElementById("checkoutCustomerName")?.value || "").trim();
    const phone = (document.getElementById("checkoutCustomerPhone")?.value || "").trim();
    const addr = (document.getElementById("checkoutCustomerAddress")?.value || "").trim();
    const { totalPieces, totalAmount } = getCartTotals();
    const lines = cart.map((item, i) => {
        const opts = [item.selectedSize ? `${resolveCartOptionShortTag(PRODUCTS.find(p => p.id === item.id))}: ${item.selectedSize}` : "", item.selectedColor ? `لون: ${item.selectedColor}` : "", item.note ? `ملاحظة: ${item.note}` : ""].filter(Boolean).join(" | ");
        return `${i + 1}. ${item.title} (${item.qty} × ${formatPriceNumber(item.price)} ج)${opts ? ` — ${opts}` : ""}`;
    });
    let summary = `ملخص طلب متجر كارامل:\n${lines.join("\n")}\nعدد القطع: ${totalPieces}\nالإجمالي: ${formatPriceNumber(totalAmount)} جنيه`;
    if (name) summary += `\nالاسم: ${name}`;
    if (phone) summary += `\nالهاتف: ${phone}`;
    if (addr) summary += `\nالعنوان: ${addr}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summary).then(() => showCaramelToast("تم نسخ ملخص الطلب ✓")).catch(() => showCaramelToast("تعذر النسخ التلقائي"));
    } else {
        showCaramelToast("تم تجهيز ملخص الطلب");
    }
}

function checkoutOnWhatsApp() {
    if (!cart.length) { showCaramelToast("سلتك فارغة! أضف منتجات أولاً."); return; }

    const nameInput = document.getElementById("checkoutCustomerName");
    const phoneInput = document.getElementById("checkoutCustomerPhone");
    const addrInput = document.getElementById("checkoutCustomerAddress");
    const customerName = nameInput?.value.trim() || "";
    const customerPhone = phoneInput?.value.trim() || "";
    const customerAddress = addrInput?.value.trim() || "";

    if (!customerName || !customerPhone) {
        toggleProfileEditorPanel(true);
        showCaramelToast("برجاء إدخال الاسم ورقم التواصل أولاً");
        if (!customerName && nameInput) nameInput.focus();
        else if (!customerPhone && phoneInput) phoneInput.focus();
        return;
    }

    saveCustomerProfileInputs(customerName, customerPhone, customerAddress);
    const { totalPieces, totalAmount } = getCartTotals();
    const orderId = generateOrderNumber();
    const nowText = new Date().toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
    const locationUrl = customerLocationCoords ? `https://maps.google.com/?q=${customerLocationCoords.lat},${customerLocationCoords.lng}` : "";

    const newActiveOrder = {
        orderId,
        createdAtText: nowText,
        stage: "confirmed",
        sentAt: Date.now(),
        customerName,
        customerPhone,
        customerAddress,
        locationUrl,
        items: cart.map(item => ({ ...item }))
    };

    activeOrders.unshift(newActiveOrder);
    expandedOrderIds.add(orderId);
    saveActiveOrders();

    const lines = cart.map((item, idx) => {
        const details = [item.selectedSize ? `${resolveCartOptionShortTag(PRODUCTS.find(p => p.id === item.id))}: ${item.selectedSize}` : "", item.selectedColor ? `لون: ${item.selectedColor}` : "", item.note ? `ملاحظة: ${item.note}` : ""].filter(Boolean).join(" | ");
        const imgPart = item.img ? ` | صورة: ${item.img}` : "";
        return `${idx + 1}. ${item.title} (الكمية: ${item.qty} × ${formatPriceNumber(item.price)} جنيه = ${formatPriceNumber((Number(item.price) || 0) * (Number(item.qty) || 1))} جنيه)${details ? ` [${details}]` : ""}${imgPart}`;
    });

    let msg = `طلب جديد رقم *${orderId}* من *متجر كارامل*:\n\n`;
    msg += `الاسم: ${customerName}\n`;
    msg += `رقم التواصل: ${customerPhone}\n`;
    if (customerAddress) msg += `العنوان: ${customerAddress}\n`;
    if (locationUrl) msg += `اللوكيشن: ${locationUrl}\n`;
    msg += `\nالمنتجات:\n${lines.join("\n")}\n\nإجمالي القطع: ${totalPieces}\nالإجمالي الكلي: ${formatPriceNumber(totalAmount)} جنيه`;

    cart = [];
    saveCart();
    updateCartUI();
    switchCartOrdersTab("pending");
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`);
}

function openWhatsAppChatDirect() {
    const msg = encodeURIComponent("مرحباً متجر كارامل، أريد الاستفسار عن المنتجات والطلبات.");
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`);
}

const PUSH_SUBSCRIBED_KEY = "caramel_push_subscribed_v1";
const PUSH_PILL_COLLAPSED_KEY = "caramel_push_pill_collapsed_v1";
let pushPillHideTimer = null;

function buildPushCheckIconSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
}

function buildPushBellIconSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
}

function isUserPushSubscribed() {
    try { return localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "1"; } catch (e) { return false; }
}

function setUserPushSubscribed(val) {
    try {
        if (val) localStorage.setItem(PUSH_SUBSCRIBED_KEY, "1");
        else localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
    } catch (e) {}
}

function isPushPillCollapsed() {
    try { return localStorage.getItem(PUSH_PILL_COLLAPSED_KEY) === "1"; } catch (e) { return false; }
}

function setPushPillCollapsed(val) {
    try {
        if (val) localStorage.setItem(PUSH_PILL_COLLAPSED_KEY, "1");
        else localStorage.removeItem(PUSH_PILL_COLLAPSED_KEY);
    } catch (e) {}
}

function schedulePushPillAutoHide(delayMs = 1500) {
    clearTimeout(pushPillHideTimer);
    pushPillHideTimer = setTimeout(() => {
        const btn = document.getElementById("caramelPushBtn");
        if (!btn || !isUserPushSubscribed()) return;
        setPushPillCollapsed(true);
        btn.classList.add("circle-check-only", "hiding-smooth");
        setTimeout(() => {
            btn.classList.remove("visible", "hiding-smooth");
        }, 420);
    }, delayMs);
}

function syncPushButtonState() {
    const btn = document.getElementById("caramelPushBtn");
    const txt = document.getElementById("caramelPushBtnText");
    const iconEl = document.getElementById("caramelPushIcon");
    if (!btn || !txt) return;

    const hasPerm = ("Notification" in window) && Notification.permission === "granted";
    const subscribed = isUserPushSubscribed() || hasPerm;

    if (subscribed) {
        if (!isUserPushSubscribed() && hasPerm) setUserPushSubscribed(true);
        txt.textContent = "تم تفعيل الإشعارات ✓";
        if (iconEl) iconEl.innerHTML = buildPushCheckIconSvg();
        if (isPushPillCollapsed()) {
            btn.classList.remove("visible", "circle-check-only", "hiding-smooth");
        } else {
            btn.classList.add("visible");
            btn.classList.remove("circle-check-only", "hiding-smooth");
            schedulePushPillAutoHide(1500);
        }
    } else {
        clearTimeout(pushPillHideTimer);
        setPushPillCollapsed(false);
        txt.textContent = "فعّل إشعارات العروض";
        if (iconEl) iconEl.innerHTML = buildPushBellIconSvg();
        btn.classList.add("visible");
        btn.classList.remove("circle-check-only", "hiding-smooth");
    }
}

async function enableCaramelPush() {
    if (isUserPushSubscribed()) {
        syncPushButtonState();
        showCaramelToast("الإشعارات مفعّلة بالفعل ✓");
        return;
    }

    if (!("Notification" in window)) {
        setUserPushSubscribed(true);
        setPushPillCollapsed(false);
        syncPushButtonState();
        showCaramelToast("تم تفعيل إشعارات العروض ✓");
        return;
    }

    if (Notification.permission === "granted") {
        setUserPushSubscribed(true);
        setPushPillCollapsed(false);
        syncPushButtonState();
        showCaramelToast("تم تفعيل إشعارات متجر كارامل بنجاح!");
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            setUserPushSubscribed(true);
            setPushPillCollapsed(false);
            syncPushButtonState();
            showCaramelToast("تم تفعيل إشعارات متجر كارامل بنجاح!");
            try {
                if ("serviceWorker" in navigator) {
                    const reg = await navigator.serviceWorker.ready;
                    if (reg && reg.showNotification) {
                        await reg.showNotification("متجر كارامل", {
                            body: "تم تفعيل إشعارات العروض والمنتجات الجديدة بنجاح!",
                            icon: BRAND_LOGO_URL,
                            badge: BRAND_LOGO_URL
                        });
                    }
                }
            } catch (notifErr) {}
        } else if (permission === "denied") {
            showCaramelToast("تم رفض الإشعارات من إعدادات المتصفح");
        }
    } catch (e) {
        showCaramelToast("تعذر طلب إذن الإشعارات حالياً");
    }
}

function initCaramelSplashScreen() {
    const splash = document.getElementById("caramelSplashScreen");
    const subRect = document.getElementById("caramelSplashSubRect");
    const typedTextEl = document.getElementById("caramelSplashTypedText");
    if (!splash) return;

    let dismissTimer = null;
    let dismissed = false;

    const finishSplash = () => {
        if (dismissed) return;
        dismissed = true;
        if (dismissTimer) clearTimeout(dismissTimer);
        splash.classList.add("hide");
        setTimeout(() => { if (splash && splash.parentNode) splash.remove(); }, 480);
    };

    if (typedTextEl) typedTextEl.textContent = "كل قطعة وليها دور";

    // Logo & brand name appear first, then the slogan plaque descends smoothly underneath as one complete piece
    setTimeout(() => {
        if (dismissed) return;
        if (subRect) subRect.classList.add("descend-in");
        dismissTimer = setTimeout(finishSplash, 1450);
    }, 340);

    // Safety ceiling so splash never stays stuck
    setTimeout(finishSplash, 2600);
    splash.addEventListener("click", finishSplash, { once: true });
}



const MERCHANT_POLICY_DATA = {
    appliances: {
        title: "1. الأجهزة المنزلية والكهربائية والإلكترونيات",
        items: [
            "<strong>الموبايلات والتابلت واللاب توب:</strong> عمولة من 5% إلى 8% من سعر البيع.",
            "<strong>الأجهزة المنزلية الكبيرة (ثلاجات، غسالات، بوتاجازات):</strong> عمولة من 6% إلى 8%، ورسوم المناولة للقطعة تبدأ من 60 إلى 150 جنيهاً حسب الوزن الفعلي وحجم الكرتونة.",
            "<strong>التكييفات:</strong> رسوم إحالة أساسية من 5% إلى 7%، وفي نظام التجهيز السريع تبدأ رسوم المناولة والنقل الثابتة من 100 إلى 150 جنيهاً لكل جهاز نظير تخصيص مساحة تخزين ونقل مخصص.",
            "<strong>الأجهزة المنزلية الصغيرة والمطبخ (خلاطات، قلايات هوائية، مايكرويف، مكواة، كاتيل، مصفف شعر):</strong> عمولة من 10% إلى 15%، ورسوم التشغيل الصغيرة من 12 إلى 20 جنيهاً، والمتوسطة من 25 إلى 45 جنيهاً للقطعة."
        ],
        note: "جميع الرسوم التشغيلية والمناولة تُحتسب بالجنيه المصري حسب طبيعة الجهاز وحجمه."
    },
    home_tools: {
        title: "2. الأدوات المنزلية وأدوات المطبخ",
        items: [
            "<strong>نسبة العمولة:</strong> من 12% إلى 15% من سعر البيع.",
            "<strong>منتجات صغيرة وخفيفة (سكاكين، مقاشر، منظمات صغيرة، علب توابل):</strong> رسوم تشغيل من 7 إلى 12 جنيهاً للقطعة.",
            "<strong>منتجات متوسطة (طقم حلل صغير، كرتونة أطباق، صواني، قلاية هوائية):</strong> رسوم تشغيل من 15 إلى 25 جنيهاً للقطعة.",
            "<strong>منتجات كبيرة أو ثقيلة (أطقم عشاء كاملة 60 قطعة، منظمات مستوردة كبيرة):</strong> تبدأ من 35 جنيهاً وتزيد حسب الوزن الفعلي بالكيلوجرام والأبعاد بالمتر المكعب."
        ],
        note: "يُراعى في المنتجات الكبيرة والثقيلة الوزن الفعلي والأبعاد عند تقدير تكلفة المناولة والشحن."
    },
    beauty: {
        title: "3. الجمال، المكياج، والعناية الشخصية",
        items: [
            "<strong>المكياج ومستحضرات التجميل (روج، كريم أساس، ماسكارا):</strong> عمولة حوالي 15%.",
            "<strong>أدوات وأجهزة التجميل الصغيرة (فرش مكياج، إسفنج، مبرد أظافر):</strong> عمولة من 12% إلى 15%.",
            "<strong>أجهزة التجميل الكهربائية (السشوار، بيبي ليس):</strong> عمولة من 10% إلى 12% وفق فئة الإلكترونيات.",
            "<strong>رسوم التشغيل للقطع الصغيرة والخفيفة جداً:</strong> تقريباً من 5 إلى 8 جنيهات مصرية لكل قطعة."
        ],
        note: "يُنصح بالاعتماد على نظام التجهيز السريع والالتزام بصلاحية المنتجات وسلامة العبوات الأصلية."
    },
    fashion: {
        title: "4. الملابس، الأزياء، والإكسسوارات",
        items: [
            "<strong>الملابس الجاهزة (رجالي، حريمي، أطفال):</strong> عمولة 20% في معظم التصنيفات، والقطع الخفيفة (تيشيرتات، قمصان، ملابس أطفال) رسومها من 10 إلى 15 جنيهاً، والقطع الثقيلة (جواكت شتوية، بدل، أحذية ضخمة) من 20 إلى 30 جنيهاً.",
            "<strong>الأحذية والحقائب:</strong> عمولة من 18% إلى 20%.",
            "<strong>النظارات والساعات وإكسسوارات الأزياء:</strong> عمولة تصل إلى 20%.",
            "<strong>المرتجعات:</strong> قد تصل في الأزياء إلى 20%–30% بسبب المقاس أو اللون؛ لا تُخصم عمولة البيع الأساسية (20%) عند الإرجاع، وقد تُطبق رسوم إدارية لإعادة القطعة للمخزن من 20 إلى 40 جنيهاً."
        ],
        note: "يُنصح بمراعاة هامش الربح لتعويض تكلفة شحن القطع المرتجعة وتأمين أرباحك."
    },
    stationery: {
        title: "5. اللوازم المكتبية والقرطاسية",
        items: [
            "<strong>القرطاسية والأدوات الصغيرة (أقلام، دفاتر، منظمات مكتب، مقصات):</strong> عمولة حوالي 11% من سعر البيع.",
            "<strong>رسوم الشحن والتغليف الثابتة:</strong> في أدنى مستوياتها بين 5 إلى 8 جنيهات مصرية للقطعة."
        ],
        note: "ملاحظة التسعير: يُفضل البيع في مجموعات أو حزم (مثل علبة 12 قلماً أو طقم دفاتر) حتى لا تلتهم الرسوم الثابتة هامش الربح في القطع منخفضة السعر جداً."
    },
    gifts_mobile: {
        title: "6. الهدايا، الهاند ميد، وإكسسوارات الموبايل",
        items: [
            "<strong>الهدايا والهاند ميد (ديكورات، تماثيل، لوحات):</strong> عمولة أساسية من 12% إلى 15%، وتصل الإكسسوارات اليدوية (سلاسل، حظاظات، خواتم) إلى 15%–18%. صناديق الهدايا الجاهزة تُحسب غالباً بعمولة 12% حسب التصنيف الرئيسي.",
            "<strong>رسوم الهاند ميد والهدايا:</strong> القطع الصغيرة والخفيفة من 5 إلى 10 جنيهات، مع توفير تغليف معزز للقطع القابلة للكسر (فخار، جبس، مرايا).",
            "<strong>إكسسوارات الموبايل (كفرات، كابلات شحن):</strong> عمولة من 12% إلى 15%، ورسوم التشغيل حوالي 5 إلى 8 جنيهات للقطعة."
        ],
        note: "يفضل العملاء منتجات التجهيز السريع لسرعة التوصيل وتجنب مصاريف شحن مرتفعة على القطع الصغيرة."
    }
};

function renderMerchantPolicyContent(catKey = "appliances") {
    const box = document.getElementById("merchantPolicyContent");
    if (!box) return;
    const data = MERCHANT_POLICY_DATA[catKey] || MERCHANT_POLICY_DATA.appliances;
    box.innerHTML = `
        <div class="merchant-policy-heading">${data.title}</div>
        <ul class="merchant-policy-list">
            ${data.items.map(it => `<li>${it}</li>`).join("")}
        </ul>
        <div class="merchant-policy-note">${data.note}</div>
    `;
}

function selectMerchantPolicyCategory(catKey, btnEl) {
    document.querySelectorAll("#merchantCategoryPills .merchant-cat-pill").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    renderMerchantPolicyContent(catKey);
}

function switchMerchantHubTab(tabKey, btnEl) {
    document.querySelectorAll(".merchant-hub-tab").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-m-tab") === tabKey);
    });
    const panels = {
        policies: document.getElementById("merchantTabPolicies"),
        calculator: document.getElementById("merchantTabCalculator"),
        join: document.getElementById("merchantTabJoin")
    };
    Object.entries(panels).forEach(([k, el]) => {
        if (el) el.classList.toggle("is-hidden", k !== tabKey);
    });
    if (tabKey === "calculator") recalculateMerchantProfit();
}

function recalculateMerchantProfit() {
    const salePrice = Math.max(0, Number(document.getElementById("calcSalePrice")?.value) || 0);
    const costPrice = Math.max(0, Number(document.getElementById("calcCostPrice")?.value) || 0);
    const commRate = Math.max(0, Number(document.getElementById("calcCommissionRate")?.value) || 0);
    const handlingFee = Math.max(0, Number(document.getElementById("calcHandlingFee")?.value) || 0);

    const commissionAmount = (salePrice * commRate) / 100;
    const totalDeductions = costPrice + commissionAmount + handlingFee;
    const netProfit = salePrice - totalDeductions;

    const commEl = document.getElementById("calcCommissionVal");
    const dedEl = document.getElementById("calcTotalDeductionsVal");
    const netEl = document.getElementById("calcNetProfitVal");

    if (commEl) commEl.textContent = `${formatPriceNumber(Number(commissionAmount.toFixed(2)))} جنيه`;
    if (dedEl) dedEl.textContent = `${formatPriceNumber(Number(totalDeductions.toFixed(2)))} جنيه`;
    if (netEl) netEl.textContent = `${formatPriceNumber(Number(netProfit.toFixed(2)))} جنيه`;
}

function applySampleProfitExample() {
    const saleEl = document.getElementById("calcSalePrice");
    const costEl = document.getElementById("calcCostPrice");
    const rateEl = document.getElementById("calcCommissionRate");
    const feeEl = document.getElementById("calcHandlingFee");
    if (saleEl) saleEl.value = "500";
    if (costEl) costEl.value = "260";
    if (rateEl) rateEl.value = "15";
    if (feeEl) feeEl.value = "20";
    recalculateMerchantProfit();
}

function openBecomeMerchantModal(initialTab = "policies") {
    const modal = document.getElementById("becomeMerchantModal");
    if (!modal) return;
    renderMerchantPolicyContent("appliances");
    recalculateMerchantProfit();
    const targetTabBtn = document.querySelector(`.merchant-hub-tab[data-m-tab="${initialTab}"]`);
    switchMerchantHubTab(initialTab, targetTabBtn);
    modal.classList.add("open");
    syncBodyScrollLock();
    pushOverlayState("becomeMerchant");
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
    const detailsInput = document.getElementById("merchantRegDetails");

    const merchantName = (nameInput?.value || "").trim();
    const activityName = (activityInput?.value || "").trim();
    const contactPhone = (phoneInput?.value || "").trim();
    const extraDetails = (detailsInput?.value || "").trim();

    if (!merchantName || !activityName || !contactPhone) {
        showCaramelToast("برجاء إدخال اسم المكان/البراند والنشاط ورقم التواصل");
        return;
    }

    const lines = [
        "طلب انضمام تاجر جديد — *متجر كارامل*",
        "",
        `*اسم المكان / البراند:* ${merchantName}`,
        `*النشاط والمنتجات:* ${activityName}`,
        `*رقم التواصل:* ${contactPhone}`
    ];
    if (extraDetails) lines.push(`*تفاصيل إضافية:* ${extraDetails}`);

    closeBecomeMerchantModal(false);
    if (nameInput) nameInput.value = "";
    if (activityInput) activityInput.value = "";
    if (phoneInput) phoneInput.value = "";
    if (detailsInput) detailsInput.value = "";

    showCaramelToast("جاري تحويلك إلى واتساب لإرسال طلب الانضمام...");
    launchWhatsAppTarget(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`);
}


function isProductImageSoldOut(product, imgSrc) {
    if (!product || !Array.isArray(product.soldOutImages) || !product.soldOutImages.length) {
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

function initApp() {
    initThemeMode();
    syncBrandLogos();
    initCaramelSplashScreen();
    hydrateQuickTopTabsIcons();
    syncHeaderStickyOffsets();
    loadCustomerProfileToInputs();
    updateSearchCancelButton();
    renderSmartSearchSuggestions();
    updateWishlistUI();
    renderMerchantsQuickStrip();
    renderSpotlightBoxes();
    renderProducts("all");
    updateCartUI();
    syncPushButtonState();
    syncHeaderInstallOrUpdateButton();
    syncSupportWhatsAppLinks();
    setupInfiniteScrollObserver();
    loadStoreConfigFromJson(false);
    loadMerchantProductsFromJson(false);
}

initApp();
