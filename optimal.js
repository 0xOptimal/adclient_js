/* Optimal ads JavaScript client
 *
 * Loads placement from Optimal decision API. Searches for elements with
 * `optimal-` data binding attributes and uses these attributes to query the
 * decision API.
 *
 * This is native JavaScript, no JQuery required. It uses the API JSONP interface 
 * to get around CORS and related issues. A script is added with a callback on
 * `window`. The promise is rejected if there are errors with the request or the
 * response doesn't look correct.
 *
 * Currently, only two parameters are supported with the ad placement: publisher
 * id and the place type. All of this is determined by the server and this
 * client so far only renders the API return HTML.
 *
 * Usage:
 *
 *     <script async src="optimalads.min.js"></script>
 *     <div optimal-publisher="foo" optimal-type="text"></div>
 */

const AD_CLIENT_VERSION = "1.6.2";  // Sent with the ad request


// ****************************************************************************
// !! Begin verge.js !! Used to detect viewport size and scroll position
// ****************************************************************************
!function(root, name, make) {
  if (typeof module != 'undefined' && module['exports']) module['exports'] = make();
  else root[name] = make();
}(this, 'verge', function() {

  var xports = {}
    , win = typeof window != 'undefined' && window
    , doc = typeof document != 'undefined' && document
    , docElem = doc && doc.documentElement
    , matchMedia = win['matchMedia'] || win['msMatchMedia']
    , mq = matchMedia ? function(q) {
        return !!matchMedia.call(win, q).matches;
      } : function() {
        return false;
      }
    , viewportW = xports['viewportW'] = function() {
        var a = docElem['clientWidth'], b = win['innerWidth'];
        return a < b ? b : a;
      }
    , viewportH = xports['viewportH'] = function() {
        var a = docElem['clientHeight'], b = win['innerHeight'];
        return a < b ? b : a;
      };

  /**
   * Test if a media query is active. Like Modernizr.mq
   * @since 1.6.0
   * @return {boolean}
   */
  xports['mq'] = mq;

  /**
   * Normalized matchMedia
   * @since 1.6.0
   * @return {MediaQueryList|Object}
   */
  xports['matchMedia'] = matchMedia ? function() {
    // matchMedia must be binded to window
    return matchMedia.apply(win, arguments);
  } : function() {
    // Gracefully degrade to plain object
    return {};
  };

  /**
   * @since 1.8.0
   * @return {{width:number, height:number}}
   */
  function viewport() {
    return {'width':viewportW(), 'height':viewportH()};
  }
  xports['viewport'] = viewport;

  /**
   * Cross-browser window.scrollX
   * @since 1.0.0
   * @return {number}
   */
  xports['scrollX'] = function() {
    return win.pageXOffset || docElem.scrollLeft;
  };

  /**
   * Cross-browser window.scrollY
   * @since 1.0.0
   * @return {number}
   */
  xports['scrollY'] = function() {
    return win.pageYOffset || docElem.scrollTop;
  };

  /**
   * @param {{top:number, right:number, bottom:number, left:number}} coords
   * @param {number=} cushion adjustment
   * @return {Object}
   */
  function calibrate(coords, cushion) {
    var o = {};
    cushion = +cushion || 0;
    o['width'] = (o['right'] = coords['right'] + cushion) - (o['left'] = coords['left'] - cushion);
    o['height'] = (o['bottom'] = coords['bottom'] + cushion) - (o['top'] = coords['top'] - cushion);
    return o;
  }

  /**
   * Cross-browser element.getBoundingClientRect plus optional cushion.
   * Coords are relative to the top-left corner of the viewport.
   * @since 1.0.0
   * @param {Element|Object} el element or stack (uses first item)
   * @param {number=} cushion +/- pixel adjustment amount
   * @return {Object|boolean}
   */
  function rectangle(el, cushion) {
    el = el && !el.nodeType ? el[0] : el;
    if (!el || 1 !== el.nodeType) return false;
    return calibrate(el.getBoundingClientRect(), cushion);
  }
  xports['rectangle'] = rectangle;

  /**
   * Get the viewport aspect ratio (or the aspect ratio of an object or element)
   * @since 1.7.0
   * @param {(Element|Object)=} o optional object with width/height props or methods
   * @return {number}
   * @link http://w3.org/TR/css3-mediaqueries/#orientation
   */
  function aspect(o) {
    o = null == o ? viewport() : 1 === o.nodeType ? rectangle(o) : o;
    var h = o['height'], w = o['width'];
    h = typeof h == 'function' ? h.call(o) : h;
    w = typeof w == 'function' ? w.call(o) : w;
    return w/h;
  }
  xports['aspect'] = aspect;

  /**
   * Test if an element is in the same x-axis section as the viewport.
   * @since 1.0.0
   * @param {Element|Object} el
   * @param {number=} cushion
   * @return {boolean}
   */
  xports['inX'] = function(el, cushion) {
    var r = rectangle(el, cushion);
    return !!r && r.right >= 0 && r.left <= viewportW();
  };

  /**
   * Test if an element is in the same y-axis section as the viewport.
   * @since 1.0.0
   * @param {Element|Object} el
   * @param {number=} cushion
   * @return {boolean}
   */
  xports['inY'] = function(el, cushion) {
    var r = rectangle(el, cushion);
    return !!r && r.bottom >= 0 && r.top <= viewportH();
  };

  /**
   * Test if an element is in the viewport.
   * @since 1.0.0
   * @param {Element|Object} el
   * @param {number=} cushion
   * @return {boolean}
   */
  xports['inViewport'] = function(el, cushion) {
    // Equiv to `inX(el, cushion) && inY(el, cushion)` but just manually do both
    // to avoid calling rectangle() twice. It gzips just as small like this.
    var r = rectangle(el, cushion);
    return !!r && r.bottom >= 0 && r.right >= 0 && r.top <= viewportH() && r.left <= viewportW();
  };

  return xports;
});

