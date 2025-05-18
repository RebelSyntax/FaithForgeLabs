const propertyKeys = [
  "iconClarity",
  "typography",
  "balance",
  "scalability",
  "faithTechFusion",
  "originality",
  "emotionalImpact",
  "bonus"
];

// logos is your old array
const newLogos = logos.map(logo => ({
  filename: logo.filename,
  scores: Object.fromEntries(
    propertyKeys.map((key, i) => [key, logo.scores[i]])
  ),
  notes: logo.notes
}));