(function () {
  'use strict';

  var FIREBASE_CONFIG = {
    apiKey: 'AIzaSyAUI3BEtbXM9fZnGo9zQMlJcFM09TNOv2Y',
    authDomain: 'test-bce5d3c2.firebaseapp.com',
    projectId: 'test-bce5d3c2',
    storageBucket: 'test-bce5d3c2.firebasestorage.app',
    messagingSenderId: '908468739903',
    appId: '1:908468739903:web:fede2b832cf2437c3cfd8a'
  };

  var FIREBASE_SDK = [
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js'
  ];

  var JSPDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var SCANNER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
  var PLACEHOLDER = 'assets/placeholder.svg';
  var STORAGE_KEY = 'sv.local.v1';
  var PREFS_KEY = 'sv.prefs.v1';

  var BRAND_LOGOS = {
    adidas: 'logos/adidas.png',
    nike: 'logos/nike.png',
    puma: 'logos/puma.png',
    reebok: 'logos/reebok.png',
    vans: 'logos/vans.png',
    dfy: 'logos/dfy.png',
    'new balance': 'logos/newbalance.png'
  };

  var el = {};
  var state = {
    products: new Map(),
    base: new Map(),
    pending: {},
    prefs: { brand: '', size: '', sort: 'recent', soldout: false },
    query: '',
    list: [],
    detailId: null,
    editor: { id: null, image: null, imageChanged: false, sizes: [] },
    db: null,
    connecting: false,
    listenersStarted: false,
    unsubs: [],
    syncState: 'local',
    scanner: null,
    scannerBusy: false,
    pdfBusy: false,
    socialBusy: false,
    lastScanAt: 0,
    persistTimer: 0,
    searchTimer: 0,
    quotaWarned: false,
    idleDone: false
  };

  function $(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    el.searchInput = $('search-input');
    el.searchClear = $('search-clear');
    el.syncPill = $('sync-pill');
    el.syncLabel = $('sync-label');
    el.pdfBtn = $('pdf-btn');
    el.addBtn = $('add-btn');
    el.statModels = $('stat-models');
    el.statPairs = $('stat-pairs');
    el.statBrands = $('stat-brands');
    el.statSoldout = $('stat-soldout');
    el.brandChips = $('brand-chips');
    el.sizeBtn = $('size-btn');
    el.sizeBtnLabel = $('size-btn-label');
    el.showSoldout = $('show-soldout');
    el.resultsText = $('results-text');
    el.sortSelect = $('sort-select');
    el.sizePanel = $('size-panel');
    el.sizeChips = $('size-chips');
    el.clearSizeBtn = $('clear-size-btn');
    el.grid = $('grid');
    el.emptyState = $('empty-state');
    el.clearFiltersBtn = $('clear-filters-btn');
    el.footerCount = $('footer-count');
    el.detailModal = $('detail-modal');
    el.detailContent = $('detail-content');
    el.detailTitle = $('detail-title');
    el.editorModal = $('editor-modal');
    el.editorForm = $('editor-form');
    el.editorTitle = $('editor-title');
    el.dropzone = $('dropzone');
    el.imagePreview = $('image-preview');
    el.dropzoneEmpty = $('dropzone-empty');
    el.dropzoneEdit = $('dropzone-edit');
    el.imageInput = $('image-input');
    el.pickImageBtn = $('pick-image-btn');
    el.removeImageBtn = $('remove-image-btn');
    el.fLink = $('f-link');
    el.autofillBtn = $('autofill-btn');
    el.fName = $('f-name');
    el.fBrand = $('f-brand');
    el.brandList = $('brand-list');
    el.fCode = $('f-code');
    el.codeFindBtn = $('code-find-btn');
    el.lookupPanel = $('lookup-panel');
    el.lookupTitle = $('lookup-title');
    el.lookupBody = $('lookup-body');
    el.lookupClose = $('lookup-close');
    el.scanBtn = $('scan-btn');
    el.fPrice = $('f-price');
    el.sizeRows = $('size-rows');
    el.sizeTotal = $('size-total');
    el.customSize = $('custom-size');
    el.addCustomSizeBtn = $('add-custom-size-btn');
    el.editorStatus = $('editor-status');
    el.saveBtn = $('save-btn');
    el.saveNextBtn = $('save-next-btn');
    el.confirmModal = $('confirm-modal');
    el.confirmTitle = $('confirm-title');
    el.confirmText = $('confirm-text');
    el.confirmOk = $('confirm-ok');
    el.confirmCancel = $('confirm-cancel');
    el.confirmIcon = $('confirm-icon');
    el.scannerModal = $('scanner-modal');
    el.qrReader = $('qr-reader');
    el.scannerStatus = $('scanner-status');
    el.manualCode = $('manual-code');
    el.manualCodeBtn = $('manual-code-btn');
    el.lightbox = $('lightbox');
    el.lightboxImg = $('lightbox-img');
    el.lightboxClose = $('lightbox-close');
    el.toast = $('toast');
  }

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toMs(value) {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      var parsed = Date.parse(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value.toMillis === 'function') {
      try { return value.toMillis(); } catch (e) { return 0; }
    }
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    return 0;
  }

  function normalizeSizes(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [];
    raw.forEach(function (item) {
      if (item == null) return;
      var size = typeof item === 'object' ? item.size : item;
      var qty = typeof item === 'object' ? item.quantity : 1;
      size = String(size == null ? '' : size).trim();
      if (!size) return;
      qty = parseInt(qty, 10);
      if (isNaN(qty) || qty < 0) qty = 0;
      out.push({ size: size, quantity: qty });
    });
    return out;
  }

  function normalizeProduct(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var id = String(raw.id || '').trim();
    if (!id) return null;
    var updatedAt = raw.updatedAt != null ? raw.updatedAt : raw.updatedAtMs;
    var updatedMs = toMs(updatedAt);
    if (!updatedMs) updatedMs = toMs(raw.createdAt);
    return {
      id: id,
      name: String(raw.name || '').trim(),
      brand: String(raw.brand || '').trim(),
      code: String(raw.code || '').trim(),
      price: Number(raw.price) || 0,
      link: String(raw.link || '').trim(),
      sizes: normalizeSizes(raw.sizes),
      image: raw.image ? String(raw.image) : '',
      createdAt: raw.createdAt != null ? raw.createdAt : null,
      updatedAt: updatedAt != null ? (typeof updatedAt === 'string' ? updatedAt : updatedMs || null) : updatedMs || null,
      updatedMs: updatedMs
    };
  }

  function isLocalImage(src) {
    return typeof src === 'string' && (src.indexOf('images/') === 0 || src.indexOf('assets/') === 0);
  }

  function isRemoteImage(src) {
    return typeof src === 'string' && /^https?:/i.test(src);
  }

  function totalPairs(product) {
    var total = 0;
    (product.sizes || []).forEach(function (item) {
      total += parseInt(item.quantity, 10) || 0;
    });
    return total;
  }

  function isOut(product) {
    return totalPairs(product) === 0;
  }

  function brandHue(brand) {
    var text = normalizeText(brand) || 'vault';
    var hash = 0;
    for (var i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) % 330;
    }
    return hash + 10;
  }

  function formatPrice(price) {
    var value = Number(price) || 0;
    if (value <= 0) return '';
    return 'S/. ' + value.toFixed(2);
  }

  function relativeTime(ms) {
    if (!ms) return '';
    var diff = Date.now() - ms;
    if (diff < 0) diff = 0;
    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'hace un momento';
    if (minutes < 60) return 'hace ' + minutes + ' min';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return 'hace ' + hours + ' h';
    var days = Math.floor(hours / 24);
    if (days < 30) return 'hace ' + days + ' d';
    var months = Math.floor(days / 30);
    if (months < 12) return 'hace ' + months + ' mes' + (months === 1 ? '' : 'es');
    return 'hace ' + Math.floor(months / 12) + ' a';
  }

  function imageSrc(product) {
    return product && product.image ? product.image : PLACEHOLDER;
  }

  function persistNow() {
    try {
      var payload = {
        v: 1,
        savedAt: Date.now(),
        products: {},
        pending: state.pending
      };
      state.products.forEach(function (product, id) {
        payload.products[id] = product;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      if (!state.quotaWarned) {
        state.quotaWarned = true;
        showToast('Memoria local llena: las fotos nuevas podrían no persistir sin conexión', true);
      }
    }
  }

  function persistSoon() {
    clearTimeout(state.persistTimer);
    state.persistTimer = setTimeout(persistNow, 350);
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (!data) return;
      if (typeof data.brand === 'string') state.prefs.brand = data.brand;
      if (typeof data.size === 'string') state.prefs.size = data.size;
      if (typeof data.sort === 'string') state.prefs.sort = data.sort;
      if (typeof data.soldout === 'boolean') state.prefs.soldout = data.soldout;
    } catch (error) { /* preferencias corruptas se ignoran */ }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs));
    } catch (error) { /* sin espacio: no es crítico */ }
  }

  function buildInitialState() {
    var snapshot = window.SNEAKER_DATA && Array.isArray(window.SNEAKER_DATA.products)
      ? window.SNEAKER_DATA.products
      : [];
    snapshot.forEach(function (raw) {
      var product = normalizeProduct(raw);
      if (!product) return;
      state.base.set(product.id, { image: product.image, updatedMs: product.updatedMs });
      state.products.set(product.id, product);
    });
    var local = loadLocal();
    if (local && local.products && typeof local.products === 'object') {
      Object.keys(local.products).forEach(function (id) {
        var product = normalizeProduct(local.products[id]);
        if (product) state.products.set(product.id, product);
      });
    }
    if (local && local.pending && typeof local.pending === 'object') {
      state.pending = local.pending;
    }
  }

  function queryTokens() {
    return normalizeText(state.query).split(/\s+/).filter(Boolean);
  }

  function matchesQuery(product, tokens) {
    if (!tokens.length) return true;
    var haystack = normalizeText([product.name, product.brand, product.code].join(' '));
    var sizes = (product.sizes || []).map(function (item) { return normalizeText(item.size); });
    for (var i = 0; i < tokens.length; i += 1) {
      var token = tokens[i];
      var hit = haystack.indexOf(token) !== -1;
      if (!hit) {
        for (var j = 0; j < sizes.length; j += 1) {
          if (sizes[j].indexOf(token) === 0) { hit = true; break; }
        }
      }
      if (!hit) return false;
    }
    return true;
  }

  function matchesSize(product) {
    if (!state.prefs.size) return true;
    return (product.sizes || []).some(function (item) {
      return item.size === state.prefs.size && (parseInt(item.quantity, 10) || 0) > 0;
    });
  }

  function matchesBrand(product) {
    if (!state.prefs.brand) return true;
    return normalizeText(product.brand) === normalizeText(state.prefs.brand);
  }

  function applyFilters() {
    var tokens = queryTokens();
    var filtering = tokens.length > 0 || !!state.prefs.size;
    var list = [];
    state.products.forEach(function (product) {
      if (!matchesBrand(product)) return;
      if (!matchesSize(product)) return;
      if (!matchesQuery(product, tokens)) return;
      if (!state.prefs.soldout && !filtering && isOut(product)) return;
      list.push(product);
    });
    var sort = state.prefs.sort;
    list.sort(function (a, b) {
      if (sort === 'name') return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      if (sort === 'price-asc') return (a.price || Infinity) - (b.price || Infinity) || a.name.localeCompare(b.name, 'es');
      if (sort === 'price-desc') return (b.price || -1) - (a.price || -1) || a.name.localeCompare(b.name, 'es');
      if (sort === 'stock') return totalPairs(b) - totalPairs(a) || b.updatedMs - a.updatedMs;
      return b.updatedMs - a.updatedMs;
    });
    state.list = list;
    return list;
  }

  function sizeInventory() {
    var counts = new Map();
    state.products.forEach(function (product) {
      (product.sizes || []).forEach(function (item) {
        if ((parseInt(item.quantity, 10) || 0) <= 0) return;
        counts.set(item.size, (counts.get(item.size) || 0) + 1);
      });
    });
    return Array.from(counts.entries()).sort(function (a, b) {
      var na = parseFloat(a[0].replace(',', '.'));
      var nb = parseFloat(b[0].replace(',', '.'));
      if (isNaN(na)) na = 999;
      if (isNaN(nb)) nb = 999;
      return na - nb || String(a[0]).localeCompare(String(b[0]));
    });
  }

  function brandInventory() {
    var counts = new Map();
    state.products.forEach(function (product) {
      var brand = product.brand || 'Sin marca';
      counts.set(brand, (counts.get(brand) || 0) + 1);
    });
    return Array.from(counts.entries()).sort(function (a, b) {
      return b[1] - a[1] || a[0].localeCompare(b[0], 'es');
    });
  }

  function renderBrandChips() {
    var brands = brandInventory();
    var html = '<button class="brand-chip' + (state.prefs.brand ? '' : ' active') + '" type="button" data-brand="">Todas <span class="chip-count">' + state.products.size + '</span></button>';
    brands.forEach(function (entry) {
      var active = normalizeText(state.prefs.brand) === normalizeText(entry[0]) ? ' active' : '';
      html += '<button class="brand-chip' + active + '" type="button" data-brand="' + escapeHtml(entry[0]) + '">' + escapeHtml(entry[0]) + ' <span class="chip-count">' + entry[1] + '</span></button>';
    });
    el.brandChips.innerHTML = html;
  }

  function renderSizeChips() {
    var sizes = sizeInventory();
    var html = '';
    sizes.forEach(function (entry) {
      var active = state.prefs.size === entry[0] ? ' active' : '';
      html += '<button class="size-option' + active + '" type="button" data-size="' + escapeHtml(entry[0]) + '">' + escapeHtml(entry[0]) + ' <small>' + entry[1] + '</small></button>';
    });
    el.sizeChips.innerHTML = html || '<span class="detail-empty">Sin tallas registradas</span>';
  }

  function cardHtml(product) {
    var pairs = totalPairs(product);
    var out = pairs === 0;
    var price = formatPrice(product.price);
    var hue = brandHue(product.brand);
    var sizes = product.sizes || [];
    var pills = '';
    var slice = sizes.slice(0, 4);
    slice.forEach(function (item) {
      pills += '<span class="size-pill">' + escapeHtml(item.size) + '<small>×' + (parseInt(item.quantity, 10) || 0) + '</small></span>';
    });
    if (sizes.length > slice.length) {
      pills += '<span class="size-pill more">+' + (sizes.length - slice.length) + '</span>';
    }
    var quick = '<div class="card-quick">';
    quick += '<button class="quick-btn" type="button" data-action="edit" aria-label="Editar" title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';
    if (product.link) {
      quick += '<button class="quick-btn" type="button" data-action="link" aria-label="Copiar enlace" title="Copiar enlace"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></button>';
    }
    quick += '<button class="quick-btn" type="button" data-action="card" aria-label="Social card" title="Social card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path><path d="M12 15V3"></path></svg></button>';
    quick += '</div>';
    return '' +
      '<article class="card' + (out ? ' is-out' : '') + '" role="listitem" tabindex="0" data-id="' + escapeHtml(product.id) + '">' +
      '<div class="card-media">' +
      '<img src="' + escapeHtml(imageSrc(product)) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'">' +
      '<div class="card-badges">' +
      '<span class="badge-brand" style="--bh:' + hue + '">' + escapeHtml(product.brand || 'Sin marca') + '</span>' +
      '<span class="badge-stock">' + (out ? 'Agotado' : pairs + (pairs === 1 ? ' par' : ' pares')) + '</span>' +
      '</div>' +
      quick +
      (out ? '<div class="soldout-label"><span>AGOTADO</span></div>' : '') +
      '</div>' +
      '<div class="card-info">' +
      '<h3 class="card-name">' + escapeHtml(product.name || product.code || 'Sin nombre') + '</h3>' +
      '<div class="card-price-row">' +
      (price ? '<span class="card-price">' + escapeHtml(price) + '</span>' : '<span class="card-price no-price">Sin precio</span>') +
      (product.code ? '<span class="card-code">' + escapeHtml(product.code) + '</span>' : '') +
      '</div>' +
      '<div class="card-sizes">' + pills + '</div>' +
      '</div>' +
      '</article>';
  }

  function renderGrid(list) {
    if (!list.length) {
      el.grid.hidden = true;
      el.grid.innerHTML = '';
      el.emptyState.hidden = false;
      return;
    }
    el.emptyState.hidden = true;
    el.grid.hidden = false;
    var html = '';
    var chunk = '';
    for (var i = 0; i < list.length; i += 1) {
      chunk += cardHtml(list[i]);
      if (chunk.length > 120000) {
        html += chunk;
        chunk = '';
      }
    }
    html += chunk;
    el.grid.innerHTML = html;
  }

  function updateStats(list) {
    var pairs = 0;
    var brands = new Set();
    var soldout = 0;
    list.forEach(function (product) {
      pairs += totalPairs(product);
      brands.add(normalizeText(product.brand || 'sin marca'));
      if (isOut(product)) soldout += 1;
    });
    el.statModels.textContent = String(list.length);
    el.statPairs.textContent = String(pairs);
    el.statBrands.textContent = String(brands.size);
    el.statSoldout.textContent = String(soldout);
    el.footerCount.textContent = String(state.products.size);
  }

  function updateResults(list) {
    if (!list.length) {
      el.resultsText.textContent = 'Sin resultados';
      return;
    }
    var pairs = list.reduce(function (acc, product) { return acc + totalPairs(product); }, 0);
    el.resultsText.innerHTML = '<strong>' + list.length + '</strong> ' + (list.length === 1 ? 'modelo' : 'modelos') + ' · ' + pairs + ' pares';
  }

  function renderAll() {
    renderBrandChips();
    renderSizeChips();
    var list = applyFilters();
    updateResults(list);
    renderGrid(list);
    updateStats(list);
    el.sizeBtnLabel.textContent = state.prefs.size ? 'Talla ' + state.prefs.size : 'Talla';
    el.sizeBtn.classList.toggle('has-value', !!state.prefs.size);
    el.searchClear.hidden = !el.searchInput.value;
  }

  function openModal(node) {
    node.classList.add('is-open');
    node.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModal(node) {
    node.classList.remove('is-open');
    node.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.is-open')) {
      document.body.classList.remove('modal-open');
    }
  }

  var confirmResolver = null;

  function askConfirm(options) {
    return new Promise(function (resolve) {
      if (confirmResolver) {
        confirmResolver(false);
        confirmResolver = null;
      }
      confirmResolver = resolve;
      el.confirmTitle.textContent = options.title || 'Confirmar';
      el.confirmText.textContent = options.text || '';
      el.confirmOk.textContent = options.okLabel || 'Confirmar';
      el.confirmOk.className = 'btn ' + (options.tone === 'neutral' ? 'btn-primary' : 'btn-danger');
      el.confirmIcon.classList.toggle('is-neutral', options.tone === 'neutral');
      openModal(el.confirmModal);
      setTimeout(function () { el.confirmOk.focus(); }, 60);
    });
  }

  function resolveConfirm(value) {
    if (!confirmResolver) return;
    var resolve = confirmResolver;
    confirmResolver = null;
    closeModal(el.confirmModal);
    resolve(value);
  }

  function detailTag(icon, text) {
    return '<span class="detail-tag">' + icon + escapeHtml(text) + '</span>';
  }

  function detailHtml(product) {
    var pairs = totalPairs(product);
    var out = pairs === 0;
    var hue = brandHue(product.brand);
    var price = formatPrice(product.price);
    var iconCode = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"></path><path d="M8 8v8M12 8v8M16 8v5"></path></svg>';
    var iconLink = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
    var sizesHtml = '';
    (product.sizes || []).forEach(function (item) {
      sizesHtml += '<div class="detail-size"><strong>' + escapeHtml(item.size) + '</strong><span>' + (parseInt(item.quantity, 10) || 0) + ' par' + ((parseInt(item.quantity, 10) || 0) === 1 ? '' : 'es') + '</span></div>';
    });
    return '' +
      '<div class="detail-layout">' +
      '<div class="detail-media">' +
      '<img src="' + escapeHtml(imageSrc(product)) + '" alt="' + escapeHtml(product.name) + '" data-lightbox="' + escapeHtml(imageSrc(product)) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'">' +
      '<span class="detail-stock' + (out ? ' is-out' : '') + '">' + (out ? 'Agotado' : pairs + (pairs === 1 ? ' par disponible' : ' pares disponibles')) + '</span>' +
      '</div>' +
      '<div class="detail-info">' +
      '<div class="detail-eyebrow"><span class="brand-dot" style="--bh:' + hue + '"></span>' + escapeHtml(product.brand || 'Sin marca') +
      (product.code ? '<span class="dot-sep"></span>' + escapeHtml(product.code) : '') +
      '</div>' +
      '<h2 id="detail-title">' + escapeHtml(product.name || product.code || 'Sin nombre') + '</h2>' +
      (price ? '<div class="detail-price">' + escapeHtml(price) + '</div>' : '<div class="detail-price no-price">Sin precio registrado</div>') +
      '<div class="detail-tags">' +
      (product.code ? detailTag(iconCode, product.code) : '') +
      (product.link ? '<a class="detail-tag link" href="' + escapeHtml(product.link) + '" target="_blank" rel="noopener">' + iconLink + 'Abrir enlace</a>' : '') +
      '</div>' +
      '<div class="detail-block"><h4>Tallas y stock</h4>' +
      (sizesHtml ? '<div class="detail-sizes">' + sizesHtml + '</div>' : '<p class="detail-empty">Sin tallas registradas. Edita el modelo para agregar stock.</p>') +
      '</div>' +
      '<div class="detail-actions">' +
      '<button class="btn btn-primary" type="button" data-act="edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>Editar</button>' +
      '<button class="btn btn-ghost" type="button" data-act="copy"' + (product.link ? '' : ' disabled') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>Copiar enlace</button>' +
      '<button class="btn btn-ghost" type="button" data-act="google"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.4-3.4"></path></svg>Buscar en Google</button>' +
      '<button class="btn btn-ghost" type="button" data-act="card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path><path d="M12 15V3"></path></svg>Social card</button>' +
      '</div>' +
      '<div class="detail-danger">' +
      (out ? '' : '<button class="danger-link" type="button" data-act="soldout">Marcar como agotada</button>') +
      '<button class="danger-link" type="button" data-act="delete">Eliminar</button>' +
      '</div>' +
      '<p class="detail-updated">Actualizada ' + escapeHtml(relativeTime(product.updatedMs)) + '</p>' +
      '</div>' +
      '</div>';
  }

  function openDetail(id) {
    var product = state.products.get(id);
    if (!product) return;
    state.detailId = id;
    el.detailContent.innerHTML = detailHtml(product);
    openModal(el.detailModal);
  }

  function closeDetail() {
    closeModal(el.detailModal);
    state.detailId = null;
  }

  function renderSizeRows() {
    var html = '';
    state.editor.sizes.forEach(function (item, index) {
      html += '<div class="size-row" data-index="' + index + '">' +
        '<span class="size-row-label">Talla <strong>' + escapeHtml(item.size) + '</strong></span>' +
        '<div class="stepper">' +
        '<button type="button" data-step="-1" aria-label="Menos">−</button>' +
        '<input type="number" min="0" step="1" inputmode="numeric" value="' + (parseInt(item.quantity, 10) || 0) + '" aria-label="Cantidad talla ' + escapeHtml(item.size) + '">' +
        '<button type="button" data-step="1" aria-label="Más">+</button>' +
        '</div>' +
        '<button type="button" class="size-remove" aria-label="Quitar talla">&times;</button>' +
        '</div>';
    });
    el.sizeRows.innerHTML = html;
    updateSizeTotal();
  }

  function updateSizeTotal() {
    var total = state.editor.sizes.reduce(function (acc, item) { return acc + (parseInt(item.quantity, 10) || 0); }, 0);
    el.sizeTotal.textContent = total + (total === 1 ? ' par' : ' pares');
  }

  function addEditorSize(size, qty) {
    size = String(size || '').trim();
    if (!size) return;
    var existing = state.editor.sizes.find(function (item) { return item.size === size; });
    if (existing) {
      existing.quantity = Math.max(0, (parseInt(existing.quantity, 10) || 0) + (qty == null ? 1 : qty));
    } else {
      state.editor.sizes.push({ size: size, quantity: Math.max(0, parseInt(qty == null ? 1 : qty, 10) || 0) });
    }
    renderSizeRows();
  }

  function removeEditorSize(size) {
    state.editor.sizes = state.editor.sizes.filter(function (item) { return item.size !== size; });
    renderSizeRows();
  }

  function showEditorImage(src) {
    if (src) {
      el.imagePreview.src = src;
      el.imagePreview.hidden = false;
      el.dropzoneEmpty.hidden = true;
      el.dropzoneEdit.hidden = false;
      el.removeImageBtn.hidden = false;
    } else {
      el.imagePreview.removeAttribute('src');
      el.imagePreview.hidden = true;
      el.dropzoneEmpty.hidden = false;
      el.dropzoneEdit.hidden = true;
      el.removeImageBtn.hidden = true;
    }
  }

  function fillEditor(product) {
    state.editor.id = product ? product.id : null;
    state.editor.image = product && product.image ? product.image : null;
    state.editor.imageChanged = false;
    state.editor.sizes = product
      ? (product.sizes || []).map(function (item) { return { size: item.size, quantity: parseInt(item.quantity, 10) || 0 }; })
      : [];
    el.editorTitle.textContent = product ? 'Editar zapatilla' : 'Nueva zapatilla';
    el.fName.value = product ? product.name || '' : '';
    el.fBrand.value = product ? product.brand || '' : '';
    el.fCode.value = product ? product.code || '' : '';
    el.fPrice.value = product && product.price > 0 ? String(product.price) : '';
    el.fLink.value = product ? product.link || '' : '';
    showEditorImage(state.editor.image);
    renderSizeRows();
    closeLookup();
    setTimeout(function () { el.fName.focus(); }, 80);
  }

  function openEditor(product) {
    fillEditor(product || null);
    openModal(el.editorModal);
  }

  function closeEditor() {
    closeModal(el.editorModal);
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error || new Error('No se pudo leer el archivo')); };
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src, cors) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      if (cors) image.crossOrigin = 'anonymous';
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('No se pudo cargar la imagen')); };
      image.src = src;
    });
  }

  function imagePadColor(image) {
    try {
      var small = document.createElement('canvas');
      small.width = 8;
      small.height = 8;
      var sctx = small.getContext('2d');
      sctx.drawImage(image, 0, 0, 8, 8);
      var data = sctx.getImageData(0, 0, 8, 8).data;
      var points = [[0, 0], [7, 0], [0, 7], [7, 7]];
      var r = 0;
      var g = 0;
      var b = 0;
      var n = 0;
      for (var i = 0; i < points.length; i += 1) {
        var idx = (points[i][1] * 8 + points[i][0]) * 4;
        if (data[idx + 3] < 250) return '#ffffff';
        r += data[idx];
        g += data[idx + 1];
        b += data[idx + 2];
        n += 1;
      }
      if (!n) return '#ffffff';
      var avg = (r + g + b) / (3 * n);
      if (avg > 235) return '#ffffff';
      return 'rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')';
    } catch (error) {
      return '#ffffff';
    }
  }

  function encodeJpeg(image, maxDim, quality) {
    var plans = [
      { dim: maxDim, q: quality },
      { dim: Math.round(maxDim * 0.85), q: 0.78 },
      { dim: 1000, q: 0.7 },
      { dim: 800, q: 0.62 }
    ];
    var padColor = imagePadColor(image);
    var attempt = 0;
    var encoded = '';
    while (attempt < plans.length) {
      var plan = plans[attempt];
      var scale = Math.min(1, plan.dim / Math.max(image.width, image.height));
      var width = Math.max(1, Math.round(image.width * scale));
      var height = Math.max(1, Math.round(image.height * scale));
      var side = Math.max(width, height);
      var canvas = document.createElement('canvas');
      canvas.width = side;
      canvas.height = side;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = padColor;
      ctx.fillRect(0, 0, side, side);
      ctx.drawImage(image, Math.round((side - width) / 2), Math.round((side - height) / 2), width, height);
      encoded = canvas.toDataURL('image/jpeg', plan.q);
      if (encoded.length <= 950000) break;
      attempt += 1;
    }
    return encoded;
  }

  function compressImage(file, maxDim, quality) {
    return fileToDataUrl(file).then(function (dataUrl) {
      return loadImage(dataUrl).then(function (image) {
        return encodeJpeg(image, maxDim || 1400, quality || 0.85);
      });
    });
  }

  function handleImageFile(file) {
    if (!file || !/^image\//.test(file.type)) {
      showToast('El archivo no es una imagen', true);
      return;
    }
    compressImage(file).then(function (dataUrl) {
      state.editor.image = dataUrl;
      state.editor.imageChanged = true;
      showEditorImage(dataUrl);
    }).catch(function () {
      showToast('No se pudo procesar la imagen', true);
    });
  }

  function imageFromUrl(url) {
    return loadImage(url, true).then(function (image) {
      return encodeJpeg(image, 1400, 0.85);
    }).catch(function () {
      return url;
    });
  }

  function autofillFromLink() {
    var url = el.fLink.value.trim();
    if (!url) {
      showToast('Pega un enlace primero', true);
      return;
    }
    var original = el.autofillBtn.textContent;
    el.autofillBtn.disabled = true;
    el.autofillBtn.textContent = 'Analizando…';
    fetch('https://api.microlink.io?url=' + encodeURIComponent(url))
      .then(function (response) { return response.json(); })
      .then(function (result) {
        if (!result || result.status !== 'success' || !result.data) {
          throw new Error('sin datos');
        }
        var data = result.data;
        if (data.title && !el.fName.value.trim()) {
          el.fName.value = String(data.title).split('|')[0].trim().slice(0, 90);
        }
        var amount = data.price && data.price.amount ? parseFloat(data.price.amount) : 0;
        if (amount > 0 && !el.fPrice.value) {
          el.fPrice.value = String(amount);
        }
        if (data.image && data.image.url) {
          return imageFromUrl(data.image.url).then(function (src) {
            state.editor.image = src;
            state.editor.imageChanged = true;
            showEditorImage(src);
            showToast('Datos completados desde el enlace');
          });
        }
        showToast('Datos completados desde el enlace');
        return null;
      })
      .catch(function () {
        showToast('No se pudo leer ese enlace', true);
      })
      .finally(function () {
        el.autofillBtn.disabled = false;
        el.autofillBtn.textContent = original;
      });
  }

  var LOOKUP_STOP = {
    zapatillas: 1, zapatilla: 1, zapatos: 1, zapato: 1, tenis: 1, teniss: 1, tennis: 1,
    shoes: 1, shoe: 1, sneakers: 1, sneaker: 1, botas: 1, bota: 1, para: 1, de: 1, del: 1,
    la: 1, el: 1, los: 1, las: 1, mujer: 1, hombre: 1, nino: 1, ninos: 1, kids: 1,
    unisex: 1, calzado: 1, comprar: 1, precio: 1, oferta: 1, originales: 1, original: 1,
    gratis: 1, envio: 1, peru: 1, colombia: 1, chile: 1, mexico: 1, guatemala: 1, ecuador: 1,
    dama: 1, caballero: 1, varon: 1, modelo: 1, producto: 1, nuevos: 1, nuevo: 1,
    running: 1, training: 1, casual: 1, lifestyle: 1, sport: 1, deportivos: 1, deportivo: 1
  };

  var LOOKUP_COLORS = {
    verde: 1, gris: 1, negro: 1, negra: 1, negras: 1, blanco: 1, blanca: 1, blancas: 1,
    rojo: 1, roja: 1, azul: 1, azules: 1, beige: 1, rosa: 1, morado: 1, marron: 1,
    pink: 1, black: 1, white: 1, red: 1, blue: 1, green: 1, grey: 1, gray: 1, gum: 1,
    mint: 1, navy: 1, brown: 1, cream: 1, off: 1, core: 1, cloud: 1, triple: 1, dark: 1
  };

  var LOOKUP_BRANDS = [
    { name: 'Adidas', re: /(^|\.)adidas\./ },
    { name: 'Nike', re: /(^|\.)nike\./ },
    { name: 'Puma', re: /(^|\.)puma\./ },
    { name: 'Vans', re: /(^|\.)vans\./ },
    { name: 'New Balance', re: /newbalance\.|new-balance\./ },
    { name: 'Reebok', re: /(^|\.)reebok\./ },
    { name: 'Skechers', re: /(^|\.)skechers\./ },
    { name: 'Converse', re: /(^|\.)converse\./ }
  ];

  var lookupSeq = 0;
  var lookupCache = {};

  function lookupKey(value) {
    return normalizeText(value).replace(/[^a-z0-9]/g, '');
  }

  function lookupTitleCase(value) {
    return String(value || '').split(/\s+/).filter(Boolean).map(function (word) {
      if (/\d/.test(word)) {
        return /^[a-z]{1,4}\d+[a-z]?$/i.test(word) ? word.toUpperCase() : word;
      }
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  }

  function lookupFetch(url) {
    var options = {};
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      options.signal = AbortSignal.timeout(30000);
    }
    return fetch(url, options).then(function (response) {
      if (!response.ok) throw new Error('bad status');
      return response.text();
    }).then(function (text) {
      if (!text || text.length < 100) throw new Error('sin contenido');
      return text;
    });
  }

  function lookupDecodeUrl(raw) {
    try {
      var match = String(raw || '').match(/uddg=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : raw;
    } catch (error) {
      return raw;
    }
  }

  function lookupParseResults(text) {
    var out = [];
    var re = /^\s*(\d+)\.\[([^\]]+)\]\((https:\/\/duckduckgo\.com\/l\/\?[^)]+)\)/gm;
    var match;
    while ((match = re.exec(text))) {
      out.push({
        title: match[2].replace(/\*\*/g, '').trim(),
        url: lookupDecodeUrl(match[3])
      });
    }
    return out;
  }

  function lookupDetectBrandInDomain(url) {
    var value = String(url || '').toLowerCase();
    for (var i = 0; i < LOOKUP_BRANDS.length; i += 1) {
      if (LOOKUP_BRANDS[i].re.test(value)) return LOOKUP_BRANDS[i].name;
    }
    return '';
  }

  function lookupDetectBrand(items) {
    var i;
    for (i = 0; i < items.length; i += 1) {
      var official = lookupDetectBrandInDomain(items[i].url);
      if (official) return official;
    }
    for (i = 0; i < items.length; i += 1) {
      var hay = lookupKey(items[i].title) + ' ' + lookupKey(items[i].url);
      for (var k = 0; k < LOOKUP_BRANDS.length; k += 1) {
        if (hay.indexOf(lookupKey(LOOKUP_BRANDS[k].name)) !== -1) return LOOKUP_BRANDS[k].name;
      }
    }
    return '';
  }

  function lookupIsJunkWord(word, codeKey, brandKey) {
    var key = lookupKey(word);
    if (!key) return true;
    if (key === codeKey) return true;
    if (key === brandKey) return true;
    if (key.length >= 4 && codeKey.indexOf(key) !== -1) return true;
    if (key.length >= 16 && /^[0-9a-f]+$/.test(key)) return true;
    if (/^\d+(?:[.,]\d+)?(?:cm|mm|in|kg|gr?)$/.test(key)) return true;
    if (LOOKUP_STOP[key] || LOOKUP_COLORS[key]) return true;
    if (/^\d+$/.test(key)) {
      if (key.length >= 7) return true;
      if (key.length >= 2 && codeKey.slice(-key.length) === key) return true;
      return false;
    }
    if (key.length < 2) return true;
    return false;
  }

  function lookupNameFromSlug(url, codeKey, brandKey) {
    var path = '';
    try { path = new URL(url).pathname; } catch (error) { return []; }
    var segments = path.split('/').filter(Boolean);
    var segment = '';
    for (var i = 0; i < segments.length; i += 1) {
      if (codeKey && lookupKey(segments[i]).indexOf(codeKey) !== -1) { segment = segments[i]; break; }
    }
    if (!segment) segment = segments[segments.length - 1] || '';
    return segment.split(/[-_]/).map(function (word) {
      return word.replace(/\.html?$/i, '');
    }).filter(function (word) {
      return !lookupIsJunkWord(word, codeKey, brandKey);
    });
  }

  function lookupNameFromTitle(title, codeKey, brandKey) {
    var clean = String(title || '').split('|')[0].trim();
    clean = clean.replace(/\s+[-–]\s+([^-–]+)$/, function (all, tail) {
      return LOOKUP_COLORS[lookupKey(tail)] ? '' : all;
    });
    clean = clean.replace(/["'“”()\[\]!.,:;]+/g, ' ');
    return clean.split(/[\s\-_]+/).filter(function (word) {
      return !lookupIsJunkWord(word, codeKey, brandKey);
    });
  }

  function lookupBuildNames(text, code, brand) {
    var results = lookupParseResults(text);
    if (!results.length) return { names: [], brand: '' };
    var codeKey = lookupKey(code);
    var brandKey = brand ? lookupKey(brand) : '';
    var scored = results.map(function (item) {
      var score = 0;
      if (lookupKey(item.url).indexOf(codeKey) !== -1) score += 3;
      if (lookupKey(item.title).indexOf(codeKey) !== -1) score += 3;
      if (brandKey) {
        if (lookupKey(item.url).indexOf(brandKey) !== -1 || lookupKey(item.title).indexOf(brandKey) !== -1) score += 1;
      }
      if (/adidas\.|nike\.|puma\.|vans\.|newbalance\.|reebok\.|skechers\.|converse\./.test(item.url)) score += 2;
      if (/\.pe\//.test(item.url)) score += 1;
      return { title: item.title, url: item.url, score: score };
    }).sort(function (a, b) { return b.score - a.score; });
    var top = scored.filter(function (item) { return item.score >= 4; });
    if (!top.length) top = scored.filter(function (item) { return item.score >= 3; });
    top = top.slice(0, 4);
    var detectedBrand = brand || lookupDetectBrand(top);
    var detectedKey = lookupKey(detectedBrand);
    var picked = top;
    if (detectedBrand) {
      var sameBrand = top.filter(function (item) {
        return lookupKey(item.url).indexOf(detectedKey) !== -1;
      });
      if (sameBrand.length) picked = sameBrand;
    }
    var names = [];
    picked.forEach(function (item) {
      var words = lookupNameFromSlug(item.url, codeKey, detectedKey);
      if (!words.length) words = lookupNameFromTitle(item.title, codeKey, detectedKey);
      if (!words.length) return;
      var name = lookupTitleCase(words.join(' '));
      if (!name) return;
      if (detectedBrand && lookupKey(name).indexOf(detectedKey) === -1) {
        name = detectedBrand + ' ' + name;
      }
      if (lookupKey(name).length <= detectedKey.length + 2) return;
      if (names.indexOf(name) === -1) names.push(name);
    });
    return { names: names, brand: detectedBrand };
  }

  var LOOKUP_IMAGE_GOOD = [
    'zapatilla', 'sneaker', 'shoe', 'tenis', 'calzado', 'botin', 'boot', 'footwear',
    'deportiv', 'running', 'runner', 'trainer', 'sport', 'original', 'junior', 'kids',
    'infantil', 'mujer', 'hombre', 'women', 'men', 'unisex', 'futbol', 'football',
    'basket', 'store', 'tienda', 'shop', 'market', 'outlet', 'sale'
  ];

  var LOOKUP_IMAGE_BAD = [
    'animal', 'cougar', 'felino', 'wildlife', 'zoo', 'salvaje', 'catit', 'lion',
    'tattoo', 'tatuaje', 'dibujo', 'drawing', 'colorear', 'clipart', 'vector', 'icon',
    'logo', 'wallpaper', 'fondo', 'mascota', 'instagram', 'facebook', 'pinterest',
    'youtube', 'tiktok', 'meme', 'sticker', 'pixabay', 'shutterstock', 'istockphoto',
    'alamy', 'dreamstime', 'freepik', 'vecteezy', 'gettyimages', '123rf'
  ];

  function lookupWordHaystack(value) {
    return ' ' + normalizeText(value).replace(/[^a-z0-9]+/g, ' ') + ' ';
  }

  function lookupHasWord(words, list) {
    for (var i = 0; i < list.length; i += 1) {
      if (words.indexOf(' ' + list[i]) !== -1) return true;
    }
    return false;
  }

  function lookupParseImages(text) {
    var out = [];
    var re = /\[!\[Image \d+: Image result for[^\]]*\]\((https:\/\/th\.bing\.com\/th\/id\/(OIP\.[\w-]+)[^)]*)\)\]\((https?:\/\/[^)\s]*mediaurl=[^)\s]*)\)([\s\S]{0,1400}?)\*   \[([^\]]{3,300}?)\]\(/g;
    var match;
    while ((match = re.exec(text))) {
      var detail = match[3] || '';
      var media = '';
      try { media = decodeURIComponent((detail.match(/mediaurl=([^&]+)/) || [])[1] || ''); } catch (error) { media = ''; }
      out.push({
        oip: match[2],
        bing: 'https://th.bing.com/th/id/' + match[2] + '?w=600&h=600&c=7&r=0&o=7&pid=1.7&rm=3',
        title: String(match[5] || '').replace(/\s+/g, ' ').trim(),
        media: media
      });
      if (out.length >= 80) break;
    }
    return out;
  }

  function lookupProxyImage(url, width) {
    if (!url) return '';
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(url) + '&w=' + width + '&fit=inside&we=1&output=jpg&q=85';
  }

  function lookupModelTokens(names, code, brand) {
    var out = [];
    var seen = {};
    var codeKey = lookupKey(code);
    var brandKey = brand ? lookupKey(brand) : '';
    (names || []).forEach(function (name) {
      String(name || '').split(/[\s\-_]+/).forEach(function (word) {
        var key = lookupKey(word);
        if (key.length < 4) return;
        if (key === codeKey || key === brandKey) return;
        if (LOOKUP_STOP[key] || LOOKUP_COLORS[key]) return;
        if (codeKey && codeKey.indexOf(key) !== -1) return;
        if (/^\d+$/.test(key)) return;
        if (seen[key]) return;
        seen[key] = 1;
        out.push(key);
      });
    });
    return out;
  }

  function lookupScoreImage(item, codeKey, brandKey, modelTokens) {
    var hay = lookupKey(item.title + ' ' + item.media);
    var words = lookupWordHaystack(item.title + ' ' + item.media);
    var score = 0;
    var codeHit = false;
    if (codeKey && hay.indexOf(codeKey) !== -1) {
      if (codeKey.length >= 4 || words.indexOf(' ' + codeKey + ' ') !== -1) codeHit = true;
    }
    if (codeHit) {
      score += 100;
    } else if (codeKey.length >= 6 && hay.indexOf(codeKey.slice(0, -2)) !== -1) {
      score += 40;
    }
    var hasBrand = brandKey && hay.indexOf(brandKey) !== -1;
    var hasGood = lookupHasWord(words, LOOKUP_IMAGE_GOOD);
    var modelHit = false;
    if (modelTokens && modelTokens.length) {
      for (var i = 0; i < modelTokens.length; i += 1) {
        if (hay.indexOf(modelTokens[i]) !== -1) { modelHit = true; break; }
      }
    }
    if (modelHit && (hasBrand || hasGood)) score += 30;
    if (hasGood) score += 15;
    if (hasBrand) score += 10;
    if (lookupHasWord(words, LOOKUP_IMAGE_BAD)) score -= 120;
    return score;
  }

  function lookupPickImages(items, code, brand, names) {
    if (!items || !items.length) return [];
    var codeKey = lookupKey(code);
    var brandKey = brand ? lookupKey(brand) : '';
    var modelTokens = lookupModelTokens(names, code, brand);
    var scored = [];
    items.forEach(function (item) {
      if (!item || !item.title) return;
      var score = lookupScoreImage(item, codeKey, brandKey, modelTokens);
      if (score < 30) return;
      scored.push({
        oip: item.oip,
        score: score,
        src: lookupProxyImage(item.media, 600) || item.bing,
        url: lookupProxyImage(item.media, 1200) || item.bing,
        alt: item.bing
      });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    var seen = {};
    var out = [];
    for (var i = 0; i < scored.length; i += 1) {
      if (seen[scored[i].oip]) continue;
      seen[scored[i].oip] = 1;
      out.push({ src: scored[i].src, url: scored[i].url, alt: scored[i].alt });
      if (out.length >= 8) break;
    }
    return out;
  }

  function lookupRawImages(query) {
    return lookupFetch('https://r.jina.ai/https://www.bing.com/images/search?q=' + encodeURIComponent(query))
      .then(lookupParseImages)
      .catch(function () { return []; });
  }

  function lookupImages(brand, code, names) {
    var base = (brand ? brand + ' ' : '') + code;
    return lookupRawImages(base + ' zapatillas').then(function (raw) {
      var picked = lookupPickImages(raw, code, brand, names);
      if (picked.length >= 3) return picked;
      return lookupRawImages(base).then(function (more) {
        return lookupPickImages(raw.concat(more), code, brand, names);
      });
    });
  }

  function renderLookup(code, names, images) {
    var html = '';
    var current = el.fName.value.trim();
    if (names.length) {
      html += '<div class="lookup-row"><span class="lookup-label">Nombre</span><div class="lookup-chips">';
      names.forEach(function (name) {
        html += '<button class="lookup-chip' + (name === current ? ' active' : '') + '" type="button" data-name="' + escapeHtml(name) + '">' + escapeHtml(name) + '</button>';
      });
      html += '</div></div>';
    }
    if (images.length) {
      html += '<div class="lookup-row"><span class="lookup-label">Foto <em>toca la correcta</em></span><div class="lookup-thumbs">';
      images.forEach(function (item, index) {
        var src = item.src || item;
        var alt = item.alt || '';
        html += '<button class="lookup-thumb" type="button" data-img="' + escapeHtml(item.url || item) + '"' +
          (alt ? ' data-alt="' + escapeHtml(alt) + '"' : '') +
          ' aria-label="Usar foto ' + (index + 1) + '"><img src="' + escapeHtml(src) + '" alt="" loading="lazy"' +
          (alt ? ' onerror="this.onerror=null;this.src=\'' + alt + '\'"' : '') + '></button>';
      });
      html += '</div></div>';
    } else if (names.length) {
      html += '<p class="lookup-empty">No encontré fotos confiables para este código. Sube una foto o pega un enlace.</p>';
    }
    el.lookupBody.innerHTML = html;
    el.lookupTitle.textContent = 'Resultados para «' + code + '»';
  }

  function lookupApplyName(name) {
    el.fName.value = name;
    var chips = el.lookupBody.querySelectorAll('.lookup-chip');
    for (var i = 0; i < chips.length; i += 1) {
      chips[i].classList.toggle('active', chips[i].getAttribute('data-name') === name);
    }
  }

  function lookupApplyImage(url, alt, button) {
    button.classList.add('is-loading');
    imageFromUrl(url).catch(function () {
      if (!alt || alt === url) throw new Error('sin respaldo');
      return imageFromUrl(alt);
    }).then(function (src) {
      state.editor.image = src;
      state.editor.imageChanged = true;
      showEditorImage(src);
      var thumbs = el.lookupBody.querySelectorAll('.lookup-thumb');
      for (var i = 0; i < thumbs.length; i += 1) thumbs[i].classList.remove('active');
      button.classList.add('active');
      showToast('Foto aplicada');
    }).catch(function () {
      showToast('No se pudo cargar esa foto', true);
    }).finally(function () {
      button.classList.remove('is-loading');
    });
  }

  function closeLookup() {
    lookupSeq += 1;
    el.lookupPanel.hidden = true;
    el.lookupBody.innerHTML = '';
    el.codeFindBtn.classList.remove('is-busy');
    el.codeFindBtn.disabled = false;
  }

  function lookupByCode() {
    var code = el.fCode.value.trim();
    if (!code) {
      showToast('Escribe o escanea un código primero', true);
      el.fCode.focus();
      return;
    }
    var codeKey = lookupKey(code);
    if (codeKey.length < 3) {
      showToast('El código es muy corto', true);
      return;
    }
    var brand = el.fBrand.value.trim();
    var query = (brand ? brand + ' ' : '') + code;
    var seq = lookupSeq + 1;
    lookupSeq = seq;
    el.lookupPanel.hidden = false;
    el.lookupTitle.textContent = 'Buscando «' + code + '»';
    el.lookupBody.innerHTML = '<p class="lookup-loading">Buscando nombre y fotos…</p>';
    el.codeFindBtn.classList.add('is-busy');
    el.codeFindBtn.disabled = true;
    var cacheKey = lookupKey(brand) + '|' + codeKey;
    var cached = lookupCache[cacheKey];
    var namesPromise = cached
      ? Promise.resolve({ names: cached.names, brand: cached.brand })
      : lookupFetch('https://r.jina.ai/https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(query))
        .then(function (text) { return lookupBuildNames(text, code, brand); })
        .catch(function () { return null; });
    var imagesPromise;
    if (cached) {
      imagesPromise = Promise.resolve(cached.images);
    } else {
      imagesPromise = namesPromise.then(function (info) {
        return lookupImages(brand || (info && info.brand) || '', code, (info && info.names) || []);
      });
    }
    Promise.all([namesPromise, imagesPromise]).then(function (parts) {
      if (seq !== lookupSeq) return;
      var info = parts[0] || { names: [], brand: '' };
      var names = info.names || [];
      var images = parts[1] || [];
      if (!brand && info.brand) el.fBrand.value = info.brand;
      lookupCache[cacheKey] = { names: names, brand: info.brand || '', images: images };
      if (!names.length && !images.length) {
        el.lookupTitle.textContent = 'Sin resultados';
        el.lookupBody.innerHTML = '<p class="lookup-empty">No se encontraron datos para «' + escapeHtml(code) + '». Revisa el código o escribe el nombre a mano.</p>';
        return;
      }
      var currentName = el.fName.value.trim();
      var fallbackName = (el.fBrand.value.trim() ? el.fBrand.value.trim() + ' ' : '') + code;
      if (names.length && (!currentName || currentName === fallbackName || currentName === code)) {
        el.fName.value = names[0];
      }
      renderLookup(code, names, images);
      if (images.length) showToast('Toca la foto correcta y revisa el nombre');
    }).finally(function () {
      if (seq !== lookupSeq) return;
      el.codeFindBtn.classList.remove('is-busy');
      el.codeFindBtn.disabled = false;
    });
  }

  function collectEditorProduct() {
    var name = el.fName.value.trim();
    var brand = el.fBrand.value.trim();
    var code = el.fCode.value.trim();
    var price = parseFloat(el.fPrice.value) || 0;
    var link = el.fLink.value.trim();
    if (!name && !code && !brand) {
      showToast('Escribe al menos el nombre o el código', true);
      el.fName.focus();
      return null;
    }
    if (!brand) {
      var guess = name.split(/\s+/)[0] || '';
      brand = /^[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}$/.test(guess) ? guess : '';
    }
    var finalName = name || ((brand || 'Modelo') + ' ' + code).trim();
    var sizes = state.editor.sizes
      .filter(function (item) { return item.size; })
      .map(function (item) { return { size: item.size, quantity: parseInt(item.quantity, 10) || 0 }; });
    var existing = state.editor.id ? state.products.get(state.editor.id) : null;
    var id = state.editor.id || ('sv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    var stamp = Date.now();
    return {
      id: id,
      name: finalName,
      brand: brand,
      code: code,
      price: price,
      link: link,
      sizes: sizes,
      image: state.editor.image || '',
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: stamp,
      updatedMs: stamp
    };
  }

  function saveEditor(options) {
    var keepOpen = options && options.keepOpen;
    var product = collectEditorProduct();
    if (!product) return;
    var wasNew = !state.products.has(product.id);
    state.products.set(product.id, product);
    var previous = state.pending[product.id];
    state.pending[product.id] = {
      op: 'set',
      image: (previous && previous.image) || wasNew || state.editor.imageChanged
    };
    persistSoon();
    renderAll();
    if (keepOpen) {
      fillEditor(null);
      el.fBrand.value = product.brand || '';
      showToast('Guardada. Lista para la siguiente.');
    } else {
      closeEditor();
      showToast('Guardada en tu bóveda');
    }
    pushPending();
  }

  function deleteProduct(id) {
    askConfirm({
      title: 'Eliminar zapatilla',
      text: 'Se borrará el modelo, su foto y todo su stock de forma permanente. Esta acción no se puede deshacer.',
      okLabel: 'Eliminar'
    }).then(function (ok) {
      if (!ok) return;
      state.products.delete(id);
      state.pending[id] = { op: 'delete' };
      persistSoon();
      if (state.detailId === id) closeDetail();
      renderAll();
      showToast('Modelo eliminado');
      pushPending();
    });
  }

  function markSoldOut(id) {
    askConfirm({
      title: 'Marcar como agotada',
      text: 'Se vaciarán todas las tallas del modelo. Seguirá guardado en la bóveda para reponerlo más adelante.',
      okLabel: 'Marcar agotada',
      tone: 'neutral'
    }).then(function (ok) {
      if (!ok) return;
      var product = state.products.get(id);
      if (!product) return;
      product.sizes = [];
      product.updatedAt = Date.now();
      product.updatedMs = product.updatedAt;
      var previous = state.pending[id];
      state.pending[id] = { op: 'set', image: !!(previous && previous.image) };
      persistSoon();
      closeDetail();
      renderAll();
      showToast('Modelo marcado como agotado');
      pushPending();
    });
  }

  function toast(message, isError) {
    el.toast.textContent = message;
    el.toast.classList.toggle('is-error', !!isError);
    el.toast.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () {
      el.toast.classList.remove('is-visible');
    }, 2600);
  }

  function showToast(message, isError) {
    toast(message, isError);
  }

  function setSync(kind) {
    state.syncState = kind;
    el.syncPill.dataset.state = kind;
    var labels = {
      local: 'Local',
      connecting: 'Conectando…',
      live: 'En vivo',
      offline: 'Sin conexión',
      error: 'Error de sync'
    };
    el.syncLabel.textContent = labels[kind] || 'Local';
    var editorText = {
      local: 'Se guarda en este dispositivo',
      connecting: 'Conectando con la nube…',
      live: 'Se sincroniza automáticamente',
      offline: 'Sin conexión · se guardará local',
      error: 'Sin nube · guardado local activo'
    };
    el.editorStatus.textContent = editorText[kind] || editorText.local;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === '1') resolve();
        else existing.addEventListener('load', function () { resolve(); });
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.addEventListener('load', function () {
        script.dataset.loaded = '1';
        resolve();
      });
      script.addEventListener('error', function () {
        reject(new Error('No se pudo cargar ' + src));
      });
      document.head.appendChild(script);
    });
  }

  function ensureFirebase() {
    if (state.db) return Promise.resolve(state.db);
    var chain = Promise.resolve();
    FIREBASE_SDK.forEach(function (src) {
      chain = chain.then(function () { return loadScript(src); });
    });
    return chain.then(function () {
      if (!window.firebase || typeof window.firebase.firestore !== 'function') {
        throw new Error('Firebase no disponible');
      }
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(FIREBASE_CONFIG);
      }
      state.db = window.firebase.firestore();
      return state.db;
    });
  }

  function mergeServer(serverList) {
    var next = new Map();
    serverList.forEach(function (raw) {
      var server = normalizeProduct(raw);
      if (!server) return;
      var pend = state.pending[server.id];
      if (pend && pend.op === 'delete') return;
      var local = state.products.get(server.id);
      if (pend && pend.op === 'set') {
        next.set(server.id, local || server);
        return;
      }
      var image = '';
      var baseEntry = state.base.get(server.id);
      if (baseEntry && baseEntry.updatedMs && baseEntry.updatedMs === server.updatedMs) {
        image = baseEntry.image || server.image;
      } else if (server.image) {
        if (local && local.updatedMs === server.updatedMs && isLocalImage(local.image)) {
          image = local.image;
        } else {
          image = server.image;
        }
      } else if (local && local.image) {
        image = local.image;
      }
      server.image = image || '';
      next.set(server.id, server);
    });
    state.products.forEach(function (local, id) {
      if (next.has(id)) return;
      var pend = state.pending[id];
      if (pend && pend.op === 'set') next.set(id, local);
    });
    state.products = next;
  }

  function serializeProduct(product, includeImage) {
    var data = {
      name: product.name,
      brand: product.brand,
      code: product.code,
      price: product.price,
      link: product.link,
      sizes: product.sizes,
      updatedAt: product.updatedAt
    };
    if (product.createdAt != null) data.createdAt = product.createdAt;
    if (includeImage) data.image = product.image || '';
    return data;
  }

  function pushPending() {
    if (!state.db || !navigator.onLine) return Promise.resolve();
    var ids = Object.keys(state.pending);
    if (!ids.length) return Promise.resolve();
    return ids.reduce(function (chain, id) {
      return chain.then(function () {
        var info = state.pending[id];
        if (!info) return null;
        if (info.op === 'delete') {
          return state.db.collection('sneakers').doc(id).delete().then(function () {
            delete state.pending[id];
            persistSoon();
            return null;
          });
        }
        var product = state.products.get(id);
        if (!product) {
          delete state.pending[id];
          return null;
        }
        return state.db.collection('sneakers').doc(id)
          .set(serializeProduct(product, !!info.image), { merge: true })
          .then(function () {
            product.updatedMs = toMs(product.updatedAt) || Date.now();
            delete state.pending[id];
            persistSoon();
            return null;
          });
      }).catch(function (error) {
        console.warn('Sincronización pendiente:', error);
        setSync(navigator.onLine ? 'error' : 'offline');
        renderAll();
        throw error;
      });
    }, Promise.resolve()).then(function () {
      if (state.syncState !== 'live') setSync(navigator.onLine ? 'live' : 'offline');
      renderAll();
    }).catch(function () { /* se reintenta al reconectar */ });
  }

  function handleServerSnapshot(snapshot) {
    if (snapshot.metadata && snapshot.metadata.fromCache && snapshot.empty) return;
    var list = snapshot.docs.map(function (doc) {
      var data = doc.data() || {};
      data.id = doc.id;
      return data;
    });
    mergeServer(list);
    renderAll();
  }

  function startListeners(db) {
    if (state.listenersStarted) return;
    state.listenersStarted = true;
    var unsubProducts = db.collection('sneakers').onSnapshot(handleServerSnapshot, function (error) {
      console.warn('Listener de catálogo:', error);
      setSync(navigator.onLine ? 'error' : 'offline');
    });
    state.unsubs.push(unsubProducts);
    var unsubScans = db.collection('remote_scans').orderBy('timestamp', 'desc').limit(1)
      .onSnapshot(function (snapshot) {
        if (snapshot.empty) return;
        var latest = snapshot.docs[0].data() || {};
        var stamp = Number(latest.timestamp) || 0;
        if (Date.now() - stamp > 15000 || stamp === state.lastScanAt) return;
        state.lastScanAt = stamp;
        handleRemoteScan(String(latest.code || ''));
      }, function (error) {
        console.warn('Listener de escaneos:', error);
      });
    state.unsubs.push(unsubScans);
  }

  function connect() {
    if (state.connecting) return;
    if (!navigator.onLine) {
      setSync('offline');
      return;
    }
    state.connecting = true;
    setSync('connecting');
    ensureFirebase()
      .then(function (db) {
        return db.collection('sneakers').get({ source: 'server' }).then(function (snapshot) {
          handleServerSnapshot(snapshot);
          startListeners(db);
          setSync('live');
          return pushPending();
        });
      })
      .catch(function (error) {
        console.warn('Sin conexión a Firestore:', error);
        setSync(navigator.onLine ? 'error' : 'offline');
      })
      .finally(function () {
        state.connecting = false;
      });
  }

  function handleRemoteScan(code) {
    if (!code) return;
    showToast('Escaneo recibido: ' + code);
    var normalized = normalizeText(code).replace(/\s+/g, '');
    var found = null;
    state.products.forEach(function (product) {
      if (normalizeText(product.code).replace(/\s+/g, '') === normalized) found = product;
    });
    if (found) {
      openEditor(found);
      return;
    }
    openEditor(null);
    el.fCode.value = code;
    el.fName.value = '';
    el.fName.focus();
    lookupByCode();
  }

  function openLightbox(src) {
    el.lightboxImg.src = src;
    el.lightbox.hidden = false;
    requestAnimationFrame(function () { el.lightbox.classList.add('is-open'); });
  }

  function closeLightbox() {
    el.lightbox.classList.remove('is-open');
    setTimeout(function () {
      el.lightbox.hidden = true;
      el.lightboxImg.removeAttribute('src');
    }, 240);
  }

  function stopScanner() {
    var scanner = state.scanner;
    state.scanner = null;
    if (!scanner) {
      el.qrReader.innerHTML = '';
      return Promise.resolve();
    }
    try {
      return Promise.resolve(scanner.stop()).then(function () {
        try { scanner.clear(); } catch (error) { /* sin vista */ }
        el.qrReader.innerHTML = '';
      }).catch(function () {
        el.qrReader.innerHTML = '';
      });
    } catch (error) {
      el.qrReader.innerHTML = '';
      return Promise.resolve();
    }
  }

  function closeScanner() {
    stopScanner();
    closeModal(el.scannerModal);
  }

  function startScanner() {
    if (state.scannerBusy || state.scanner) return;
    state.scannerBusy = true;
    el.scannerStatus.textContent = 'Preparando cámara…';
    var created = null;
    loadScript(SCANNER_SRC)
      .then(function () {
        if (typeof window.Html5Qrcode !== 'function') {
          throw new Error('Escáner no disponible');
        }
        created = new window.Html5Qrcode('qr-reader');
        state.scanner = created;
        return created.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 160 } },
          function (text) { handleScanResult(text); },
          function () { /* lecturas intermedias */ }
        );
      })
      .then(function () {
        if (state.scanner !== created) {
          try {
            created.stop().then(function () { created.clear(); }).catch(function () { /* ya detenido */ });
          } catch (error) { /* ya detenido */ }
          return;
        }
        el.scannerStatus.textContent = 'Apunta la cámara al código de barras.';
      })
      .catch(function (error) {
        console.warn('Escáner:', error);
        state.scanner = null;
        el.scannerStatus.textContent = 'No se pudo abrir la cámara. Escribe el código a mano.';
      })
      .finally(function () {
        state.scannerBusy = false;
      });
  }

  function handleScanResult(text) {
    var code = String(text || '').trim();
    if (!code) return;
    stopScanner();
    closeModal(el.scannerModal);
    var normalized = normalizeText(code).replace(/\s+/g, '');
    var found = null;
    state.products.forEach(function (product) {
      if (normalizeText(product.code).replace(/\s+/g, '') === normalized) found = product;
    });
    if (found) {
      openEditor(found);
      showToast('Modelo encontrado: editando');
      return;
    }
    if (!el.editorModal.classList.contains('is-open')) openEditor(null);
    el.fCode.value = code;
    el.fName.value = el.fBrand.value ? (el.fBrand.value + ' ' + code) : code;
    showToast('Código capturado: ' + code);
    lookupByCode();
  }

  function openScanner() {
    el.manualCode.value = '';
    openModal(el.scannerModal);
    startScanner();
  }

  function imageJpegThumb(src, width, height) {
    return new Promise(function (resolve) {
      loadImage(src, isRemoteImage(src)).then(function (image) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        var scale = Math.min(width / image.width, height / image.height);
        var w = image.width * scale;
        var h = image.height * scale;
        ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      }).catch(function () {
        resolve(null);
      });
    });
  }

  function nextFrame() {
    return new Promise(function (resolve) { setTimeout(resolve, 0); });
  }

  function exportCatalogPdf() {
    if (state.pdfBusy) return;
    state.pdfBusy = true;
    var list = applyFilters();
    if (!list.length) {
      state.pdfBusy = false;
      showToast('No hay modelos para exportar', true);
      return;
    }
    showToast('Generando catálogo PDF…');
    el.pdfBtn.classList.add('is-loading');
    loadScript(JSPDF_SRC)
      .then(function () {
        var JsPdf = window.jspdf && window.jspdf.jsPDF;
        if (!JsPdf) throw new Error('jsPDF no disponible');
        var pdf = new JsPdf({ orientation: 'p', unit: 'mm', format: 'a4' });
        var pageW = 210;
        var pageH = 297;
        var margin = 12;
        var cols = 3;
        var gap = 5;
        var colW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
        var imgH = 42;
        var cardH = imgH + 24;
        var startY = 30;
        var y = startY;
        var col = 0;
        var groups = new Map();
        list.forEach(function (product) {
          var brand = product.brand || 'Sin marca';
          if (!groups.has(brand)) groups.set(brand, []);
          groups.get(brand).push(product);
        });
        var total = list.length;
        var done = 0;
        var chain = Promise.resolve();
        groups.forEach(function (products, brand) {
          chain = chain.then(function () {
            if (y + 12 + cardH > pageH - margin) {
              pdf.addPage();
              y = startY;
            }
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(15);
            pdf.setTextColor(20, 20, 20);
            pdf.text(String(brand), margin, y - 4);
            pdf.setDrawColor(210);
            pdf.line(margin, y, pageW - margin, y);
            y += 6;
            col = 0;
            var steps = products.reduce(function (acc, product) {
              return acc.then(function () {
                var x = margin + col * (colW + gap);
                if (y + cardH > pageH - margin) {
                  pdf.addPage();
                  y = startY;
                  col = 0;
                  x = margin;
                }
                return imageJpegThumb(imageSrc(product), 220, 165).then(function (thumb) {
                  pdf.setFillColor(244, 244, 246);
                  pdf.roundedRect(x, y, colW, cardH - 2, 2, 2, 'F');
                  if (thumb) {
                    try { pdf.addImage(thumb, 'JPEG', x + 1.5, y + 1.5, colW - 3, imgH - 3); } catch (error) { /* imagen omitida */ }
                  }
                  pdf.setFont('helvetica', 'bold');
                  pdf.setFontSize(8);
                  pdf.setTextColor(25, 25, 25);
                  var nameLines = pdf.splitTextToSize(product.name || product.code || '', colW - 4).slice(0, 2);
                  pdf.text(nameLines, x + 2, y + imgH + 3);
                  pdf.setFont('helvetica', 'normal');
                  pdf.setFontSize(7);
                  pdf.setTextColor(90, 90, 95);
                  var info = [];
                  if (product.code) info.push(product.code);
                  if (product.price > 0) info.push('S/. ' + Number(product.price).toFixed(2));
                  pdf.text(pdf.splitTextToSize(info.join(' · '), colW - 4)[0] || '', x + 2, y + imgH + 12);
                  var sizesText = (product.sizes || []).map(function (item) { return item.size; }).join(' · ');
                  pdf.text(pdf.splitTextToSize(sizesText, colW - 4)[0] || 'Sin tallas', x + 2, y + imgH + 17);
                  done += 1;
                  el.pdfBtn.title = 'Generando PDF ' + done + '/' + total;
                  col += 1;
                  if (col >= cols) {
                    col = 0;
                    y += cardH;
                  }
                  if (done % 6 === 0) return nextFrame();
                  return null;
                });
              });
            }, Promise.resolve());
            return steps.then(function () {
              if (col !== 0) {
                y += cardH;
                col = 0;
              }
              y += 4;
            });
          });
        });
        return chain.then(function () {
          pdf.save('Sneaker-Vault-catalogo.pdf');
          showToast('PDF listo: ' + total + ' modelos');
        });
      })
      .catch(function (error) {
        console.warn('PDF:', error);
        showToast('No se pudo generar el PDF', true);
      })
      .finally(function () {
        state.pdfBusy = false;
        el.pdfBtn.classList.remove('is-loading');
        el.pdfBtn.title = 'Exportar catálogo PDF';
      });
  }

  function brandLogoFor(brand) {
    var key = normalizeText(brand);
    if (BRAND_LOGOS[key]) return BRAND_LOGOS[key];
    var match = Object.keys(BRAND_LOGOS).find(function (candidate) {
      return key.indexOf(candidate) !== -1;
    });
    return match ? BRAND_LOGOS[match] : null;
  }

  function roundRect(ctx, x, y, w, h, radius) {
    var r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i += 1) {
      var probe = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(probe).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
        if (lines.length === maxLines) break;
      } else {
        line = probe;
      }
    }
    if (lines.length < maxLines && line) lines.push(line);
    return lines;
  }

  function socialCard(id) {
    var product = state.products.get(id);
    if (!product || state.socialBusy) return;
    state.socialBusy = true;
    showToast('Generando social card…');
    var width = 1080;
    var height = 1350;
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    var imageArea = { x: 90, y: 210, w: 900, h: 690 };
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    var gradient = ctx.createRadialGradient(width * 0.8, 80, 60, width * 0.8, 80, 700);
    gradient.addColorStop(0, 'rgba(216, 255, 86, 0.14)');
    gradient.addColorStop(1, 'rgba(216, 255, 86, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    var tasks = [loadImage(imageSrc(product)).catch(function () { return null; })];
    var logoPath = brandLogoFor(product.brand);
    if (logoPath) tasks.push(loadImage(logoPath).catch(function () { return null; }));
    Promise.all(tasks).then(function (results) {
      var photo = results[0];
      var logo = results[1] || null;
      ctx.fillStyle = '#d8ff56';
      ctx.font = '600 34px "Space Grotesk", sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('SNEAKER VAULT', 90, 110);
      ctx.fillStyle = 'rgba(243, 242, 238, 0.55)';
      ctx.font = '400 30px "Space Grotesk", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('INVENTARIO', width - 90, 110);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#101011';
      roundRect(ctx, imageArea.x, imageArea.y, imageArea.w, imageArea.h, 36);
      ctx.fill();
      if (photo) {
        var scale = Math.min(imageArea.w / photo.width, imageArea.h / photo.height);
        var pw = photo.width * scale;
        var ph = photo.height * scale;
        ctx.save();
        roundRect(ctx, imageArea.x, imageArea.y, imageArea.w, imageArea.h, 36);
        ctx.clip();
        ctx.drawImage(photo, imageArea.x + (imageArea.w - pw) / 2, imageArea.y + (imageArea.h - ph) / 2, pw, ph);
        ctx.restore();
      }
      if (logo) {
        var lh = 74;
        var lw = logo.width * (lh / logo.height);
        if (lw > 320) {
          lw = 320;
          lh = logo.height * (320 / logo.width);
        }
        ctx.globalAlpha = 0.95;
        ctx.drawImage(logo, 92, imageArea.y + 24, lw, lh);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#f3f2ee';
      ctx.font = '600 58px "Space Grotesk", sans-serif';
      var nameLines = wrapLines(ctx, product.name || product.code, 900, 2);
      var lineH = 62;
      var footerY = height - 40;
      var pillY = height - 200;
      var infoY = pillY - 22;
      var priceY = infoY - 58;
      var nameY = priceY - 88 - (nameLines.length - 1) * lineH;
      nameLines.forEach(function (line) {
        ctx.fillText(line, 90, nameY);
        nameY += lineH;
      });
      ctx.font = '600 54px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#d8ff56';
      var price = formatPrice(product.price);
      if (price) {
        ctx.fillText(price, 90, priceY);
      } else {
        ctx.font = '400 40px "Space Grotesk", sans-serif';
        ctx.fillStyle = 'rgba(243, 242, 238, 0.5)';
        ctx.fillText('Precio por confirmar', 90, priceY - 6);
      }
      ctx.font = '400 36px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(243, 242, 238, 0.62)';
      var info = [];
      if (product.brand) info.push(product.brand);
      if (product.code) info.push(product.code);
      ctx.fillText(info.join('  ·  '), 90, infoY);
      var sizesText = (product.sizes || []).map(function (item) { return item.size; }).join('  ·  ');
      if (sizesText) {
        ctx.font = '600 34px "Space Grotesk", sans-serif';
        var sizesLabel = 'Tallas ' + sizesText;
        var labelWidth = Math.min(900, ctx.measureText(sizesLabel).width + 56);
        ctx.fillStyle = '#17171a';
        roundRect(ctx, 90, pillY, labelWidth, 74, 37);
        ctx.fill();
        ctx.fillStyle = '#f3f2ee';
        ctx.fillText(sizesLabel, 90 + 28, pillY + 48);
      }
      ctx.font = '400 30px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(243, 242, 238, 0.38)';
      ctx.fillText('Sneaker Vault · Bóveda de zapatillas', 90, footerY);
      canvas.toBlob(function (blob) {
        if (!blob) {
          showToast('No se pudo generar la imagen', true);
          state.socialBusy = false;
          return;
        }
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        var safeName = (product.name || product.code || 'modelo').replace(/[^\w\-]+/g, '_').slice(0, 60);
        link.href = url;
        link.download = 'Vault_' + safeName + '.jpg';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
        showToast('Social card descargada');
        state.socialBusy = false;
      }, 'image/jpeg', 0.92);
    }).catch(function (error) {
      console.warn('Social card:', error);
      showToast('No se pudo generar la social card', true);
      state.socialBusy = false;
    });
  }

  function scheduleSearch() {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(function () {
      state.query = el.searchInput.value.trim();
      renderAll();
    }, 110);
  }

  function clearFilters() {
    state.query = '';
    state.prefs.brand = '';
    state.prefs.size = '';
    state.prefs.soldout = false;
    el.searchInput.value = '';
    el.showSoldout.checked = false;
    savePrefs();
    renderAll();
  }

  function bindEvents() {
    el.searchInput.addEventListener('input', function () {
      el.searchClear.hidden = !el.searchInput.value;
      scheduleSearch();
    });
    el.searchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        clearTimeout(state.searchTimer);
        state.query = el.searchInput.value.trim();
        renderAll();
      }
      if (event.key === 'Escape') {
        el.searchInput.value = '';
        state.query = '';
        renderAll();
      }
    });
    el.searchClear.addEventListener('click', function () {
      el.searchInput.value = '';
      state.query = '';
      renderAll();
      el.searchInput.focus();
    });

    el.brandChips.addEventListener('click', function (event) {
      var chip = event.target.closest('.brand-chip');
      if (!chip) return;
      var brand = chip.dataset.brand || '';
      state.prefs.brand = state.prefs.brand === brand ? '' : brand;
      savePrefs();
      renderAll();
    });

    el.sizeBtn.addEventListener('click', function () {
      var open = el.sizePanel.hidden;
      el.sizePanel.hidden = !open;
      el.sizeBtn.setAttribute('aria-expanded', String(open));
    });

    el.sizeChips.addEventListener('click', function (event) {
      var chip = event.target.closest('.size-option');
      if (!chip) return;
      var size = chip.dataset.size || '';
      state.prefs.size = state.prefs.size === size ? '' : size;
      savePrefs();
      renderAll();
    });

    el.clearSizeBtn.addEventListener('click', function () {
      state.prefs.size = '';
      savePrefs();
      renderAll();
    });

    el.showSoldout.checked = state.prefs.soldout;
    el.showSoldout.addEventListener('change', function () {
      state.prefs.soldout = el.showSoldout.checked;
      savePrefs();
      renderAll();
    });

    el.sortSelect.value = state.prefs.sort;
    el.sortSelect.addEventListener('change', function () {
      state.prefs.sort = el.sortSelect.value;
      savePrefs();
      renderAll();
    });

    el.clearFiltersBtn.addEventListener('click', clearFilters);

    el.grid.addEventListener('click', function (event) {
      var action = event.target.closest('[data-action]');
      var card = event.target.closest('.card');
      if (!card) return;
      var id = card.dataset.id;
      if (action) {
        event.stopPropagation();
        var kind = action.dataset.action;
        var product = state.products.get(id);
        if (!product) return;
        if (kind === 'edit') openEditor(product);
        if (kind === 'link' && product.link) {
          navigator.clipboard.writeText(product.link).then(function () {
            showToast('Enlace copiado');
          }).catch(function () {
            showToast('No se pudo copiar', true);
          });
        }
        if (kind === 'card') socialCard(id);
        return;
      }
      openDetail(id);
    });

    el.grid.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('[data-action]')) return;
      var card = event.target.closest('.card');
      if (!card) return;
      event.preventDefault();
      openDetail(card.dataset.id);
    });

    el.detailModal.addEventListener('click', function (event) {
      if (event.target.closest('[data-close]')) {
        closeDetail();
        return;
      }
      var lightboxTarget = event.target.closest('[data-lightbox]');
      if (lightboxTarget) {
        openLightbox(lightboxTarget.getAttribute('data-lightbox'));
        return;
      }
      var action = event.target.closest('[data-act]');
      if (!action) return;
      var id = state.detailId;
      var product = id ? state.products.get(id) : null;
      var kind = action.dataset.act;
      if (kind === 'edit' && product) openEditor(product);
      if (kind === 'copy' && product && product.link) {
        navigator.clipboard.writeText(product.link).then(function () {
          showToast('Enlace copiado');
        }).catch(function () {
          showToast('No se pudo copiar', true);
        });
      }
      if (kind === 'google' && product) {
        window.open('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(product.name || product.code || ''), '_blank', 'noopener');
      }
      if (kind === 'card' && id) socialCard(id);
      if (kind === 'soldout' && id) markSoldOut(id);
      if (kind === 'delete' && id) deleteProduct(id);
    });

    el.addBtn.addEventListener('click', function () { openEditor(null); });
    el.pdfBtn.addEventListener('click', exportCatalogPdf);

    el.editorModal.addEventListener('click', function (event) {
      if (event.target.closest('[data-close]')) closeEditor();
    });

    el.dropzone.addEventListener('click', function () { el.imageInput.click(); });
    el.dropzone.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        el.imageInput.click();
      }
    });
    el.pickImageBtn.addEventListener('click', function () { el.imageInput.click(); });
    el.imageInput.addEventListener('change', function () {
      if (el.imageInput.files && el.imageInput.files[0]) {
        handleImageFile(el.imageInput.files[0]);
      }
      el.imageInput.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (type) {
      el.dropzone.addEventListener(type, function (event) {
        event.preventDefault();
        el.dropzone.classList.add('is-drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      el.dropzone.addEventListener(type, function (event) {
        event.preventDefault();
        el.dropzone.classList.remove('is-drag');
      });
    });
    el.dropzone.addEventListener('drop', function (event) {
      var file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
      if (file) handleImageFile(file);
    });
    el.removeImageBtn.addEventListener('click', function () {
      state.editor.image = null;
      state.editor.imageChanged = true;
      showEditorImage(null);
    });

    document.addEventListener('paste', function (event) {
      if (!el.editorModal.classList.contains('is-open')) return;
      var items = event.clipboardData ? event.clipboardData.items : null;
      if (!items) return;
      for (var i = 0; i < items.length; i += 1) {
        if (items[i].type && items[i].type.indexOf('image') === 0) {
          var file = items[i].getAsFile();
          if (file) {
            event.preventDefault();
            handleImageFile(file);
          }
          return;
        }
      }
    });

    el.autofillBtn.addEventListener('click', autofillFromLink);
    el.codeFindBtn.addEventListener('click', lookupByCode);
    el.lookupClose.addEventListener('click', closeLookup);
    el.lookupBody.addEventListener('click', function (event) {
      var chip = event.target.closest('.lookup-chip');
      if (chip) {
        lookupApplyName(chip.getAttribute('data-name'));
        return;
      }
      var thumb = event.target.closest('.lookup-thumb');
      if (thumb) lookupApplyImage(thumb.getAttribute('data-img'), thumb.getAttribute('data-alt'), thumb);
    });
    el.fCode.addEventListener('input', function () {
      if (!el.lookupPanel.hidden) closeLookup();
    });

    el.sizeRows.addEventListener('click', function (event) {
      var row = event.target.closest('.size-row');
      if (!row) return;
      var index = parseInt(row.dataset.index, 10);
      if (event.target.closest('.size-remove')) {
        state.editor.sizes.splice(index, 1);
        renderSizeRows();
        return;
      }
      var stepBtn = event.target.closest('[data-step]');
      if (stepBtn) {
        var step = parseInt(stepBtn.dataset.step, 10) || 0;
        var item = state.editor.sizes[index];
        if (!item) return;
        item.quantity = Math.max(0, (parseInt(item.quantity, 10) || 0) + step);
        renderSizeRows();
      }
    });

    el.sizeRows.addEventListener('input', function (event) {
      var input = event.target;
      if (input.tagName !== 'INPUT') return;
      var row = input.closest('.size-row');
      var index = parseInt(row.dataset.index, 10);
      var item = state.editor.sizes[index];
      if (!item) return;
      item.quantity = Math.max(0, parseInt(input.value, 10) || 0);
      updateSizeTotal();
    });

    el.addCustomSizeBtn.addEventListener('click', function () {
      var value = el.customSize.value.replace(',', '.').trim();
      if (!value) return;
      addEditorSize(value, 1);
      el.customSize.value = '';
    });
    el.customSize.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        el.addCustomSizeBtn.click();
      }
    });

    el.editorForm.addEventListener('submit', function (event) {
      event.preventDefault();
      saveEditor({});
    });
    el.saveNextBtn.addEventListener('click', function () {
      saveEditor({ keepOpen: true });
    });

    el.scanBtn.addEventListener('click', openScanner);
    el.scannerModal.addEventListener('click', function (event) {
      if (event.target.closest('[data-scanner-close]')) closeScanner();
    });
    el.manualCodeBtn.addEventListener('click', function () {
      var code = el.manualCode.value.trim();
      if (!code) return;
      handleScanResult(code);
    });
    el.manualCode.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        el.manualCodeBtn.click();
      }
    });

    el.confirmOk.addEventListener('click', function () { resolveConfirm(true); });
    el.confirmCancel.addEventListener('click', function () { resolveConfirm(false); });
    el.confirmModal.addEventListener('click', function (event) {
      if (event.target.closest('[data-confirm-close]')) resolveConfirm(false);
    });

    el.lightboxClose.addEventListener('click', closeLightbox);
    el.lightbox.addEventListener('click', function (event) {
      if (event.target === el.lightbox) closeLightbox();
    });

    el.syncPill.addEventListener('click', function () {
      if (state.syncState === 'live') {
        showToast('Catálogo sincronizado en vivo');
        return;
      }
      showToast('Reconectando…');
      connect();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        if (!el.lightbox.hidden) {
          closeLightbox();
          return;
        }
        if (el.scannerModal.classList.contains('is-open')) {
          closeScanner();
          return;
        }
        if (el.confirmModal.classList.contains('is-open')) {
          resolveConfirm(false);
          return;
        }
        if (el.editorModal.classList.contains('is-open')) {
          closeEditor();
          return;
        }
        if (el.detailModal.classList.contains('is-open')) {
          closeDetail();
        }
        return;
      }
      if (event.key === '/' && document.activeElement !== el.searchInput
        && !el.editorModal.classList.contains('is-open')
        && !el.scannerModal.classList.contains('is-open')) {
        var tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          event.preventDefault();
          el.searchInput.focus();
        }
      }
    });

    window.addEventListener('online', function () {
      setSync('connecting');
      connect();
    });
    window.addEventListener('offline', function () {
      setSync('offline');
    });
  }

  function populateBrandDatalist() {
    var brands = brandInventory().map(function (entry) { return entry[0]; });
    el.brandList.innerHTML = brands.map(function (brand) {
      return '<option value="' + escapeHtml(brand) + '"></option>';
    }).join('');
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    navigator.serviceWorker.register('sw.js').catch(function () { /* sin soporte */ });
  }

  function scheduleConnect() {
    if (state.idleDone) return;
    state.idleDone = true;
    var run = function () { connect(); };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 1600 });
    } else {
      setTimeout(run, 700);
    }
  }

  function init() {
    cacheElements();
    loadPrefs();
    buildInitialState();
    populateBrandDatalist();
    bindEvents();
    setSync('local');
    renderAll();
    registerServiceWorker();
    scheduleConnect();
    if (location.hash === '#nueva') {
      openEditor(null);
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