// ****************************************************************************
// !! End verge.js !!
// ****************************************************************************



// For local testing, set this
// const AD_DECISION_URL = "http://ethicaladserver:5000/api/v1/decision/";
const AD_DECISION_URL = "https://i.useoptimal.xyz/api/v1/decision/";
const AD_TYPES_VERSION = 1;  // Used with the ad type slugs
const ATTR_PREFIX = "optimal-";
const ABP_DETECTION_PX = "https://media.ethicalads.io/abp/px.gif";

// Keywords and topics
//
// This allows us to categorize pages simply and have better content targeting.
// Additional categorization can be done on the server side for pages
// that request ads commonly but this quick and easy categorization
// works decently well most of the time.
const KEYWORDS = {
};

// Maximum number of words of a document to analyze looking for keywords
// This is simply a check against taking too much time on very long documents
const MAX_WORDS_ANALYZED = 9999;

// Max number of detected keywords to send
// Lowering this number means that only major topics of the page get sent on long pages
const MAX_KEYWORDS = 3;

// Minimum number of occurrences of a keyword to consider it
const MIN_KEYWORD_OCCURRENCES = 2;

// Time between checking whether the ad is in the viewport to count the time viewed
// Time viewed is an important advertiser metric
const VIEW_TIME_INTERVAL = 1;  // seconds
const VIEW_TIME_MAX = 5 * 60;  // seconds

// In-viewport fudge factor
// A fudge factor of ~3 is needed for the case where the ad
// is hidden off the side of the screen by a sliding sidebar
// For example, if the right side of the ad is at x=0
// or the left side of the ad is at the right side of the viewport
const VIEWPORT_FUDGE_FACTOR = -3;  // px


/* Placement object to query decision API and return an Element node
 *
 * @param {string} publisher - Publisher ID
 * @param {string} ad_type - Placement ad type id
 * @param {Element} target - Target element
 * @param {Object} options - Various options for configuring the placement such as:
      keywords, styles, campaign_types, load_manually, force_ad, force_campaign
 */
