/* ============================================================
   script.js — Copenhagen Wedding Invitation
   Vanilla JS only · No external libraries
   ============================================================ */
"use strict";

/* ── SCROLL TO TOP ON LOAD ────────────────────────────────────
   브라우저의 스크롤 위치 복원을 막고 항상 최상단에서 시작합니다.
   ─────────────────────────────────────────────────────────── */
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

/* ── ZOOM PREVENTION ─────────────────────────────────────────
   viewport meta (user-scalable=no) is sufficient for most
   browsers, but iOS 10+ re-enables zoom — block it with JS.
   ─────────────────────────────────────────────────────────── */
(function preventZoom() {
  /* Block pinch-to-zoom (multi-touch move) */
  document.addEventListener(
    "touchmove",
    function (e) {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );

  /* Block double-tap zoom (two taps within 300 ms) */
  var _lastTap = 0;
  document.addEventListener(
    "touchend",
    function (e) {
      var now = Date.now();
      if (now - _lastTap < 300) {
        e.preventDefault();
      }
      _lastTap = now;
    },
    { passive: false },
  );
})();

/* ── CONFIG ──────────────────────────────────────────────────
   결혼식 정보를 여기서 수정하세요.
   ─────────────────────────────────────────────────────────── */
var CONFIG = {
  weddingDate: new Date("2026-10-04T14:30:00"),
  guestbookKey: "h1004day_gb_v2",
  /* ↓ Google Apps Script 웹앱 배포 후 URL을 아래에 붙여넣기        */
  /* 예) 'https://script.google.com/macros/s/AKfycb.../exec'        */
  sheetsUrl:
    "https://script.google.com/macros/s/AKfycbzffQUFhIiTFswNnLU-eaTrdzEyW_m4zA-PZVSr5P7411DMrJVLKaaNZkVFK7d5Yj-LQA/exec",

  /* ── 갤러리 이미지 목록 ──────────────────────────────────
     src/gallery 에 이미지 추가 시 이 배열에만 추가하면 됩니다.
     마지막 행 레이아웃은 자동 보정됩니다:
       개수 % 3 === 2 → 마지막 wide(2칸)
       개수 % 3 === 1 → 마지막 fullrow(3칸 전체)            */
  galleryImages: [
    { src: "src/gallery/1.jpg?v=20260607", alt: "커플 사진 1" },
    { src: "src/gallery/2.jpg?v=20260606", alt: "커플 사진 2" },
    { src: "src/gallery/3.jpg?v=20260606", alt: "커플 사진 3" },
    { src: "src/gallery/4.jpg?v=20260606", alt: "커플 사진 4" },
    { src: "src/gallery/5.jpg?v=20260606", alt: "커플 사진 5" },
    { src: "src/gallery/6.jpg?v=20260606", alt: "커플 사진 6" },
    { src: "src/gallery/7.jpg?v=20260606", alt: "커플 사진 7" },
    { src: "src/gallery/8.jpg?v=20260606", alt: "커플 사진 8" },
    { src: "src/gallery/9.jpg?v=20260606", alt: "커플 사진 9" },
    { src: "src/gallery/10.jpg?v=20260606", alt: "커플 사진 10" },
    { src: "src/gallery/11.jpg?v=20260606", alt: "커플 사진 11" },
    { src: "src/gallery/12.jpg?v=20260606", alt: "커플 사진 12" },
    { src: "src/gallery/13.jpg?v=20260606", alt: "커플 사진 13" },
    { src: "src/gallery/14.jpg?v=20260606", alt: "커플 사진 14" },
    { src: "src/gallery/15.jpg?v=20260606", alt: "커플 사진 15" },
    { src: "src/gallery/16.jpg?v=20260606", alt: "커플 사진 16" },
    { src: "src/gallery/17.jpg?v=20260606", alt: "커플 사진 17" },
    { src: "src/gallery/18.jpg?v=20260606", alt: "커플 사진 18" },
  ],
};

/* ── UTILS ───────────────────────────────────────────────────*/
var $ = function (sel, ctx) {
  return (ctx || document).querySelector(sel);
};
var $$ = function (sel, ctx) {
  return Array.from((ctx || document).querySelectorAll(sel));
};
function pad(n) {
  return String(n).padStart(2, "0");
}
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Toast */
var _toastTimer = null;
function toast(msg, ms) {
  var el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () {
    el.classList.remove("show");
  }, ms || 2600);
}

