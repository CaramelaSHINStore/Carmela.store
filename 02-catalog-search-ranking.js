// ============================================================================
// MODULE 2: CATALOG, VARIANTS, SEARCH & SMART RANKING
// ============================================================================

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
    bumpCatalogStateVersion();
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
    bumpCatalogStateVersion();
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
