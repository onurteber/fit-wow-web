(function () {
  function init() {
    var card = document.querySelector('.calc-card');
    if (!card) return;

    var heightEl = document.getElementById('bmi-height');
    var weightEl = document.getElementById('bmi-weight');
    var valueEl = document.getElementById('bmi-value');
    var badgeEl = document.getElementById('bmi-badge');
    if (!heightEl || !weightEl || !valueEl || !badgeEl) return;

    var locale = document.documentElement.lang || 'en';
    var labels = window.BMI_LABELS || { under: 'Underweight', normal: 'Normal', over: 'Overweight', obese: 'Obese' };

    function calculate() {
      var h = parseFloat(heightEl.value) || 0;
      var w = parseFloat(weightEl.value) || 0;
      if (h <= 0 || w <= 0) return;

      var bmi = w / ((h / 100) * (h / 100));

      var cat, cls;
      if (bmi < 18.5) { cat = labels.under; cls = 'under'; }
      else if (bmi < 25) { cat = labels.normal; cls = 'normal'; }
      else if (bmi < 30) { cat = labels.over; cls = 'over'; }
      else { cat = labels.obese; cls = 'obese'; }

      valueEl.textContent = bmi.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      badgeEl.textContent = cat;
      badgeEl.className = 'calc-badge calc-badge--' + cls;
    }

    [heightEl, weightEl].forEach(function (el) {
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    calculate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
