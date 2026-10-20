// 8 : quatre gènes contrôlent attraction, répulsion et rayons de perception.
const GardenGenetics = Object.freeze({
  create(random = Math.random) {
    return { foodWeight: 0.4 + random() * 0.6, dangerWeight: 1.2 + random(),
      foodRadius: 130 + random() * 120, dangerRadius: 100 + random() * 60, generation: 1 };
  },
  valid(dna) {
    return dna && ['foodWeight', 'dangerWeight', 'foodRadius', 'dangerRadius', 'generation']
      .every(key => Number.isFinite(dna[key])) && dna.foodWeight >= 0.2 && dna.foodWeight <= 1.5 &&
      dna.dangerWeight >= 0.8 && dna.dangerWeight <= 3 && dna.foodRadius >= 80 && dna.foodRadius <= 300 &&
      dna.dangerRadius >= 80 && dna.dangerRadius <= 200 && Number.isSafeInteger(dna.generation) && dna.generation >= 1;
  },
  mutate(parent, random = Math.random) {
    const vary = (value, amount, low, high) => Math.max(low, Math.min(high, value + (random() * 2 - 1) * amount));
    return { foodWeight: vary(parent.foodWeight, 0.12, 0.2, 1.5),
      dangerWeight: vary(parent.dangerWeight, 0.18, 0.8, 3), foodRadius: vary(parent.foodRadius, 15, 80, 300),
      dangerRadius: vary(parent.dangerRadius, 10, 80, 200), generation: parent.generation + 1 };
  },
});
if (typeof module !== 'undefined' && module.exports) module.exports = GardenGenetics;
