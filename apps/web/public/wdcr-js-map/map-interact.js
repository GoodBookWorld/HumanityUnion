function isTouchEnabled() {
  return (("ontouchstart" in window)
    || (navigator.MaxTouchPoints > 0)
    || (navigator.msMaxTouchPoints > 0));
}
jQuery(function () {
  jQuery("path[id^=wdcrjs]").each(function (i, e) {
    wdcraddEvent( jQuery(e).attr("id"));
  });
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
      jQuery("#wdcrjstip").show().html(wdcrjsconfig[id].hover);
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
        jQuery("#wdcrjstip").show().html(wdcrjsconfig[id].hover);
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