class Placement {
  constructor (publisher, ad_type, target, options, viewer_data) {
    this.publisher = publisher;
    this.ad_type = ad_type;
    this.target = target;
    this.viewer_data = viewer_data;

    // Options
    this.options = options;
    this.style = options.style;
    this.keywords = options.keywords || [];
    this.load_manually = options.load_manually;
    this.force_ad = options.force_ad;
    this.force_campaign = options.force_campaign;
    this.campaign_types = options.campaign_types || [];
    if (!this.campaign_types.length) {
      this.campaign_types = ["paid", "publisher-house", "community", "house"];
    }

    // Initialized and will be used in the future
    this.view_time = 0;
    this.view_time_sent = false;  // true once the view time is sent to the server
    this.response = null;
  }

  /* Create a placement from an element
   *
   * Returns null if the placement is already loaded.
   *
   * @static
   * @param {Element} element - Load placement and append to this Element
   * @returns {Placement}
   */
  static from_element(element, viewer_data) {
    // Get attributes from DOM node
    const publisher = element.getAttribute(ATTR_PREFIX + "publisher");
    let ad_type = element.getAttribute(ATTR_PREFIX + "type");
    if (!ad_type) {
      ad_type = "image";
      element.setAttribute(ATTR_PREFIX + "type", "image");
    }

    const keywords = (element.getAttribute(ATTR_PREFIX + "keywords") || "").split("|").filter(word => word.length > 1);
    const campaign_types = (element.getAttribute(ATTR_PREFIX + "campaign-types") || "").split("|").filter(word => word.length > 1);

    const load_manually = element.getAttribute(ATTR_PREFIX + "manual") === "true";
    const style = element.getAttribute(ATTR_PREFIX + "style");
    const force_ad = element.getAttribute(ATTR_PREFIX + "force-ad");
    const force_campaign = element.getAttribute(ATTR_PREFIX + "force-campaign");

    let classes = (element.className || "").split(" ");
    if (classes.indexOf("loaded") >= 0) {
      console.error("Ad already loaded.");
      return null;
    }

    return new Placement(publisher, ad_type, element, {
        keywords: keywords,
        style: style,
        campaign_types: campaign_types,
        load_manually,
        force_ad,
        force_campaign
      },
      viewer_data
    );
  }

  /* Transforms target element into a placement
   *
   * This method organizes all of the operations to transform the placement
   * configuration wrapper `div` into an ad placement -- including starting the
   * API transaction, displaying the ad element,
   * and handling the viewport detection.
   *
   * @returns {Promise}
   */
  load() {
    // Detect the keywords
    this.keywords = this.keywords.concat(this.detectKeywords());

    return this.fetch().then((element) => {
      if (element === undefined) {
        throw new OptimalAdsWarning("Ad decision request blocked");
      }
      if (!element) {
        throw new OptimalAdsWarning("No ads to show.");
      }

      // Add `loaded` class, signifying that the CSS styles should finally be
      // applied to the target element.
      let classes = this.target.className || "";
      classes += " loaded";
      this.target.className = classes.trim();

      // Make this element the only child element of the target element
      while (this.target.firstChild) {
        this.target.removeChild(this.target.firstChild);
      }

      // Apply any styles based on the specified styling
      this.applyStyles(element);

      this.target.appendChild(element);

      return this;
    }).then((placement) => {
      // Detect when the ad is in the viewport
      // Add the view pixel to the DOM to count the view
      // Also count the time the ad is in view
      //  this will be sent before the page/tab is closed or navigated away

      let viewport_detection = setInterval((element) => {
        if (placement.inViewport(element)) {
          // This ad was seen!
          let pixel = document.createElement("img");
          pixel.src = placement.response.view_url;
          if (uplifted) {
            pixel.src += "?uplift=true";
          }
          pixel.className = "optimal-pixel";
          element.appendChild(pixel);

          clearInterval(viewport_detection);
        }
      }, 100, placement.target);

      let view_time_counter = setInterval((element) => {
        if (placement.view_time_sent) {
          clearInterval(view_time_counter);
        } else if (placement.inViewport(element)) {
          // Increment the ad's time in view counter
          placement.view_time += VIEW_TIME_INTERVAL;

          if (placement.view_time >= VIEW_TIME_MAX) {
            clearInterval(view_time_counter);
          }
        }
      }, VIEW_TIME_INTERVAL * 1000, placement.target);

      let visibility_change_listener = () => {
        if (placement.view_time <= 0 || placement.view_time_sent || !placement.response.view_time_url) return;
        // Check if the tab loses focus/is closed or the browser/app is minimized/closed
        // In that case, no longer count further time that the ad is in view
        // Send the time the ad was viewed to the server
        if (document.visibilityState === "hidden" || document.visibilityState === "unloaded") {
          let pixel = document.createElement("img");
          pixel.src = placement.response.view_time_url + "?view_time=" + placement.view_time;
          pixel.className = "optimal-pixel";
          placement.target.appendChild(pixel);

          placement.view_time_sent = true;
          document.removeEventListener("visibilitychange", visibility_change_listener);
        }
      };
      document.addEventListener("visibilitychange", visibility_change_listener);
    });
  }

