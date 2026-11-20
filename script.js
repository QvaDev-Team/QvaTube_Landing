/* ══════════════════════════════════════════════════════════════
   QvaTube — Interacciones de la landing
   ══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Año del pie ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Header con borde al hacer scroll ---------- */
  const header = document.querySelector(".site-header");
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Menú móvil ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const mobileNav = document.getElementById("mobile-nav");

  const setMenu = (open) => {
    if (!toggle || !mobileNav) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    mobileNav.hidden = !open;
    mobileNav.classList.toggle("is-open", open);
  };

  if (toggle && mobileNav) {
    setMenu(false);

    toggle.addEventListener("click", () => {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });

    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenu(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 980) setMenu(false);
    });
  }

  /* ---------- Aparición al hacer scroll ---------- */
  const revealEls = Array.from(document.querySelectorAll(".reveal"));

  if (revealEls.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("is-visible"));
    } else {
      revealEls.forEach((el) => {
        const siblings = el.parentElement
          ? Array.from(el.parentElement.children).filter((child) =>
              child.classList.contains("reveal")
            )
          : [];
        const index = siblings.indexOf(el);
        if (index > 0) {
          el.style.transitionDelay = `${Math.min(index * 60, 240)}ms`;
        }
      });

      const revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
      );

      revealEls.forEach((el) => revealObserver.observe(el));
    }
  }

  /* ---------- Enlace activo en la navegación ---------- */
  const navLinks = Array.from(document.querySelectorAll(".main-nav a"));
  const linkById = new Map();

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href.startsWith("#")) linkById.set(href.slice(1), link);
  });

  const sections = Array.from(linkById.keys())
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => link.classList.remove("is-active"));
          const active = linkById.get(entry.target.id);
          if (active) active.classList.add("is-active");
        });
      },
      { rootMargin: "-42% 0px -52% 0px", threshold: 0 }
    );

    sections.forEach((section) => sectionObserver.observe(section));
  }

  /* ---------- Selector CUP / USD de los planes ---------- */
  const billingButtons = Array.from(document.querySelectorAll(".billing-btn"));
  const priceNodes = Array.from(document.querySelectorAll(".plan-price [data-cup]"));
  let currentCurrency = "cup";

  const setCurrency = (currency, animate = true) => {
    currentCurrency = currency;

    billingButtons.forEach((button) => {
      const active = button.dataset.currency === currency;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    priceNodes.forEach((node) => {
      const value = node.dataset[currency];
      if (value === undefined) return;
      node.textContent = value;

      if (animate && !reduceMotion && typeof node.animate === "function") {
        node.animate(
          [
            { opacity: 0.25, transform: "translateY(3px)" },
            { opacity: 1, transform: "translateY(0)" }
          ],
          { duration: 220, easing: "ease-out" }
        );
      }
    });
  };

  billingButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.classList.contains("is-active")) return;
      setCurrency(button.dataset.currency === "usd" ? "usd" : "cup");
    });
  });

  /* ---------- Precios y cuotas reales desde QvaTube ----------
     El HTML trae precios de referencia para que la sección sirva sin JS.
     Al cargar se consulta /api/plans (la misma fuente que usa la app,
     incluidos los cambios de precio del panel de admin) y se sobrescribe
     todo. Si la API no responde, se queda la referencia: la sección
     nunca se rompe ni se queda en blanco. */
  const planCards = Array.from(document.querySelectorAll(".plan[data-plan]"));
  const minCupNodes = Array.from(document.querySelectorAll("[data-plan-min-cup]"));
  const minUsdNodes = Array.from(document.querySelectorAll("[data-plan-min-usd]"));
  const plansStatus = document.querySelector("[data-plans-status]");

  const quotaFields = {
    download: "download_limit",
    stream: "stream_limit",
    "music-download": "music_download_limit",
    "music-stream": "music_stream_limit"
  };

  const quotaLabels = {
    download: (value) =>
      value === null
        ? "Descargas ilimitadas"
        : `${value} ${value === 1 ? "descarga" : "descargas"} de video`,
    stream: (value) =>
      value === null
        ? "Reproducciones ilimitadas"
        : `${value} ${value === 1 ? "reproducción" : "reproducciones"} a la vez`,
    "music-download": (value) =>
      value === null ? "Música sin límite" : `${value} canciones offline`,
    "music-stream": (value) =>
      value === null ? "Escuchas sin límite" : `${value} escuchas de música`
  };

  const applyPlans = (plans) => {
    const byKey = new Map(plans.map((plan) => [plan.key, plan]));

    planCards.forEach((card) => {
      const plan = byKey.get(card.dataset.plan);
      if (!plan) return;

      const amount = card.querySelector(".amount[data-cup]");
      if (amount) {
        amount.dataset.cup = String(plan.price_cup);
        amount.dataset.usd = "$" + plan.price_usd;
      }

      card.querySelectorAll("[data-quota]").forEach((node) => {
        const field = quotaFields[node.dataset.quota];
        if (!field) return;

        const raw = plan[field];
        const value = plan.unlimited || raw === null ? null : raw;
        node.textContent = quotaLabels[node.dataset.quota](value);
      });
    });

    const paidCup = plans.map((plan) => plan.price_cup).filter((price) => price > 0);
    const paidUsd = plans.map((plan) => plan.price_usd).filter((price) => price > 0);

    if (paidCup.length) {
      const minCup = Math.min(...paidCup);
      minCupNodes.forEach((node) => {
        node.textContent = String(minCup);
      });
    }

    if (paidUsd.length) {
      const minUsd = Math.min(...paidUsd);
      minUsdNodes.forEach((node) => {
        node.textContent = String(minUsd);
      });
    }

    // Si el usuario ya estaba viendo USD, se reaplica al precio nuevo.
    setCurrency(currentCurrency, false);

    if (plansStatus) {
      plansStatus.textContent = "Precios sincronizados con QvaTube";
    }
  };

  // Ruta relativa primero: si la landing se publica dentro del mismo
  // dominio de QvaTube, funciona sin CORS. La absoluta cubre el caso de
  // un dominio aparte (requiere que /api/plans envíe Access-Control-Allow-Origin).
  const planSources = ["/api/plans", "https://qvatube.hidenplay.net/api/plans"];

  const fetchPlans = async () => {
    for (const url of planSources) {
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 7000);
        const response = await fetch(url, {
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal
        });
        window.clearTimeout(timeout);

        if (!response.ok) continue;

        const plans = await response.json();
        if (
          Array.isArray(plans) &&
          plans.length > 0 &&
          plans.every((plan) => plan && plan.key && typeof plan.price_cup === "number")
        ) {
          return plans;
        }
      } catch (error) {
        // Origen no disponible o bloqueado por CORS: se prueba el siguiente.
      }
    }

    return null;
  };

  if (planCards.length) {
    const refreshPlans = () => {
      fetchPlans().then((plans) => {
        if (plans) applyPlans(plans);
      });
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(refreshPlans, { timeout: 3000 });
    } else {
      window.setTimeout(refreshPlans, 900);
    }
  }

  /* ---------- Estadísticas reales de QvaTube ----------
     Son los mismos cuatro datos del banner superior de la app (ver
     refreshOnlineBanner en app.js): conectados, viendo/capacidad, nuevo
     hoy y actividad hoy. Se piden a /api/stats cada 25 s y al volver a
     la pestaña. Si la API falla, se conserva el último valor conocido
     (o el guardado en esta sesión) y nunca se inventa un número. */
  const statsList = document.querySelector(".hero-stats");
  const statNodes = {
    online: document.querySelector('[data-stat="online"]'),
    watching: document.querySelector('[data-stat="watching"]'),
    "new-today": document.querySelector('[data-stat="new-today"]'),
    "activity-today": document.querySelector('[data-stat="activity-today"]')
  };
  const catalogSizeNode = document.querySelector("[data-catalog-size]");

  if (statsList && statNodes.online) {
    const STATS_CACHE_KEY = "qva_landing_stats_v1";
    const STATS_REFRESH_MS = 25000;
    let statsTimer = null;

    const fmtCompact = (value) => {
      const number = Number(value || 0);
      if (number < 1000) return number.toLocaleString("es");

      const units = [
        [1e9, "B"],
        [1e6, "M"],
        [1e3, "K"]
      ];

      for (const [divisor, suffix] of units) {
        if (number >= divisor) {
          const short = number / divisor;
          return `${short % 1 === 0 ? short.toFixed(0) : short.toFixed(1)}${suffix}`;
        }
      }

      return String(number);
    };

    const paintStats = (stats) => {
      const online = Number(stats.online_now || 0);
      const watching = Number(stats.watching_now || 0);
      const capacity = Number(stats.watching_capacity || 0);
      const newToday = Number(stats.new_today || 0);
      const activityToday = Number(stats.activity_today || 0);

      statNodes.online.textContent = fmtCompact(online);
      statNodes.watching.textContent = capacity
        ? `${fmtCompact(watching)}/${fmtCompact(capacity)}`
        : fmtCompact(watching);
      statNodes["new-today"].textContent = fmtCompact(newToday);
      statNodes["activity-today"].textContent = fmtCompact(activityToday);

      if (catalogSizeNode && Number.isFinite(Number(stats.catalog_size))) {
        catalogSizeNode.textContent = Number(stats.catalog_size).toLocaleString("es");
      }

      statsList.classList.add("is-live");
    };

    // Último valor visto en esta sesión: se pinta al instante mientras
    // llega la respuesta nueva, para no parpadear con "—".
    try {
      const cached = JSON.parse(sessionStorage.getItem(STATS_CACHE_KEY) || "null");
      if (cached) paintStats(cached);
    } catch (error) {
      // Caché corrupta o almacenamiento bloqueado: se ignora.
    }

    const statSources = ["/api/stats", "https://qvatube.hidenplay.net/api/stats"];

    const fetchStats = async () => {
      for (const url of statSources) {
        try {
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 7000);
          const response = await fetch(url, {
            cache: "no-store",
            credentials: "omit",
            signal: controller.signal
          });
          window.clearTimeout(timeout);

          if (!response.ok) continue;

          const stats = await response.json();
          if (stats && typeof stats.online_now === "number") return stats;
        } catch (error) {
          // Sin red o bloqueado por CORS: se prueba el siguiente origen.
        }
      }

      return null;
    };

    const refreshStats = async () => {
      const stats = await fetchStats();
      if (!stats) return;

      paintStats(stats);

      try {
        sessionStorage.setItem(
          STATS_CACHE_KEY,
          JSON.stringify({
            online_now: stats.online_now,
            watching_now: stats.watching_now,
            watching_capacity: stats.watching_capacity,
            new_today: stats.new_today,
            activity_today: stats.activity_today,
            catalog_size: stats.catalog_size
          })
        );
      } catch (error) {
        // Sin almacenamiento: no es crítico.
      }
    };

    const startStats = () => {
      refreshStats();
      window.clearInterval(statsTimer);
      statsTimer = window.setInterval(refreshStats, STATS_REFRESH_MS);
    };

    startStats();

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshStats();
    });
  }

  /* ---------- Acordeón de preguntas ---------- */
  const faqItems = Array.from(document.querySelectorAll(".faq-item"));
  faqItems.forEach((item) => {
    const summary = item.querySelector("summary");
    if (!summary) return;

    summary.addEventListener("click", () => {
      if (item.open) return;
      faqItems.forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });
})();
