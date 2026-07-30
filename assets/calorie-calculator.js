(function () {
  function init() {
    var form = document.querySelector('.calc-card');
    if (!form) return;

    var tabs = form.querySelectorAll('.calc-tab');
    var ageEl = document.getElementById('calc-age');
    var heightEl = document.getElementById('calc-height');
    var weightEl = document.getElementById('calc-weight');
    var activityEl = document.getElementById('calc-activity');
    var gender = 'male';

    var outMaintenance = document.getElementById('calc-maintenance');
    var outLoss = document.getElementById('calc-loss');
    var outMildDeficit = document.getElementById('calc-mild-deficit');
    var outMaintenance2 = document.getElementById('calc-maintenance-2');
    var outGain = document.getElementById('calc-gain');

    var locale = document.documentElement.lang || 'en';

    function fmt(n) {
      return Math.round(n).toLocaleString(locale);
    }

    function calculate() {
      var age = parseFloat(ageEl.value) || 0;
      var height = parseFloat(heightEl.value) || 0;
      var weight = parseFloat(weightEl.value) || 0;
      var activity = parseFloat(activityEl.value) || 1.2;

      var bmr = gender === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;

      var maintenance = bmr * activity;

      outMaintenance.textContent = fmt(maintenance);
      outLoss.textContent = fmt(maintenance - 500);
      outMildDeficit.textContent = fmt(maintenance - 250);
      outMaintenance2.textContent = fmt(maintenance);
      outGain.textContent = fmt(maintenance + 500);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        gender = tab.getAttribute('data-gender');
        calculate();
      });
    });

    [ageEl, heightEl, weightEl, activityEl].forEach(function (el) {
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
