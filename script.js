// ============ ROI Calculator ============
(function () {
  const visitors = document.getElementById('visitors');
  const conv = document.getElementById('conv');
  const close = document.getElementById('close');
  const value = document.getElementById('value');
  if (!visitors) return;

  const visitorsLabel = document.getElementById('visitorsLabel');
  const convLabel = document.getElementById('convLabel');
  const closeLabel = document.getElementById('closeLabel');
  const valueLabel = document.getElementById('valueLabel');
  const leadsOut = document.getElementById('leadsOut');
  const custOut = document.getElementById('custOut');
  const revOut = document.getElementById('revOut');
  const annualOut = document.getElementById('annualOut');
  const paybackOut = document.getElementById('paybackOut');

  const fmt = (n) => '$' + Math.round(n).toLocaleString();
  const num = (n) => Math.round(n).toLocaleString();

  function update() {
    const v = +visitors.value;
    const c = +conv.value;
    const cl = +close.value;
    const val = +value.value;

    const leads = (v * c) / 100;
    const customers = (leads * cl) / 100;
    const revenue = customers * val;

    visitorsLabel.textContent = num(v);
    convLabel.textContent = c + '%';
    closeLabel.textContent = cl + '%';
    valueLabel.textContent = fmt(val);

    leadsOut.textContent = num(leads);
    custOut.textContent = num(customers);
    revOut.textContent = fmt(revenue);
    annualOut.textContent = fmt(revenue * 12);

    let payback = 'about 1 month';
    if (revenue > 0) {
      const months = 3200 / revenue;
      if (months < 1) payback = 'under 1 month';
      else if (months < 12) payback = `about ${Math.ceil(months)} months`;
      else payback = `${Math.ceil(months)} months`;
    }
    paybackOut.textContent = payback;
  }

  [visitors, conv, close, value].forEach((el) => el.addEventListener('input', update));
  update();
})();

// ============ Lead form (saves to localStorage as MVP) ============
(function () {
  const form = document.getElementById('leadForm');
  if (!form) return;
  const status = document.getElementById('formStatus');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.id = Date.now();
    data.receivedAt = new Date().toISOString();
    data.source = 'contact-form';

    const leads = JSON.parse(localStorage.getItem('lighthouse.leads') || '[]');
    leads.unshift(data);
    localStorage.setItem('lighthouse.leads', JSON.stringify(leads));

    /* TO GO LIVE: replace the localStorage block above with a real endpoint, e.g.:
       await fetch('https://formspree.io/f/YOUR_ID', { method: 'POST', body: new FormData(form) });
    */

    status.classList.remove('hidden');
    status.textContent = "Thanks! We've received your request and will reply within 1 business day.";
    status.className = 'text-sm text-center text-emerald-600 font-semibold';
    form.reset();
  });
})();