/* ── ANTI-SPAM ────────────────────────────────────────────────
   ① 허니팟 필드 — 봇만 채우는 숨겨진 입력란
   ② 최소 소요 시간 — 2초 미만이면 봇으로 간주
   ③ 쿨다운 — 60초 안에 같은 폼 재제출 방지
   ④ 텍스트 패턴 — URL 2개 이상 or 6자 이상 반복 문자 감지
   ─────────────────────────────────────────────────────────── */
var _spam = {
  openedAt: {} /* { formId: timestamp } */,
  lastSentAt: {} /* { formId: timestamp } */,
  MIN_MS: 2000 /* 제출까지 최소 2초     */,
  COOL_MS: 60000 /* 재제출까지 60초 쿨다운 */,
};

function spamOpen(id) {
  /* 폼이 처음 열리거나 포커스될 때 호출 */
  if (!_spam.openedAt[id]) {
    _spam.openedAt[id] = Date.now();
  }
}

function spamCheck(id, honeypot, text) {
  /* 반환값: null = 정상 / 문자열 = 오류 메시지 */

  /* ① 허니팟 필드가 채워졌으면 봇 */
  if (honeypot && honeypot.trim()) {
    return "잘못된 요청입니다.";
  }

  /* ② 너무 빨리 제출 → 봇 의심 */
  var elapsed = Date.now() - (_spam.openedAt[id] || 0);
  if (elapsed < _spam.MIN_MS) {
    return "잠시 후 다시 시도해주세요.";
  }

  /* ③ 쿨다운 미경과 */
  var gap = Date.now() - (_spam.lastSentAt[id] || 0);
  if (gap < _spam.COOL_MS) {
    var secs = Math.ceil((_spam.COOL_MS - gap) / 1000);
    return secs + "초 후 다시 제출할 수 있습니다.";
  }

  /* ④ 텍스트 스팸 패턴 */
  if (text) {
    if ((text.match(/https?:\/\//gi) || []).length > 1) {
      return "링크가 포함된 메시지는 등록할 수 없습니다.";
    }
    if (/(.)\1{5,}/.test(text)) {
      return "비정상적인 입력이 감지되었습니다.";
    }
  }

  return null; /* 정상 */
}

function spamMark(id) {
  _spam.lastSentAt[id] = Date.now();
}

/* ── SHEETS SUBMIT ────────────────────────────────────────────
   Google Apps Script 웹앱으로 폼 데이터를 전송합니다.
   application/x-www-form-urlencoded 방식 사용.
   GAS는 요청 시 script.google.com → script.googleusercontent.com
   으로 리다이렉트하기 때문에 일반 fetch는 CORS 차단됩니다.
   mode:'no-cors' 로 오류 없이 전송 — 데이터는 정상 저장되고
   응답 본문만 읽을 수 없으므로 낙관적(optimistic) 성공 처리.
   ─────────────────────────────────────────────────────────── */
function sheetsSubmit(payload, onOk, onErr) {
  if (!CONFIG.sheetsUrl) {
    /* sheetsUrl 미설정 = 데모 모드 */
    if (onOk) {
      onOk({ result: "success", _demo: true });
    }
    return;
  }
  fetch(CONFIG.sheetsUrl, {
    method: "POST",
    mode: "no-cors" /* GAS 리다이렉트로 인한 CORS 차단 우회 */,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
  })
    .then(function () {
      /* no-cors: 응답 본문을 읽을 수 없음 → 낙관적 성공 처리   */
      /* 데이터는 Google Sheets에 정상 저장됨                    */
      if (onOk) {
        onOk({ result: "success" });
      }
    })
    .catch(function () {
      if (onErr) {
        onErr("네트워크 오류. 다시 시도해주세요.");
      }
    });
}

/* ── LUCIDE ICONS ─────────────────────────────────────────── */
/* Initialise all data-lucide icons in the document            */
function initIcons() {
  if (window.lucide && typeof lucide.createIcons === "function") {
    lucide.createIcons();
  }
}

/* ── COUNTDOWN ───────────────────────────────────────────────*/
(function initCountdown() {
  var dEl = $("#cnt-days"),
    hEl = $("#cnt-hours"),
    mEl = $("#cnt-mins"),
    sEl = $("#cnt-secs");
  if (!dEl) return;

  function tick() {
    var diff = CONFIG.weddingDate - Date.now();
    if (diff <= 0) {
      var box = $("#countdown");
      if (box)
        box.innerHTML =
          '<p style="font-family:var(--serif);font-style:italic;font-size:.9rem;letter-spacing:.1em;color:var(--muted);">D - Day</p>';
      return;
    }
    var s = Math.floor(diff / 1000);
    dEl.textContent = Math.floor(s / 86400);
    hEl.textContent = pad(Math.floor((s % 86400) / 3600));
    mEl.textContent = pad(Math.floor((s % 3600) / 60));
    sEl.textContent = pad(s % 60);
  }
  tick();
  setInterval(tick, 1000);
})();

/* ── SCROLL REVEAL (IntersectionObserver) ────────────────────
   Progressive enhancement:
   - JS adds 'io-ready' to <html> → CSS sets initial opacity:0
   - Observer adds 'in-view' when element enters viewport
   - Without JS / on error → content is always visible         */
(function initReveal() {
  if (!("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("io-ready");

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08 },
  );

  $$(".reveal").forEach(function (el) {
    observer.observe(el);
  });
})();

/* ── SCROLL IMAGE (parallax + reveal) ───────────────────────
   ① IntersectionObserver → .is-visible → CSS fade+scale-in
   ② scroll 이벤트 → translateY ±24 px 패럴랙스
   ─────────────────────────────────────────────────────────── */
(function initScrollImg() {
  /* .scroll-img-section 이 여러 개여도 모두 처리 */
  var sections = $$(".scroll-img-section");
  if (!sections.length) return;

  sections.forEach(function (section) {
    var photo = section.querySelector(".scroll-img__photo");
    var caption = section.querySelector(".scroll-img__caption-text");
    if (!photo) return;

    /* ① 뷰포트 진입: 이미지 페이드+스케일, 캡션 페이드+상승 */
    if ("IntersectionObserver" in window) {
      var revealObs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              photo.classList.add("is-visible");
              if (caption) caption.classList.add("is-visible");
              revealObs.unobserve(section);
            }
          });
        },
        { threshold: 0.06 },
      );
      revealObs.observe(section);
    } else {
      photo.classList.add("is-visible");
      if (caption) caption.classList.add("is-visible");
    }

    /* ② 스크롤 패럴랙스 — 이미지 ±24 px 수직 이동
       캡션은 반대 방향으로 절반 속도(±10 px)로 이동해
       레이어 깊이감을 줍니다.                          */
    function tick() {
      var rect = section.getBoundingClientRect();
      var wh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > wh) return;
      var progress = (wh - rect.top) / (wh + rect.height); /* 0 → 1 */
      var shift = (progress - 0.5) * 48; /* ±24 px */

      if (photo.classList.contains("is-visible")) {
        photo.style.transform =
          "translateY(" + shift.toFixed(1) + "px) scale(1)";
      }
      /* 캡션: 반대 방향 절반 속도 → 패럴랙스 레이어 깊이감 */
      if (caption && caption.classList.contains("is-visible")) {
        var captionShift = (progress - 0.5) * -20; /* ±10 px, 반대 */
        caption.style.transform =
          "translateY(" + captionShift.toFixed(1) + "px)";
      }
    }
    window.addEventListener("scroll", tick, { passive: true });
    tick();
  });
})();

