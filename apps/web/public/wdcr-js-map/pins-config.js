var pins_config = {
  "pins":[
  {
    "shape": "#",//either "circle" or "square"
    "hover": "<b><u>WASHINGTON DC</u></b><br>Write any text and load images<br><img src='example.png'>",//info of the popup
    "pos_X": 215,//check the X, Y coordinates guide in the documentation
    "pos_Y": 154,
    "size": 11,//size of the pin
    "outline": "#000080",//outline color of the pin
    "upColor": "#1a1aff",//color of the pin when map load
    "overColor": "#66d9ff",//color of the pin when mouse hover
    "url": "https://www.html5interactivemaps.com/",//link to any webpage
    "target": "same_window",// use "same_window", "same_window", "modal", or "none"
    "active": false//true/false to activate/deactivate this pin
  },
  {
    "shape": "#",
    "hover": "<b><u>LOS ANGELES</u></b><br><span style='color: #bcbcbc;'>Street Address:</span><br>&nbsp;321 Example, Address 54321<br><span style='color: #bcbcbc;'>Telephone:</span><br>&nbsp;(256) 555-4321 / (256) 555-1234",
    "pos_X": 83,
    "pos_Y": 164,
    "size": 13,
    "outline": "#660000",
    "upColor": "#e60000",
    "overColor": "#ffd480",
    "url": "https://www.html5interactivemaps.com/",
    "target": "same_window",
    "active": false
  },
  {
    "shape": "square",
    "hover": "<b><u>Presidential system</u></b><span style='color: #999;'></span><br><span style='color: #0174b0;'><b>Presidential republics</b></span>",
    "pos_X": 10,
    "pos_Y": 250,
    "size": 12,
    "outline": "#0174b0",
    "upColor": "#0174b0",
    "overColor": "#0174b0",
    "url": "https://en.wikipedia.org/wiki/Presidential_system",
    "target": "same_window",
    "active": true
  },
  {
    "shape": "square",
    "hover": "<b><u>Presidential system</u></b><span style='color: #999;'></span><br><span style='color: #F2E353;'><b>Semi-presidential republic</b></span>",
    "pos_X": 10,
    "pos_Y": 270,
    "size": 12,
    "outline": "#F2E353",
    "upColor": "#F2E353",
    "overColor": "#F2E353",
    "url": "https://en.wikipedia.org/wiki/Semi-presidential_republic",
    "target": "same_window",
    "active": true
  },
  {
    "shape": "square",
    "hover": "<b><u>Republics with an executive president</u></b><span style='color: #999;'></span><br><span style='color: #7FB566;'><b>Elected or appointed president</b></span>",
    "pos_X": 10,
    "pos_Y": 290,
    "size": 12,
    "outline": "#7FB566",
    "upColor": "#7FB566",
    "overColor": "#7FB566",
    "url": "https://en.wikipedia.org/wiki/Confidence_and_supply",
    "target": "same_window",
    "active": true
  },
  {
    "shape": "square",
    "hover": "<b><u>Parliamentary constitutional monarchies</u></b><span style='color: #999;'></span><br><span style='color: #D6615D;'><b>Constitutional monarchy</b></span>",
    "pos_X": 10,
    "pos_Y": 310,
    "size": 12,
    "outline": "#D6615D",
    "upColor": "#D6615D",
    "overColor": "#D6615D",
    "url": "https://en.wikipedia.org/wiki/Constitutional_monarchy",
    "target": "same_window",
    "active": true
  },
  {
    "shape": "square",
    "hover": "<b><u>Parliamentary republics</u></b><span style='color: #999;'></span><br><span style='color: #ff6666;'><b>Parliamentary system of government</b></span>",
    "pos_X": 10,
    "pos_Y": 330,
    "size": 12,
    "outline": "#F29E46",
    "upColor": "#F29E46",
    "overColor": "#F29E46",
    "url": "https://en.wikipedia.org/wiki/Parliamentary_republic",
    "target": "same_window",
    "active": true
  },
  {
    "shape": "square",
    "hover": "<b><u>Parliamentary constitutional monarchy</u></b><span style='color: #999;'></span><br><span style='color: #ff6666;'><b>Parliamentary constitutional monarchy</b></span>",
    "pos_X": 10,
    "pos_Y": 350,
    "size": 12,//change the size to display this pin
    "outline": "#D75EF9",
    "upColor": "#D75EF9",
    "overColor": "#D75EF9",
    "url": "#mymodal",
    "target": "same_window",
    "active": true
  },
  {
    "shape": "square",
    "hover": "<b><u>Absolute monarchies</u></b><span style='color: #999;'></span><br><span style='color: #ff6666;'><b>Absolute monarchies</b></span>",
    "pos_X": 10,
    "pos_Y": 370,
    "size": 12,//change the size to display this pin
    "outline": "#743181",
    "upColor": "#743181",
    "overColor": "#743181",
    "url": "https://en.wikipedia.org/wiki/Absolute_monarchy",
    "target": "same_window",
    "active": true
  },
  {
    "shape": "square",
    "hover": "<b><u>Military junta</u></b><span style='color: #999;'></span><br><span style='color: #ff6666;'><b>Constitutional provisions suspended</b></span>",
    "pos_X": 10,
    "pos_Y": 390,
    "size": 12,//change the size to display this pin
    "outline": "#758828",
    "upColor": "#758828",
    "overColor": "#758828",
    "url": "https://en.wikipedia.org/wiki/Military_junta",
    "target": "same_window",
    "active": true
  },
  {
    "shape": "square",
    "hover": "<b><u>One-party state</u></b><span style='color: #999;'></span><br><span style='color: #ff6666;'><b>Authoritarian regime</b></span>",
    "pos_X": 10,
    "pos_Y": 410,
    "size": 12,//change the size to display this pin
    "outline": "#A4713A",
    "upColor": "#A4713A",
    "overColor": "#A4713A",
    "url": "https://en.wikipedia.org/wiki/One-party_state",
    "target": "same_window",
    "active": true
  },
  {
    "shape": "square",
    "hover": "<b><u>Provisional government</u></b><span style='color: #999;'></span><br><span style='color: #ff6666;'><b>Unclear political situations</b></span>",
    "pos_X": 10,
    "pos_Y": 430,
    "size": 12,//change the size to display this pin
    "outline": "#818181",
    "upColor": "#818181",
    "overColor": "#818181",
    "url": "https://en.wikipedia.org/wiki/Provisional_government",
    "target": "same_window",
    "active": true
  },
  {
    "shape": "circle",
    "hover": "BLANK13",
    "pos_X": 200,
    "pos_Y": 400,
    "size": 0,//change the size to display this pin
    "outline": "#660000",
    "upColor": "#e60000",
    "overColor": "#ffd480",
    "url": "https://www.html5interactivemaps.com/",
    "target": "same_window",
    "active": false
  },
  {
    "shape": "circle",
    "hover": "BLANK14",
    "pos_X": 250,
    "pos_Y": 400,
    "size": 0,//change the size to display this pin
    "outline": "#660000",
    "upColor": "#e60000",
    "overColor": "#ffd480",
    "url": "https://www.html5interactivemaps.com/",
    "target": "same_window",
    "active": false
  },
  {
    "shape": "circle",
    "hover": "BLANK15",
    "pos_X": 300,
    "pos_Y": 400,
    "size": 0,//change the size to display this pin
    "outline": "#660000",
    "upColor": "#e60000",
    "overColor": "#ffd480",
    "url": "https://www.html5interactivemaps.com/",
    "target": "same_window",
    "active": false
  }// If you want to add more pin, you need to add comma ',' here
  ]
};

