(function () {
  function init() {
    var form = document.querySelector('.calc-card');
    if (!form) return;

    var tabs = form.querySelectorAll('.calc-tab');
    var ageEl = document.getElementById('macro-age');
    var heightEl = document.getElementById('macro-height');
    var weightEl = document.getElementById('macro-weight');
    var activityEl = document.getElementById('macro-activity');
    var goalEl = document.getElementById('macro-goal');
    var gender = 'male';

    var outCalories = document.getElementById('macro-calories');
    var outProtein = document.getElementById('macro-protein');
    var outCarbs = document.getElementById('macro-carbs');
    var outFat = document.getElementById('macro-fat');

    var locale = document.documentElement.lang || 'en';

    function fmt(n) {
      return Math.round(n).toLocaleString(locale);
    }

    function calculate() {
      var age = parseFloat(ageEl.value) || 0;
      var height = parseFloat(heightEl.value) || 0;
      var weight = parseFloat(weightEl.value) || 0;
      var activity = parseFloat(activityEl.value) || 1.2;
      var goal = goalEl.value;

      var bmr = gender === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;

      var tdee = bmr * activity;
      var calories = tdee;
      if (goal === 'lose') calories = tdee - 500;
      else if (goal === 'gain') calories = tdee + 300;

      var proteinKcal = calories * 0.30;
      var carbsKcal = calories * 0.40;
      var fatKcal = calories * 0.30;

      outCalories.textContent = fmt(calories);
      outProtein.textContent = fmt(proteinKcal / 4);
      outCarbs.textContent = fmt(carbsKcal / 4);
      outFat.textContent = fmt(fatKcal / 9);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        gender = tab.getAttribute('data-gender');
        calculate();
      });
    });

    [ageEl, heightEl, weightEl, activityEl, goalEl].forEach(function (el) {
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