/* ── PETALS ──────────────────────────────────────────────────
   Creates N <div class="petal"> elements inside #petals-canvas.
   Size, position, duration, delay are randomised per petal.
   ─────────────────────────────────────────────────────────── */
(function initPetals() {
  var canvas = document.getElementById("petals-canvas");
  if (!canvas) return;

  var N = 22;
  for (var i = 0; i < N; i++) {
    var p = document.createElement("div");
    p.className = "petal";

    var size = 6 + Math.random() * 9; /* 6–15 px        */
    var left = Math.random() * 106 - 3; /* -3 % – 103 %   */
    var dur = 10 + Math.random() * 12; /* 10–22 s        */
    var delay = -Math.random() * 20; /* already in-flight */

    p.style.cssText =
      "left:" +
      left.toFixed(1) +
      "%;" +
      "width:" +
      size.toFixed(1) +
      "px;" +
      "height:" +
      size.toFixed(1) +
      "px;" +
      "animation-duration:" +
      dur.toFixed(1) +
      "s;" +
      "animation-delay:" +
      delay.toFixed(1) +
      "s;";

    canvas.appendChild(p);
  }
})();

/* ── GALLERY MODAL ───────────────────────────────────────────
   CONFIG.galleryImages 배열로 그리드를 동적 생성합니다.
   이미지 추가 시 CONFIG.galleryImages 에만 항목을 추가하세요.
   총 개수 % 3 자동 처리:
     나머지 2 → 마지막 이미지 wide(2칸)
     나머지 1 → 마지막 이미지 fullrow(3칸 전체)
   ─────────────────────────────────────────────────────────── */