// The following is the script for pins interaction DON'T EDIT !!!
function isTouchEnabled() {
  return (("ontouchstart" in window)
    || (navigator.MaxTouchPoints > 0)
    || (navigator.msMaxTouchPoints > 0));
}
jQuery(function () {
  var pins_len = pins_config.pins.length;
  if(pins_len > 0) {
    var xmlns = "http://www.w3.org/2000/svg";
    var tsvg_obj = document.getElementById("wdcrjspins");
    var svg_circle, svg_rect;
    for (var i = 0; i < pins_len; i++) {
      if (pins_config.pins[i].shape === "circle") {
        svg_circle = document.createElementNS(xmlns, "circle");
        svg_circle.setAttributeNS(null, "cx", pins_config.pins[i].pos_X + 1);
        svg_circle.setAttributeNS(null, "cy", pins_config.pins[i].pos_Y + 1);
        svg_circle.setAttributeNS(null, "r", pins_config.pins[i].size / 2);
        svg_circle.setAttributeNS(null, "fill", "rgba(0, 0, 0, 0.5)");
        tsvg_obj.appendChild(svg_circle);
        svg_circle = document.createElementNS(xmlns, "circle");
        svg_circle.setAttributeNS(null, "cx", pins_config.pins[i].pos_X);
        svg_circle.setAttributeNS(null, "cy", pins_config.pins[i].pos_Y);
        svg_circle.setAttributeNS(null, "r", pins_config.pins[i].size / 2);
        svg_circle.setAttributeNS(null, "fill", pins_config.pins[i].upColor);
        svg_circle.setAttributeNS(null, "stroke", pins_config.pins[i].outline);
        svg_circle.setAttributeNS(null, "stroke-width", 1);
        svg_circle.setAttributeNS(null, "id", "wdcrjspins_" + i);
        tsvg_obj.appendChild(svg_circle);
        wdcrjsAddEvent(i);
      }
      else if (pins_config.pins[i].shape === "square") {
        svg_rect = document.createElementNS(xmlns, "rect");
        svg_rect.setAttributeNS(null, "x", pins_config.pins[i].pos_X - pins_config.pins[i].size / 2 + 1);
        svg_rect.setAttributeNS(null, "y", pins_config.pins[i].pos_Y - pins_config.pins[i].size / 2 + 1);
        svg_rect.setAttributeNS(null, "width", pins_config.pins[i].size);
        svg_rect.setAttributeNS(null, "height", pins_config.pins[i].size);
        svg_rect.setAttributeNS(null, "fill", "rgba(0, 0, 0, 0.5)");
        tsvg_obj.appendChild(svg_rect);
        svg_rect = document.createElementNS(xmlns, "rect");
        svg_rect.setAttributeNS(null, "x", pins_config.pins[i].pos_X - pins_config.pins[i].size / 2);
        svg_rect.setAttributeNS(null, "y", pins_config.pins[i].pos_Y - pins_config.pins[i].size / 2);
        svg_rect.setAttributeNS(null, "width", pins_config.pins[i].size);
        svg_rect.setAttributeNS(null, "height", pins_config.pins[i].size);
        svg_rect.setAttributeNS(null, "fill", pins_config.pins[i].upColor);
        svg_rect.setAttributeNS(null, "stroke", pins_config.pins[i].outline);
        svg_rect.setAttributeNS(null, "stroke-width", 1);
        svg_rect.setAttributeNS(null, "id", "wdcrjspins_" + i);
        tsvg_obj.appendChild(svg_rect);
        wdcrjsAddEvent(i);
      }
    }
  }
});
function wdcrjsAddEvent(id) {
  var obj = jQuery("#wdcrjspins_" + id);
  if(pins_config.pins[id].active === true){
    obj.attr({"cursor": "pointer"});
    obj.hover(function () {
      jQuery("#wdcrjstip").show().html(pins_config.pins[id].hover);
      obj.css({"fill":pins_config.pins[id].overColor});
    }, function () {
      jQuery("#wdcrjstip").hide();
      obj.css({"fill":pins_config.pins[id].upColor});
    });
    obj.mouseup(function(){
      obj.css({"fill":pins_config.pins[id].overColor});
      if (pins_config.pins[id].target === "same_window"){
        window.open(pins_config.pins[id].url);  
      } else if (pins_config.pins[id].target === "same_window") {
        window.parent.location.href = pins_config.pins[id].url;
      } else if (pins_config.pins[id].target === "modal") {
        jQuery(pins_config.pins[id].url).modal("show");
      }
    });
    obj.mousemove(function (e) {
      var x = e.pageX + 10, y = e.pageY + 15;
      var tipw =jQuery("#wdcrjstip").outerWidth(), tiph =jQuery("#wdcrjstip").outerHeight(),
      x = (x + tipw >jQuery(document).scrollLeft() +jQuery(window).width())? x - tipw - (20 * 2) : x ;
      y = (y + tiph >jQuery(document).scrollTop() +jQuery(window).height())? jQuery(document).scrollTop() +jQuery(window).height() - tiph - 10 : y ;
      jQuery("#wdcrjstip").css({left: x, top: y});
    });
    if (isTouchEnabled()) {
      obj.on("touchstart", function (e) {
        var touch = e.originalEvent.touches[0];
        var x = touch.pageX + 10, y = touch.pageY + 15;
        var tipw=jQuery("#wdcrjstip").outerWidth(), tiph=jQuery("#wdcrjstip").outerHeight(),
        x = (x + tipw >jQuery(document).scrollLeft() +jQuery(window).width())? x - tipw -(20 * 2) : x ;
        y =(y + tiph >jQuery(document).scrollTop() +jQuery(window).height())? jQuery(document).scrollTop() +jQuery(window).height() -tiph - 10 : y ;
        jQuery("#wdcrjstip").show().html(pins_config.pins[id].hover);
        jQuery("#wdcrjstip").css({left:x, top:y});
      });
      obj.on("touchend", function () {
        jQuery("#" + id).css({"fill":pins_config.pins[id].upColor});
        if (pins_config.pins[id].target === "same_window") {
          window.open(pins_config.pins[id].url);
        } else if (pins_config.pins[id].target === "same_window") {
          window.parent.location.href = pins_config.pins[id].url;
        } else if (pins_config.pins[id].target === "modal") {
          jQuery(pins_config.pins[id].url).modal("show");
        }
      });
    }
  }
}