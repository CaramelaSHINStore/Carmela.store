// ============================================================================
// MODULE 1: CONFIG, BRANDING, THEME & WHATSAPP DEEP-LINKS
// ============================================================================

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