(function initGallery() {
  var modal = $("#gallery-modal");
  if (!modal) return;

  var grid = $(".gallery__grid");
  var modalImg = $("#gallery-modal-img");
  var counter = $("#gallery-modal-counter");
  var btnPrev = $(".gallery-modal__prev", modal);
  var btnNext = $(".gallery-modal__next", modal);
  var btnClose = $(".gallery-modal__close", modal);
  var backdrop = $(".gallery-modal__backdrop", modal);

  var srcs = [];
  var current = 0;

  /* ── 모달 표시 / 닫기 ──────────────────────────────── */
  function show(idx) {
    if (!srcs.length) return;
    current = (idx + srcs.length) % srcs.length;
    modalImg.style.animation = "none";
    modalImg.offsetHeight; /* reflow */
    modalImg.style.animation = "";
    modalImg.src = srcs[current];
    modalImg.alt = "사진 " + (current + 1);
    if (counter) counter.textContent = current + 1 + " / " + srcs.length;
  }
  function open(idx) {
    show(idx);
    modal.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    if (btnClose) btnClose.focus();
  }
  function close() {
    modal.setAttribute("hidden", "");
    document.body.style.overflow = "";
    var focused = $$(".gallery__item")[current];
    if (focused) focused.focus();
  }

  /* ── 그리드 빌드: CONFIG.galleryImages → DOM ─────────── */
  if (grid && CONFIG.galleryImages && CONFIG.galleryImages.length) {
    var imgs = CONFIG.galleryImages.map(function (im) {
      return Object.assign({}, im);
    });

    /* 마지막 행 빈칸 자동 보정 */
    var rem = imgs.length % 3;
    if (rem === 2) imgs[imgs.length - 1].wide = true; /* span 2 */
    if (rem === 1) imgs[imgs.length - 1].fullrow = true; /* span 3 */

    grid.innerHTML = "";
    imgs.forEach(function (imgCfg, idx) {
      var cls = "gallery__item";
      if (imgCfg.fullrow) cls += " gallery__item--fullrow";
      else if (imgCfg.wide) cls += " gallery__item--wide";

      var btn = document.createElement("button");
      btn.className = cls;
      btn.setAttribute("data-idx", String(idx));
      btn.setAttribute("aria-label", "사진 " + (idx + 1) + " 크게 보기");

      var imgEl = document.createElement("img");
      imgEl.src = imgCfg.src;
      imgEl.alt = imgCfg.alt || "커플 사진 " + (idx + 1);
      imgEl.loading = "lazy";
      btn.appendChild(imgEl);
      grid.appendChild(btn);

      btn.addEventListener(
        "click",
        (function (i) {
          return function () {
            open(i);
          };
        })(idx),
      );
      btn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          btn.click();
        }
      });
    });

    srcs = imgs.map(function (c) {
      return c.src;
    });
  }

  if (!srcs.length) return;

  /* ── 모달 버튼 / 키보드 / 스와이프 이벤트 ───────────── */
  if (btnPrev)
    btnPrev.addEventListener("click", function () {
      show(current - 1);
    });
  if (btnNext)
    btnNext.addEventListener("click", function () {
      show(current + 1);
    });
  if (btnClose) btnClose.addEventListener("click", close);
  if (backdrop) backdrop.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (modal.hasAttribute("hidden")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
  var touchStartX = 0;
  modal.addEventListener(
    "touchstart",
    function (e) {
      touchStartX = e.changedTouches[0].clientX;
    },
    { passive: true },
  );
  modal.addEventListener(
    "touchend",
    function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 48) dx < 0 ? show(current + 1) : show(current - 1);
    },
    { passive: true },
  );
})();

/* ── ACCORDION (max-height animation) ───────────────────────*/
(function initAccordion() {
  $$(".accordion__btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var isOpen = btn.getAttribute("aria-expanded") === "true";
      var bodyId = btn.getAttribute("aria-controls");
      var body = bodyId ? $("#" + bodyId) : btn.nextElementSibling;
      if (!body) return;

      btn.setAttribute("aria-expanded", String(!isOpen));
      if (isOpen) {
        body.classList.remove("open");
      } else {
        body.classList.add("open");
      }
    });
  });
})();

