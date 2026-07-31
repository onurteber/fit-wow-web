(function () {
  function init() {
    var card = document.querySelector('.calc-card');
    if (!card) return;

    var heightEl = document.getElementById('iw-height');
    var minEl = document.getElementById('iw-min');
    var maxEl = document.getElementById('iw-max');
    if (!heightEl || !minEl || !maxEl) return;

    var locale = document.documentElement.lang || 'en';

    function fmt(n) {
      return Math.round(n).toLocaleString(locale);
    }

    function calculate() {
      var h = parseFloat(heightEl.value) || 0;
      if (h <= 0) return;

      var hm = h / 100;
      var min = 18.5 * hm * hm;
      var max = 24.9 * hm * hm;

      minEl.textContent = fmt(min);
      maxEl.textContent = fmt(max);
    }

    heightEl.addEventListener('input', calculate);
    heightEl.addEventListener('change', calculate);

    calculate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
