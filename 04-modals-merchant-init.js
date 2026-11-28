// ============================================================================
// MODULE 4: MODALS, DRAWERS, MERCHANT HUB & BOOTSTRAP
// ============================================================================

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
