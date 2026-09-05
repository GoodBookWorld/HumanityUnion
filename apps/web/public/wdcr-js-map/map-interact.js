function isTouchEnabled() {
  return (("ontouchstart" in window)
    || (navigator.MaxTouchPoints > 0)
    || (navigator.msMaxTouchPoints > 0));
}

/** Pack 08K.3.3 — locale-aware country display names injected by React parent. */
window.__HU_MAP_COUNTRY_NAMES = window.__HU_MAP_COUNTRY_NAMES || {};

function wdcrEscapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wdcrCountryCodeFromConfig(id) {
  var cfg = wdcrjsconfig[id];
  if (!cfg || typeof cfg.url !== "string") {
    return "";
  }
  var match = cfg.url.match(/\/countries\/([A-Za-z]{2})\b/);
  return match ? match[1].toUpperCase() : "";
}

function wdcrFlagHtmlFromHover(hover) {
  if (typeof hover !== "string") {
    return "";
  }
  var match = hover.match(/<img\b[^>]*>/i);
  return match ? match[0] : "";
}

function wdcrLocalizedHoverHtml(id) {
  var cfg = wdcrjsconfig[id];
  var code = wdcrCountryCodeFromConfig(id);
  var names = window.__HU_MAP_COUNTRY_NAMES || {};
  var displayName = (code && names[code]) ? names[code] : (code || id);
  var flag = wdcrFlagHtmlFromHover(cfg && cfg.hover);
  return "<b><u>" + wdcrEscapeHtml(displayName) + "</u></b>" + (flag ? "<br>" + flag : "");
}

