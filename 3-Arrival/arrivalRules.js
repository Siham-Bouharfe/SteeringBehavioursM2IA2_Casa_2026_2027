const ArrivalRules = (() => {
  function isMilestone(snacksEaten, interval = 10) {
    return Number.isInteger(snacksEaten) && snacksEaten > 0 && snacksEaten % interval === 0;
  }

  function isCombo(lastSnackAt, now, windowMs = 2500) {
    return now - lastSnackAt >= 0 && now - lastSnackAt < windowMs;
  }

  return { isMilestone, isCombo };
})();

if (typeof module !== 'undefined') module.exports = { ArrivalRules };