  /* Returns whether the ad is visible in the viewport
   *
   * @param {Element} element - The ad element
   * @returns {boolean} True if the ad is loaded and visible in the viewport
   *  (including the tab being focused and not minimized) and returns false otherwise.
   */
  inViewport(element) {
    if (this.response && this.response.view_url && verge.inViewport(element, VIEWPORT_FUDGE_FACTOR) && document.visibilityState === "visible") {
      return true;
    }

    return false;
  }

  /* Get placement data from decision API
   *
   * @returns {Promise<Element>} Resolves with an Element converted from an HTML
   * string from API response. Can also be null, indicating a noop action.
   */
  fetch() {
    // Make sure callbacks don't collide even with multiple placements
    const callback = "ad_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
    var div_id = callback;
    if (this.target.id) {
      div_id = this.target.id;
    }

    // There's no hard maximum on URL lengths (all of these get added to the query params)
    // but ideally we want to keep our URLs below ~2k which should work basically everywhere
    let params = {
      publisher: this.publisher,
      ad_types: this.ad_type,
      div_ids: div_id,
      callback: callback,
      keywords: this.keywords.join("|"),
      campaign_types: this.campaign_types.join("|"),
      format: "jsonp",
      client_version: AD_CLIENT_VERSION,
      wallets: this.viewer_data.wallets.join("|"),
      // location.href includes query params (possibly sensitive) and fragments (unnecessary)
      url: (window.location.origin + window.location.pathname).slice(0, 256),
    };
    if (this.force_ad) {
      params["force_ad"] = this.force_ad;
    }
    if (this.force_campaign) {
      params["force_campaign"] = this.force_campaign;
    }
    const url_params = new URLSearchParams(params);
    const url = new URL(AD_DECISION_URL + "?" + url_params.toString());

    return new Promise((resolve, reject) => {
      window[callback] = (response) => {
        if (response && response.html && response.view_url) {
          this.response = response;
          const node_convert = document.createElement("div");
          node_convert.innerHTML = response.html;
          return resolve(node_convert.firstChild);
        } else {
          // No ad to show for this targeting/publisher
          return resolve(null);
        }
      };

      var script = document.createElement("script");
      script.src = url;
      script.type = "text/javascript";
      script.async = true;
      script.addEventListener("error", (err) => {
        // There was a problem loading this request, likely this was blocked by
        // an ad blocker. We'll resolve with an empty response instead of
        // throwing an error.
        return resolve();
      });
      document.getElementsByTagName("head")[0].appendChild(script);
    });
  }

  /* Get an optimal ad from the decision API 
   *
   * Calls {callback} with {err, data}. If err is null = success. Data can also be null, indicating a noop action.
   */
  get_optimal_ad(placement, callback, render_html=true) {
    let params = {
      publisher: placement.publisher,
      ad_types: placement.ad_type,
      div_ids: placement.target,
      keywords: placement.keywords.join("|"),
      campaign_types: placement.campaign_types.join("|"),
      client_version: AD_CLIENT_VERSION,
      wallets: placement.viewer_data.wallets.join("|"),
      // location.href includes query params (possibly sensitive) and fragments (unnecessary)
      url: (window.location.origin + window.location.pathname).slice(0, 256),
    };
    if (placement.force_ad) {
      params["force_ad"] = placement.force_ad;
    }
    if (placement.force_campaign) {
      params["force_campaign"] = placement.force_campaign;
    }
    const url_params = new URLSearchParams(params);
    const url = new URL(AD_DECISION_URL + "?" + url_params.toString());

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);

