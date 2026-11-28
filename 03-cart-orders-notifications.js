// ============================================================================
// MODULE 3: CART, ORDERS, CHECKOUT & NOTIFICATIONS
// ============================================================================

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
    bumpCatalogStateVersion();
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
    bumpCatalogStateVersion();
}

let catalogStateVersion = 1;
let userScoreCache = new Map();
let userScoreCacheVersion = -1;
let searchScoreCache = new Map();
let searchScoreCacheVersion = -1;

function bumpCatalogStateVersion() {
    catalogStateVersion += 1;
    userScoreCache.clear();
    searchScoreCache.clear();
}

function getCartCategorySet() {
    const set = new Set();
    cart.forEach(ci => {
        const match = PRODUCTS.find(p => p.id === ci.id);
        if (match && match.category) set.add(match.category);
    });
    return set;
}

function getCachedSearchScore(product, rawQuery) {
    const normQ = normalizeText(rawQuery);
    if (!normQ) return 1;
    if (searchScoreCacheVersion !== catalogStateVersion) {
        searchScoreCache.clear();
        searchScoreCacheVersion = catalogStateVersion;
    }
    const cacheKey = `${normQ}::${product.id}`;
    if (searchScoreCache.has(cacheKey)) {
        return searchScoreCache.get(cacheKey);
    }
    const val = getProductSearchScore(product, normQ);
    if (searchScoreCache.size > 4000) searchScoreCache.clear();
    searchScoreCache.set(cacheKey, val);
    return val;
}