/* ── COPY TO CLIPBOARD ───────────────────────────────────────*/
(function initCopy() {
  $$(".copy-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      if (!text) return;

      function onOk() {
        btn.classList.add("copied");
        var span = btn.querySelector("span");
        var orig = span ? span.textContent : "";
        if (span) span.textContent = "완료 ✓";
        toast("계좌번호가 복사되었습니다.");
        setTimeout(function () {
          btn.classList.remove("copied");
          if (span) span.textContent = orig;
        }, 2200);
      }

      function fallback() {
        var inp = document.createElement("input");
        inp.value = text;
        inp.style.cssText =
          "position:fixed;top:-9999px;left:-9999px;opacity:0;";
        document.body.appendChild(inp);
        inp.select();
        inp.setSelectionRange(0, 9999);
        try {
          document.execCommand("copy");
          onOk();
        } catch (e) {
          toast("직접 길게 눌러 복사해주세요.");
        }
        document.body.removeChild(inp);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onOk, fallback);
      } else {
        fallback();
      }
    });
  });
})();

/* ── GUESTBOOK ───────────────────────────────────────────────*/
(function initGuestbook() {
  var form = $("#guestbook-form");
  var list = $("#guestbook-list");
  var msgArea = $("#gb-message");
  var cntEl = $("#gb-count");
  if (!form || !list) return;

  /* Google Sheets 에서 가져온 방명록 캐시 (JSONP 응답) */
  var _sheetsEntries = null;

  /* Storage */
  function load() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.guestbookKey) || "[]");
    } catch (e) {
      return [];
    }
  }
  function save(entries) {
    localStorage.setItem(CONFIG.guestbookKey, JSON.stringify(entries));
  }

  /* Simple non-cryptographic hash (UI-only protection) */
  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
      h |= 0;
    }
    return h.toString(36);
  }

  function formatDt(d) {
    var dt = new Date(d);
    return (
      dt.getFullYear() +
      "." +
      pad(dt.getMonth() + 1) +
      "." +
      pad(dt.getDate()) +
      " " +
      pad(dt.getHours()) +
      ":" +
      pad(dt.getMinutes())
    );
  }

  /* Sheets 날짜 → '연.월.일 시:분' 변환
     처리 대상 형식:
       ① 'yyyy-MM-dd HH:mm:ss'          — GAS Utilities.formatDate 출력
       ② 'yyyy-MM-ddTHH:mm:ssZ'         — JSON.stringify(Date) ISO UTC
       ③ 'Sun May 24 2026 17:01:51 GMT+0900 (한국 표준시)' — GAS String(Date)
     ① 은 정규식으로 직접 파싱(빠름).
     ②③ 은 new Date() 로 파싱 → getTime() 기준 KST +9h 보정. */
  function formatSheetsDate(str) {
    if (!str) return "";
    var s = String(str);

    /* ① 'yyyy-MM-dd HH:mm:ss' 또는 'yyyy-MM-ddTHH:mm:ss' */
    var m = s.match(/(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})/);
    if (m) return m[1] + "." + m[2] + "." + m[3] + " " + m[4] + ":" + m[5];

    /* ②③ 그 외 모든 형식 — new Date() 파싱 후 UTC+9 로 변환 */
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      var kst = new Date(d.getTime() + 9 * 3600 * 1000);
      return (
        kst.getUTCFullYear() +
        "." +
        pad(kst.getUTCMonth() + 1) +
        "." +
        pad(kst.getUTCDate()) +
        " " +
        pad(kst.getUTCHours()) +
        ":" +
        pad(kst.getUTCMinutes())
      );
    }

    return s; /* 파싱 불가 시 원본 반환 */
  }

  /* ── Google Sheets 방명록 JSONP 조회 ─────────────────────
     GAS doGet?action=guestbook&callback=xxx 로 요청.
     CORS 우회: <script> 태그 동적 삽입 (JSONP 패턴).
     8초 타임아웃 후에도 로컬 항목만 표시하도록 fallback.
     ─────────────────────────────────────────────────────── */
  function fetchSheetsGuestbook() {
    if (!CONFIG.sheetsUrl) return;
    var cbName = "_gbSheet" + Date.now();
    var script = document.createElement("script");
    var done = false;

    var tid = setTimeout(function () {
      if (!done) {
        done = true;
        cleanup();
        /* 타임아웃 — 로컬 항목만 표시 */
        if (_sheetsEntries === null) {
          _sheetsEntries = [];
          render();
        }
      }
    }, 8000);

    function cleanup() {
      clearTimeout(tid);
      try {
        delete window[cbName];
      } catch (ex) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cbName] = function (data) {
      if (done) return;
      done = true;
      cleanup();
      _sheetsEntries =
        data && data.result === "success" ? data.entries || [] : [];
      render();
    };

    script.onerror = function () {
      if (!done) {
        done = true;
        cleanup();
        if (_sheetsEntries === null) {
          _sheetsEntries = [];
          render();
        }
      }
    };

    script.src =
      CONFIG.sheetsUrl +
      "?action=guestbook&callback=" +
      encodeURIComponent(cbName);
    document.head.appendChild(script);
  }

  /* ── Render ───────────────────────────────────────────────
     ① Sheets 항목을 기준으로 표시 (서버 타임스탬프 사용)
     ② 로컬에 동일 항목이 있으면 id/ph(password hash)를 연결
        → 삭제 버튼 활성화
     ③ 아직 Sheets에 없는 로컬 전용 항목(방금 제출된 것 등)
        도 함께 표시
     ─────────────────────────────────────────────────────── */
  function render() {
    var localEntries = load();

    /* 로컬 항목 → name+msg 키맵 (삭제 권한 연결용) */
    var localMap = Object.create(null);
    localEntries.forEach(function (le) {
      localMap[le.name + "\x00" + le.msg] = le;
    });

    var combined = [];

    /* Sheets 항목 추가 */
    if (_sheetsEntries && _sheetsEntries.length) {
      _sheetsEntries.forEach(function (se) {
        var key = se.name + "\x00" + se.msg;
        var loc = localMap[key];
        combined.push({
          name: se.name,
          msg: se.msg,
          date: formatSheetsDate(se.date),
          id: loc ? loc.id : null,
          ph: loc ? loc.ph : null,
        });
        if (loc) delete localMap[key]; /* 중복 제거 */
      });
    }

    /* 아직 Sheets에 없는 로컬 전용 항목 추가 */
    Object.keys(localMap).forEach(function (k) {
      var le = localMap[k];
      combined.push({
        name: le.name,
        msg: le.msg,
        date: le.date,
        id: le.id,
        ph: le.ph,
      });
    });

    /* 최신순 정렬 */
    combined.sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });

    list.innerHTML = "";

    if (!combined.length) {
      list.innerHTML =
        '<p class="gb-empty">아직 방명록이 없습니다.<br>첫 번째로 메시지를 남겨보세요.</p>';
      return;
    }

    combined.forEach(function (e) {
      var el = document.createElement("article");
      el.className = "gb-entry";
      /* 삭제 버튼: 이 기기에서 등록한 항목(id+ph 보유)만 표시 */
      var delBtn =
        e.id && e.ph
          ? '<button class="gb-entry__del" type="button" aria-label="삭제">삭제</button>'
          : "";
      el.innerHTML =
        '<div class="gb-entry__top">' +
        '<span class="gb-entry__name">' +
        esc(e.name) +
        "</span>" +
        '<span class="gb-entry__right">' +
        '<span class="gb-entry__date">' +
        e.date +
        "</span>" +
        delBtn +
        "</span>" +
        "</div>" +
        '<p class="gb-entry__msg">' +
        esc(e.msg).replace(/\n/g, "<br>") +
        "</p>";
      if (e.id && e.ph) {
        (function (id, ph) {
          el.querySelector(".gb-entry__del").addEventListener(
            "click",
            function () {
              openPwModal(id, ph);
            },
          );
        })(e.id, e.ph);
      }
      list.appendChild(el);
    });
  }

  /* 폼 첫 상호작용 시 스팸 타이머 시작 */
  ["focusin", "input"].forEach(function (ev) {
    form.addEventListener(
      ev,
      function () {
        spamOpen("guestbook");
      },
      { once: true },
    );
  });

  /* Submit */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("#gb-name").value.trim();
    var pw = $("#gb-password").value.trim();
    var msg = msgArea.value.trim();
    var hpEl = form.querySelector('[name="website"]');
    var hpVal = hpEl ? hpEl.value : "";

    if (!name || !pw || !msg) {
      toast("이름, 비밀번호, 메시지를 입력해주세요.");
      return;
    }
    if (msg.length > 200) {
      toast("메시지는 200자 이내로 입력해주세요.");
      return;
    }

    /* 스팸 검사 */
    var spamErr = spamCheck("guestbook", hpVal, msg);
    if (spamErr) {
      toast(spamErr);
      return;
    }

    /* localStorage 저장 — 즉시 화면에 표시 */
    var entries = load();
    entries.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name,
      msg: msg,
      ph: hash(pw),
      date: formatDt(Date.now()),
    });
    save(entries);
    form.reset();
    if (cntEl) cntEl.textContent = "0 / 200";
    render();
    toast("메시지가 등록되었습니다.");
    spamMark("guestbook");

    /* Google Sheets 전송 (백그라운드 — 실패해도 UI 영향 없음) */
    sheetsSubmit(
      {
        type: "guestbook",
        name: name,
        message: msg,
        website: hpVal,
      },
      null,
      function (err) {
        console.warn("[Guestbook → Sheets] 전송 오류:", err);
      },
    );
  });

  /* Char counter */
  if (msgArea && cntEl) {
    msgArea.addEventListener("input", function () {
      cntEl.textContent = msgArea.value.length + " / 200";
    });
  }

  /* Password modal */
  var modal = $("#pw-modal");
  var pwInput = $("#pw-modal-input");
  var btnCancel = $("#pw-modal-cancel");
  var btnConf = $("#pw-modal-confirm");
  var _pendingId = null;
  var _pendingPh = null;

  function openPwModal(id, ph) {
    _pendingId = id;
    _pendingPh = ph;
    if (pwInput) {
      pwInput.value = "";
      pwInput.placeholder = " ";
    }
    modal.removeAttribute("hidden");
    setTimeout(function () {
      pwInput && pwInput.focus();
    }, 50);
  }
  function closePwModal() {
    modal.setAttribute("hidden", "");
    _pendingId = null;
    _pendingPh = null;
  }
  function tryDelete() {
    var val = pwInput ? pwInput.value.trim() : "";
    if (hash(val) === _pendingPh) {
      save(
        load().filter(function (e) {
          return e.id !== _pendingId;
        }),
      );
      render();
      toast("삭제되었습니다.");
      closePwModal();
    } else {
      pwInput.value = "";
      pwInput.style.animation = "none";
      pwInput.offsetHeight;
      pwInput.style.animation = "shake .35s ease";
      toast("비밀번호가 일치하지 않습니다.");
    }
  }

  if (btnCancel) btnCancel.addEventListener("click", closePwModal);
  if (btnConf) btnConf.addEventListener("click", tryDelete);
  if (pwInput)
    pwInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") tryDelete();
    });
  if (modal)
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closePwModal();
    });

  /* Shake keyframe */
  var s = document.createElement("style");
  s.textContent =
    "@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}";
  document.head.appendChild(s);

  /* 초기 렌더: 로컬 항목 즉시 표시 후 Sheets 조회 시작 */
  render();
  fetchSheetsGuestbook();
})();