    xhr.onload = function () {
      callback(null, xhr.response);
    };

    xhr.onerror = function () {
      callback(xhr.response);
    };
    xhr.send();
  }

  /* Detect whether this ad is "uplifted" meaning allowed by ABP's Acceptable Ads list
   *
   * Calls the provided callback passing a boolean whether this ad is uplifted.
   * We need this data to provide back to the AcceptableAds folks.
   *
   * This code comes directly from Eyeo/AdblockPlus team to measure Acceptable Ads.
   *
   * @static
   * @param {string} px - A URL of a pixel to test
   * @param {function) callback - A callback to call when finished
   */
  detectABP(px, callback) {
    var detected = false;
    var checksRemain = 2;
    var error1 = false;
    var error2 = false;
    if (typeof callback != "function") return;
    px += "?ch=*&rn=*";

    function beforeCheck(callback, timeout) {
      if (checksRemain == 0 || timeout > 1E3) callback(checksRemain == 0 && detected);
      else setTimeout(function() {
        beforeCheck(callback, timeout * 2)
      }, timeout * 2)
    }

    function checkImages() {
      if (--checksRemain) return;
      detected = !error1 && error2
    }
    var random = Math.random() * 11;
    var img1 = new Image;
    img1.onload = checkImages;
    img1.onerror = function() {
      error1 = true;
      checkImages()
    };
    img1.src = px.replace(/\*/, 1).replace(/\*/, random);
    var img2 = new Image;
    img2.onload = checkImages;
    img2.onerror = function() {
      error2 = true;
      checkImages()
    };
    img2.src = px.replace(/\*/, 2).replace(/\*/, random);
    beforeCheck(callback, 250)
  }

  /* Returns an array of keywords (strings) found on the page
   *
   * @returns {Array[string]} Advertising keywords found on the page
   */
  detectKeywords() {
    // Return previously detected keywords
    // If this code has already run.
    // Note: if there are "no" keywords (an empty list) this is still true
    if (detectedKeywords) return detectedKeywords;

    var keywordHist = {};  // Keywords found => count of keyword
    const mainContent = document.querySelector("[role='main']") ||
      document.querySelector("main") ||
      document.querySelector("body");

    const words = mainContent.textContent.split(/\s+/);
    const wordTrimmer = /^[\('"]?(.*?)[,\.\?\!:;\)'"]?$/g;
    for (let x = 0; x < words.length && x < MAX_WORDS_ANALYZED; x++) {
      // Remove certain punctuation from beginning and end of the word
      let word = words[x].replace(wordTrimmer, "$1").toLowerCase();
      if (KEYWORDS.hasOwnProperty(word)) {
        keywordHist[KEYWORDS[word]] = (keywordHist[KEYWORDS[word]] || 0) + 1;
      }
    }

    // Sort the hist with the most common items first
    // Grab only the MAX_KEYWORDS most common
    const keywords = Object.entries(keywordHist).filter(
      // Only consider a keyword with at least this many occurrences
      a => a[1] >= MIN_KEYWORD_OCCURRENCES
    ).sort(
      (a, b) => {
        if (a[1] > b[1]) return -1;
        if (a[1] < b[1]) return 1;
        return 0;
      }
    ).slice(0, MAX_KEYWORDS).map((x) => x[0]);

    detectedKeywords = keywords;

    return keywords;
  }

  /* Apply custom styles based on optimal-style
   *
   */
  applyStyles(element) {
    // placeholder for future custom style
  }
}


/* Detects whether the browser supports the necessary JS APIs to support the ad client
 *
 * Generally we support recent versions of evergreen browsers (Chrome, Firefox, Safari, Edge)
 * but we no longer support IE11.
 *
 *  @returns {boolean} true if all dependencies met and false otherwise
 */
function check_dependencies() {
  if (
    !Object.entries ||
    !window.URL ||
    !window.URLSearchParams ||
    !window.Promise
  ) {
    console.error("Browser does not meet ethical ad client dependencies. Not showing ads");
    return false;
  }

  return true;
}

/* Find all placement DOM elements and hot load HTML as child nodes
 *
 * @param {boolean} force_load - load placements even if they are set to load manually
 * @returns {Promise<[Placement]>} Resolves to a list of Placement instances
 */
 function load_placements(viewer_data, force_load = false) {
  // Find all elements matching required data binding attribute.
  const node_list = document.querySelectorAll("[" + ATTR_PREFIX + "publisher]");
  let elements = Array.prototype.slice.call(node_list);

  // Create main promise. Iterator `all()` Promise will surround array of found
  // elements. If any of these elements have issues, this main promise will
  // reject.
  if (elements.length === 0) {
    throw new Error("No ad placements found.");
  }

  return Promise.all(
    elements.map((element, index) => {
      const placement = Placement.from_element(element, viewer_data);

      // Run AcceptableAds detection code
      // This lets us know how many impressions are attributed to AceeptableAds
      // Only run this once even for multiple placements
      // All impressions will be correctly attributed
      if (index === 0 && placement && !force_load) {
        placement.detectABP(ABP_DETECTION_PX, function (usesABP) {
          uplifted = usesABP;
          if (usesABP) {
            console.debug("Acceptable Ads enabled. Hooray, you're being paid for your attention! :)");
          }
        });
      }

      if (placement && (force_load || !placement.load_manually)) {
        return placement.load();
      } else {
        // This will be manually loaded later or has already been loaded
        return null;
      }
    })
  );
}

// An error class that we will not surface to clients normally.
class OptimalAdsWarning extends Error {}

/* Wrapping Promise to allow for handling of errors by user
 *
 * This promise currently does not reject on error as this will emit a console
 * warning if the user hasn't added a promise rejection handler (which is most
 * cases).
 *
 * This promise resolves to an aray of Placement instances, or an empty list if
 * there was any error configuring the placements.
 *
 * For example, to perform an action when no placements are loaded:
 *
 *   <script>
 *   optimalads.wait.then((placements) => {
 *     if (!placements.length) {
 *       console.log('Ads were not able to load');
 *     }
 *   }
 *   </script>
 *
 * @type {Promise<[Placement]>}
 */
 var optimal_wait;

/* Loading placements manually rather than the normal way
 *
 *   <div optimal-publisher="..." optimal-manual="true"></div>
 *   <script>
 *     optimalads.load();
 *   </script>
 *
 * @type function
 */
 var load;

/* Whether this ad impression is attributed to being on the Acceptable Ads list.
 * @type boolean
 */
 var uplifted = false;

/* Keywords detected on the page
 * @type {Array[string]}
 */
 var detectedKeywords = null;

// *********************************************************************
// Main entry point for loading ads
// Wait for DOMContentLoaded before loading placements
// *********************************************************************
function optimal_run(viewer_data) {

  const wait_dom = new Promise((resolve) => {
    if (
      document.readyState === "interactive" ||
      document.readyState === "complete"
    ) {
      return resolve();
    } else {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          resolve();
        },
        {
          capture: true,
          once: true,
          passive: true,
        }
      );
    }
  });

  optimal_wait = new Promise((resolve) => {
    wait_dom.then(() => {
      load_placements(viewer_data)
        .then((placements) => {
          resolve(placements);
        })
        .catch((err) => {
          resolve([]);

          if (err instanceof Error) {
            if (err instanceof OptimalAdsWarning) {
              // Report these at a lower log level
              console.debug(err.message);
              return;
            }
            console.error(err.message);
          }
        });
    });
  });

  load = () => {
    console.debug("Loading placements manually")
    load_placements(viewer_data, force_load=true);
  };
}

window.optimal_run=optimal_run;