// ============ Footer year ============
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ============ Audit Tool ============
(function () {
  const auditForm = document.getElementById('auditForm');
  if (!auditForm) return;

  const urlInput = document.getElementById('auditUrl');
  const emailInput = document.getElementById('auditEmail');
  const runBtn = document.getElementById('auditRun');
  const intro = document.getElementById('auditIntro');
  const loading = document.getElementById('auditLoading');
  const results = document.getElementById('auditResults');
  const errorBox = document.getElementById('auditError');

  // ---- helpers ----
  const setGauge = (el, score) => {
    const offset = 283 - (283 * score) / 100;
    el.style.strokeDashoffset = offset;
    if (score >= 80) el.style.stroke = '#10B981';
    else if (score >= 50) el.style.stroke = '#F59E0B';
    else el.style.stroke = '#EF4444';
  };

  const verdict = (score) => {
    if (score >= 80) return { word: 'Strong', cls: 'text-emerald-600' };
    if (score >= 50) return { word: 'Needs work', cls: 'text-amber-600' };
    return { word: 'Critical', cls: 'text-rose-600' };
  };

  const normalizeUrl = (raw) => {
    let u = (raw || '').trim();
    if (!u) return null;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { return new URL(u).toString(); } catch { return null; }
  };

  // ---- main audit (uses Google PageSpeed Insights API) ----
  // To increase quota, add your key:  &key=YOUR_KEY
  async function runPageSpeedAudit(url) {
    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices`;
    const res = await fetch(api);
    if (!res.ok) throw new Error('PageSpeed API request failed (' + res.status + ')');
    const data = await res.json();
    const cats = data.lighthouseResult?.categories || {};
    const audits = data.lighthouseResult?.audits || {};
    const pct = (c) => Math.round(((c?.score) || 0) * 100);

    return {
      performance: pct(cats.performance),
      seo: pct(cats.seo),
      accessibility: pct(cats.accessibility),
      bestPractices: pct(cats['best-practices']),
      lcp: audits['largest-contentful-paint']?.displayValue || '—',
      cls: audits['cumulative-layout-shift']?.displayValue || '—',
      fcp: audits['first-contentful-paint']?.displayValue || '—',
      tbt: audits['total-blocking-time']?.displayValue || '—',
      finalUrl: data.lighthouseResult?.finalUrl || url,
    };
  }

  // Fallback heuristic audit (no external call) — used if API fails or rate-limits
  function fallbackAudit(url) {
    const seed = [...url].reduce((a, c) => a + c.charCodeAt(0), 0);
    const r = (min, max) => min + (seed % (max - min + 1));
    return {
      performance: r(35, 78),
      seo: r(50, 85),
      accessibility: r(55, 88),
      bestPractices: r(60, 90),
      lcp: '3.8 s',
      cls: '0.18',
      fcp: '2.1 s',
      tbt: '480 ms',
      finalUrl: url,
      simulated: true,
    };
  }

  function renderResults(scores, url, email) {
    const overall = Math.round(
      (scores.performance + scores.seo + scores.accessibility + scores.bestPractices) / 4
    );

    // ---- save audit lead ----
    const leads = JSON.parse(localStorage.getItem('lighthouse.leads') || '[]');
    leads.unshift({
      id: Date.now(),
      receivedAt: new Date().toISOString(),
      source: 'audit',
      email,
      auditedUrl: url,
      overallScore: overall,
      scores,
    });
    localStorage.setItem('lighthouse.leads', JSON.stringify(leads));

    // ---- gauges ----
    setGauge(document.getElementById('gOverall'), overall);
    setGauge(document.getElementById('gPerf'), scores.performance);
    setGauge(document.getElementById('gSeo'), scores.seo);
    setGauge(document.getElementById('gA11y'), scores.accessibility);
    setGauge(document.getElementById('gBp'), scores.bestPractices);

    document.getElementById('overallScore').textContent = overall;
    document.getElementById('perfScore').textContent = scores.performance;
    document.getElementById('seoScore').textContent = scores.seo;
    document.getElementById('a11yScore').textContent = scores.accessibility;
    document.getElementById('bpScore').textContent = scores.bestPractices;

    const v = verdict(overall);
    const verdictEl = document.getElementById('overallVerdict');
    verdictEl.textContent = v.word;
    verdictEl.className = 'font-display font-bold text-2xl ' + v.cls;

    document.getElementById('auditedUrl').textContent = scores.finalUrl;
    document.getElementById('mLcp').textContent = scores.lcp;
    document.getElementById('mCls').textContent = scores.cls;
    document.getElementById('mFcp').textContent = scores.fcp;
    document.getElementById('mTbt').textContent = scores.tbt;

    // ---- losing-money estimate ----
    const lostPercent = Math.max(0, 100 - overall);
    const lostMonthly = Math.round((lostPercent / 100) * 2400);
    document.getElementById('lostMonthly').textContent = '$' + lostMonthly.toLocaleString();
    document.getElementById('lostAnnual').textContent =
      '$' + (lostMonthly * 12).toLocaleString();

    // ---- show simulated badge if applicable ----
    const sim = document.getElementById('simulatedBadge');
    if (scores.simulated) sim.classList.remove('hidden');
    else sim.classList.add('hidden');

    intro.classList.add('hidden');
    loading.classList.add('hidden');
    results.classList.remove('hidden');
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  auditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');
    const url = normalizeUrl(urlInput.value);
    if (!url) {
      errorBox.textContent = 'Please enter a valid website URL.';
      errorBox.classList.remove('hidden');
      return;
    }

    intro.classList.add('hidden');
    results.classList.add('hidden');
    loading.classList.remove('hidden');
    runBtn.disabled = true;

    try {
      const scores = await runPageSpeedAudit(url);
      renderResults(scores, url, emailInput.value);
    } catch (err) {
      console.warn('PageSpeed failed, using fallback:', err);
      const scores = fallbackAudit(url);
      renderResults(scores, url, emailInput.value);
    } finally {
      runBtn.disabled = false;
    }
  });

  // ---- Paid upgrade ----
  // To accept payments, paste your Stripe Payment Link below (Stripe → Payment Links → Create).
  const STRIPE_PAYMENT_LINK = ''; // e.g. 'https://buy.stripe.com/test_xxx'

  document.querySelectorAll('[data-upgrade]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (STRIPE_PAYMENT_LINK) {
        window.location.href = STRIPE_PAYMENT_LINK;
      } else {
        const modal = document.getElementById('upgradeModal');
        modal.classList.remove('hidden');
      }
    });
  });

  const closeModal = document.getElementById('closeModal');
  if (closeModal) {
    closeModal.addEventListener('click', () => {
      document.getElementById('upgradeModal').classList.add('hidden');
    });
  }
})();

// ============ Reveal on scroll ============
(function () {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || !els.length) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
})();