/* ── RSVP FORM ───────────────────────────────────────────────*/
(function initRSVP() {
  var form = $("#rsvp-form");
  var result = $("#rsvp-result");
  var btn = $("#rsvp-submit");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("#rsvp-name").value.trim();
    var phone = $("#rsvp-phone").value.trim();
    var att = $('input[name="attendance"]:checked');
    if (!name) {
      toast("이름을 입력해주세요.");
      $("#rsvp-name").focus();
      return;
    }
    if (!phone) {
      toast("연락처를 입력해주세요.");
      $("#rsvp-phone").focus();
      return;
    }
    if (!att) {
      toast("참석 여부를 선택해주세요.");
      return;
    }

    /* Demo mode if Formspree ID not set */
    if (form.action.includes("YOUR_FORM_ID")) {
      if (result) {
        result.textContent = "(데모) 전달 완료! Formspree ID를 교체해주세요.";
        result.className = "rsvp-form__result ok";
      }
      toast("✓ 전달 완료 (데모 모드)");
      return;
    }

    btn.disabled = true;
    btn.textContent = "전송 중…";

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    })
      .then(function (res) {
        if (res.ok) {
          if (result) {
            result.textContent = "참석 의사가 전달되었습니다. 감사합니다.";
            result.className = "rsvp-form__result ok";
          }
          toast("✓ 전달 완료!");
          form.reset();
        } else {
          throw new Error("서버 오류");
        }
      })
      .catch(function (err) {
        if (result) {
          result.textContent = "전송에 실패했습니다. 다시 시도해주세요.";
          result.className = "rsvp-form__result err";
        }
        toast("전송 실패. 다시 시도해주세요.");
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "참석 의사 전달하기";
      });
  });
})();