jQuery(function () {
  jQuery("path[id^=wdcrjs]").each(function (i, e) {
    wdcraddEvent( jQuery(e).attr("id"));
  });
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(
      { source: "hu-world-map", type: "ready" },
      window.location.origin
    );
  }
});
function wdcraddEvent(id,relationId) {
  var _obj = jQuery("#" + id);
  var arr = id.split("");
  var _Textobj = jQuery("#" + id + "," + "#wdcrjsvn" + arr.slice(6).join(""));
  jQuery("#" + ["visnames"]).attr({"fill":wdcrjsconfig.general.visibleNames});
  _obj.attr({"fill":wdcrjsconfig[id].upColor, "stroke":wdcrjsconfig.general.borderColor});
  _Textobj.attr({"cursor": "default"});
  if (wdcrjsconfig[id].active === true) {
    _Textobj.attr({"cursor": "pointer"});
    _Textobj.hover(function () {
      jQuery("#wdcrjstip").show().html(wdcrLocalizedHoverHtml(id));
      _obj.css({"fill":wdcrjsconfig[id].overColor});
    }, function () {
      jQuery("#wdcrjstip").hide();
      jQuery("#" + id).css({"fill":wdcrjsconfig[id].upColor});
    });
    if (wdcrjsconfig[id].target !== "same_window") {
      _Textobj.mousedown(function () {
        jQuery("#" + id).css({"fill":wdcrjsconfig[id].downColor});
      });
    }
    _Textobj.mouseup(function () {
      jQuery("#" + id).css({
        fill: wdcrjsconfig[id].overColor,
      });

      if (wdcrjsconfig[id].target === "new_window") {
        window.open(wdcrjsconfig[id].url, "_blank", "noopener,noreferrer");
      } else if (wdcrjsconfig[id].target === "same_window") {
        window.open(wdcrjsconfig[id].url, "_top");
      } else if (wdcrjsconfig[id].target === "modal") {
        jQuery(wdcrjsconfig[id].url).modal("show");
      }
    });
    _Textobj.mousemove(function (e) {
      var x = e.pageX + 10, y = e.pageY + 15;
      var tipw =jQuery("#wdcrjstip").outerWidth(), tiph =jQuery("#wdcrjstip").outerHeight(),
      x = (x + tipw >jQuery(document).scrollLeft() +jQuery(window).width())? x - tipw - (20 * 2) : x ;
      y = (y + tiph >jQuery(document).scrollTop() +jQuery(window).height())? jQuery(document).scrollTop() +jQuery(window).height() - tiph - 10 : y ;
      jQuery("#wdcrjstip").css({left: x, top: y});
    });
    if (isTouchEnabled()) {
      _Textobj.on("touchstart", function (e) {
        var touch = e.originalEvent.touches[0];
        var x = touch.pageX + 10, y = touch.pageY + 15;
        var tipw =jQuery("#wdcrjstip").outerWidth(), tiph =jQuery("#wdcrjstip").outerHeight(),
        x = (x + tipw >jQuery(document).scrollLeft() +jQuery(window).width())? x - tipw -(20 * 2) : x ;
        y =(y + tiph >jQuery(document).scrollTop() +jQuery(window).height())? jQuery(document).scrollTop() +jQuery(window).height() -tiph - 10 : y ;
        jQuery("#" + id).css({"fill":wdcrjsconfig[id].downColor});
        jQuery("#wdcrjstip").show().html(wdcrLocalizedHoverHtml(id));
        jQuery("#wdcrjstip").css({left: x, top: y});
      });
      _Textobj.on("touchend", function () {
        jQuery("#" + id).css({"fill":wdcrjsconfig[id].upColor});
      if (wdcrjsconfig[id].target === "same_window") {
        window.open(wdcrjsconfig[id].url, "_top");
      } else if (wdcrjsconfig[id].target === "modal") {
          jQuery(wdcrjsconfig[id].url).modal("show");
        }
      });
    }
	}
}
/* PWA UX Correction Pack 03 — zoom / pan / reset (no new map library). */
(function () {
  var MIN_SCALE = 1;
  var MAX_SCALE = 2.5;
  var SCALE_STEP = 0.25;
  var scale = MIN_SCALE;
  var tx = 0;
  var ty = 0;
  var dragging = false;
  var panActive = false;
  var startX = 0;
  var startY = 0;
  var originTx = 0;
  var originTy = 0;
  var MESSAGE_SOURCE = "hu-world-map";
  var PAN_THRESHOLD = 8;

  function mapbase() {
    return document.getElementById("mapbase");
  }

  function wrapper() {
    return document.getElementById("mapwrapper");
  }

  function clampPan() {
    var base = mapbase();
    var wrap = wrapper();
    if (!base || !wrap || scale <= MIN_SCALE) {
      tx = 0;
      ty = 0;
      return;
    }
    var wrapRect = wrap.getBoundingClientRect();
    var maxX = (wrapRect.width * (scale - 1)) / 2;
    var maxY = (wrapRect.height * (scale - 1)) / 2;
    if (tx > maxX) tx = maxX;
    if (tx < -maxX) tx = -maxX;
    if (ty > maxY) ty = maxY;
    if (ty < -maxY) ty = -maxY;
  }

  function applyTransform() {
    var base = mapbase();
    if (!base) {
      return;
    }
    clampPan();
    base.style.transformOrigin = "center center";
    base.style.transform = "translate(" + tx + "px, " + ty + "px) scale(" + scale + ")";
    base.style.cursor = scale > MIN_SCALE ? "grab" : "";
    publishView();
  }

  function publishView() {
    if (!window.parent || window.parent === window) {
      return;
    }
    window.parent.postMessage(
      { source: MESSAGE_SOURCE, type: "view", scale: scale, x: tx, y: ty },
      window.location.origin
    );
  }

  function zoomIn() {
    scale = Math.min(MAX_SCALE, Math.round((scale + SCALE_STEP) * 100) / 100);
    applyTransform();
  }

  function zoomOut() {
    scale = Math.max(MIN_SCALE, Math.round((scale - SCALE_STEP) * 100) / 100);
    if (scale === MIN_SCALE) {
      tx = 0;
      ty = 0;
    }
    applyTransform();
  }

  function resetView() {
    scale = MIN_SCALE;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin) {
      return;
    }
    var data = event.data;
    if (!data || data.source !== MESSAGE_SOURCE) {
      return;
    }
    if (data.action === "zoomIn") zoomIn();
    else if (data.action === "zoomOut") zoomOut();
    else if (data.action === "reset") resetView();
    else if (data.action === "sync") publishView();
    else if (data.action === "setCountryNames" && data.names && typeof data.names === "object") {
      window.__HU_MAP_COUNTRY_NAMES = data.names;
    }
  });

  function onPointerDown(event) {
    if (scale <= MIN_SCALE) {
      return;
    }
    if (event.button != null && event.button !== 0) {
      return;
    }
    dragging = true;
    panActive = false;
    startX = event.clientX;
    startY = event.clientY;
    originTx = tx;
    originTy = ty;
  }

  function onPointerMove(event) {
    if (!dragging) {
      return;
    }
    var dx = event.clientX - startX;
    var dy = event.clientY - startY;
    if (!panActive && Math.abs(dx) < PAN_THRESHOLD && Math.abs(dy) < PAN_THRESHOLD) {
      return;
    }
    if (!panActive) {
      panActive = true;
      var base = mapbase();
      if (base) {
        base.style.cursor = "grabbing";
      }
    }
    tx = originTx + dx;
    ty = originTy + dy;
    applyTransform();
  }

  function onPointerUp() {
    if (!dragging) {
      return;
    }
    dragging = false;
    panActive = false;
    var base = mapbase();
    if (base) {
      base.style.cursor = scale > MIN_SCALE ? "grab" : "";
    }
  }

  function bindPan() {
    var wrap = wrapper();
    if (!wrap || wrap.getAttribute("data-hu-zoom-bound") === "1") {
      return;
    }
    wrap.setAttribute("data-hu-zoom-bound", "1");
    wrap.style.overflow = "hidden";
    wrap.style.touchAction = "pan-y";
    wrap.addEventListener("pointerdown", onPointerDown);
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerup", onPointerUp);
    wrap.addEventListener("pointercancel", onPointerUp);
    applyTransform();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPan);
  } else {
    bindPan();
  }
})();