function scoreProductForUser(product, seedOffset = 0) {
    if (userScoreCacheVersion !== catalogStateVersion) {
        userScoreCache.clear();
        userScoreCacheVersion = catalogStateVersion;
    }
    const cacheKey = `${product.id}::${seedOffset}`;
    if (userScoreCache.has(cacheKey)) {
        return userScoreCache.get(cacheKey);
    }

    const cats = [product.category, ...(Array.isArray(product.categories) ? product.categories : [])];
    let catScore = 0;
    cats.forEach(c => {
        catScore = Math.max(catScore, (interestData.categories[c] || 0) * 12);
    });

    const cartCats = getCartCategorySet();
    const inCartCat = cats.some(c => c && cartCats.has(c));
    if (inCartCat) catScore += 14;

    if (wishlistIds.includes(String(product.id))) catScore += 16;

    const tokens = extractTokens(product.title).filter(t => t.length >= 2);
    let kwScore = 0;
    tokens.forEach(t => { kwScore += (interestData.keywords[t] || 0) * 5; });

    const isSeen = interestData.seenIds.includes(product.id);
    const freshnessBonus = isSeen ? -5 : 10;
    const dynamicJitter = ((product.id.charCodeAt(product.id.length - 1) * 13 + seedOffset * 17 + Math.floor(interestData.sessionRoll * 100)) % 9) * 0.8;
    const total = catScore + kwScore + freshnessBonus + dynamicJitter;
    userScoreCache.set(cacheKey, total);
    return total;
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

const spotlightIntervalId = setInterval(() => {
    if (document.visibilityState !== "visible" || isAnyOverlayOpen()) return;
    if (!pausedMotionKind.trends && trendSlideList.length > 1) {
        trendSlideIdx = (trendSlideIdx + 1) % trendSlideList.length;
        paintSpotlightSlide("trends");
    }
    if (!pausedMotionKind.deals && dealSlideList.length > 1) {
        dealSlideIdx = (dealSlideIdx + 1) % dealSlideList.length;
        paintSpotlightSlide("deals");
    }
}, 3200);

window.addEventListener("pagehide", () => {
    clearInterval(spotlightIntervalId);
    stopCardAutoSlide();
    clearTimeout(toastTimer);
    clearTimeout(pushPillHideTimer);
}, { once: true });

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
            const sc = getCachedSearchScore(p, searchQuery);
            if (sc > 0) {
                searchScores.set(p.id, sc);
                return true;
            }
            return false;
        });
    }

    const hasSpecificCategory = Boolean(category && category !== "all");

    if (currentFeedMode === "deals") {
        filtered = [...filtered].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (currentFeedMode === "new") {
        filtered = [...filtered].reverse();
        if (!hasSpecificCategory && !currentMerchant && !hasSearch) {
            filtered = interleaveMerchantsSmartly(filtered);
        }
    } else {
        filtered = [...filtered].sort((a, b) => scoreProductForUser(b, 1) - scoreProductForUser(a, 1));
        if (!hasSpecificCategory && !currentMerchant && (!category || category === "all") && !hasSearch) {
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

    if (document.getElementById("catsDrawer")?.classList.contains("open")) {
        renderSideCategoriesList();
    }
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

function formatOrderItemLine(item, idx, includeImage = true) {
    const qty = Math.max(1, Number(item.qty) || 1);
    const unitPrice = Number(item.price) || 0;
    const lineTotal = unitPrice * qty;
    const optionTag = resolveCartOptionShortTag(PRODUCTS.find(p => p.id === item.id));
    const details = [
        item.selectedSize ? `${optionTag}: ${item.selectedSize}` : "",
        item.selectedColor ? `لون: ${item.selectedColor}` : "",
        item.note ? `ملاحظة: ${item.note}` : ""
    ].filter(Boolean).join(" | ");
    const imgPart = includeImage && item.img ? ` | صورة: ${item.img}` : "";
    return `${idx + 1}. ${item.title} (الكمية: ${qty} × ${formatPriceNumber(unitPrice)} جنيه = ${formatPriceNumber(lineTotal)} جنيه)${details ? ` [${details}]` : ""}${imgPart}`;
}

function buildWhatsAppOrderMessage({ headerTitle, orderId, customerName = "", customerPhone = "", customerAddress = "", locationUrl = "", items = [] }) {
    const lines = (items || []).map((item, idx) => formatOrderItemLine(item, idx, true));
    const totalPcs = (items || []).reduce((sum, it) => sum + (Math.max(1, Number(it.qty) || 1)), 0);
    const totalAmt = (items || []).reduce((sum, it) => sum + ((Number(it.price) || 0) * (Math.max(1, Number(it.qty) || 1))), 0);

    let msg = `${headerTitle} رقم *${orderId}* من *متجر كارامل*:\n\n`;
    if (customerName) msg += `الاسم: ${customerName}\n`;
    if (customerPhone) msg += `رقم التواصل: ${customerPhone}\n`;
    if (customerAddress) msg += `العنوان: ${customerAddress}\n`;
    if (locationUrl) msg += `اللوكيشن: ${locationUrl}\n`;
    msg += `\nالمنتجات:\n${lines.join("\n")}\n\nإجمالي القطع: ${totalPcs}\nالإجمالي الكلي: ${formatPriceNumber(totalAmt)} جنيه`;
    return msg;
}

function sendOrderUpdateOnWhatsApp(orderId) {
    const order = activeOrders.find(o => o.orderId === orderId);
    if (!order) return;
    order.stage = "confirmed";
    order.sentAt = Date.now();
    order.updatedAtText = new Date().toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
    saveActiveOrders();
    renderActiveOrdersSection();

    const customerName = (document.getElementById("checkoutCustomerName")?.value || order.customerName || "").trim();
    const customerPhone = (document.getElementById("checkoutCustomerPhone")?.value || order.customerPhone || "").trim();
    const customerAddress = (document.getElementById("checkoutCustomerAddress")?.value || order.customerAddress || "").trim();
    const locUrl = customerLocationCoords ? `https://maps.google.com/?q=${customerLocationCoords.lat},${customerLocationCoords.lng}` : (order.locationUrl || "");

    const msg = buildWhatsAppOrderMessage({
        headerTitle: "متابعة / تحديث أوردر",
        orderId: order.orderId,
        customerName,
        customerPhone,
        customerAddress,
        locationUrl: locUrl,
        items: order.items || []
    });
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
    const orderId = generateOrderNumber();
    const nowText = new Date().toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
    const locationUrl = customerLocationCoords ? `https://maps.google.com/?q=${customerLocationCoords.lat},${customerLocationCoords.lng}` : "";
    const snapshotItems = cart.map(item => ({ ...item }));

    const newActiveOrder = {
        orderId,
        createdAtText: nowText,
        updatedAtText: nowText,
        stage: "confirmed",
        sentAt: Date.now(),
        customerName,
        customerPhone,
        customerAddress,
        locationUrl,
        items: snapshotItems
    };

    activeOrders.unshift(newActiveOrder);
    expandedOrderIds.add(orderId);
    saveActiveOrders();

    const msg = buildWhatsAppOrderMessage({
        headerTitle: "طلب جديد",
        orderId,
        customerName,
        customerPhone,
        customerAddress,
        locationUrl,
        items: snapshotItems
    });

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