/* ── RSVP MODAL (auto-open on page load) ─────────────────────
   Opens 400 ms after page load so the page has time to paint.
   Closes on ✕ button / backdrop click / Esc / skip link.
   On successful Formspree submit, auto-closes after 2 s.
   ─────────────────────────────────────────────────────────── */
(function initRSVPModal() {
  var modal = document.getElementById("rsvp-modal");
  var backdrop = document.getElementById("rsvp-modal-backdrop");
  var btnClose = document.getElementById("rsvp-modal-close");
  var btnSkip = document.getElementById("rsvp-modal-skip");
  var form = document.getElementById("rsvp-m-form");
  var result = document.getElementById("rsvp-m-result");
  var btn = document.getElementById("rsvp-m-submit");
  if (!modal) return;

  function openModal() {
    modal.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    spamOpen("rsvp"); /* 모달 열린 시각 기록 */
    /* Ensure lucide icons inside modal are rendered */
    if (window.lucide && typeof lucide.createIcons === "function") {
      lucide.createIcons({ nodes: [modal] });
    }
  }

  function closeModal() {
    modal.setAttribute("hidden", "");
    document.body.style.overflow = "";
  }

  /* Auto-open: 400 ms delay lets the page render first */
  setTimeout(openModal, 400);

  /* Close triggers */
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnSkip) btnSkip.addEventListener("click", closeModal);
  if (backdrop) backdrop.addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) {
    if (!modal.hasAttribute("hidden") && e.key === "Escape") closeModal();
  });

  /* Form submit */
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var nameEl = document.getElementById("rsvp-m-name");
    var att = form.querySelector('input[name="m-attendance"]:checked');
    var hpEl = form.querySelector('[name="website"]');
    var hpVal = hpEl ? hpEl.value : "";

    /* 필수 입력 검사 */
    if (!nameEl || !nameEl.value.trim()) {
      toast("이름을 입력해주세요.");
      if (nameEl) {
        nameEl.focus();
      }
      return;
    }
    if (!att) {
      toast("참석 여부를 선택해주세요.");
      return;
    }

    /* 스팸 검사 */
    var spamErr = spamCheck("rsvp", hpVal, nameEl.value);
    if (spamErr) {
      toast(spamErr);
      return;
    }

    /* sheetsUrl 미설정 = 데모 모드 */
    if (!CONFIG.sheetsUrl) {
      if (result) {
        result.textContent =
          "(데모) 전달 완료! Apps Script URL을 입력해주세요.";
        result.className = "rsvp-form__result ok";
      }
      toast("✓ 전달 완료 (데모 모드)");
      spamMark("rsvp");
      setTimeout(closeModal, 1800);
      return;
    }

    var mealEl = form.querySelector('input[name="m-meal"]:checked');
    var guestsEl = document.getElementById("rsvp-m-guests");

    btn.disabled = true;
    btn.textContent = "전송 중…";

    sheetsSubmit(
      {
        type: "rsvp",
        name: nameEl.value.trim(),
        attendance: att.value,
        meal: mealEl ? mealEl.value : "-",
        guests: guestsEl ? guestsEl.value : "1",
        website: hpVal,
      },
      function () {
        /* 성공 */
        if (result) {
          result.textContent = "참석 의사가 전달되었습니다. 감사합니다.";
          result.className = "rsvp-form__result ok";
        }
        toast("✓ 전달 완료!");
        form.reset();
        spamMark("rsvp");
        btn.disabled = false;
        btn.textContent = "참석 의사 전달하기";
        setTimeout(closeModal, 2000);
      },
      function (errMsg) {
        /* 실패 */
        if (result) {
          result.textContent = errMsg || "전송 실패. 다시 시도해주세요.";
          result.className = "rsvp-form__result err";
        }
        toast("전송 실패. 다시 시도해주세요.");
        btn.disabled = false;
        btn.textContent = "참석 의사 전달하기";
      },
    );
  });
})();

/* ── INIT LUCIDE ICONS ───────────────────────────────────────*/
/* Must run last so all data-lucide elements exist in DOM      */
initIcons();
