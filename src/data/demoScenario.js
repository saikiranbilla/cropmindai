export const demoScenario = {
  fieldInfo: {
    location: "Champaign County, IL - Unit 004",
    crop: "Corn",
    plantingDate: "April 28, 2026",
    agronomicStage: "V8",
    adjusterStage: "10-Leaf (Horizontal Leaf Method)"
  },
  weatherEvent: {
    type: "Severe Convective Storm (Hail & Wind)",
    dateOfLoss: "June 25, 2026",
    precip: "1.8 inches"
  },
  scoutingPoints: [
    { id: 1, lat: 40.1105, lng: -88.2401, severity: "high",   zone: "A", damageType: "Defoliation"  },
    { id: 2, lat: 40.1112, lng: -88.2395, severity: "medium", zone: "A", damageType: "Defoliation"  },
    { id: 3, lat: 40.1098, lng: -88.2410, severity: "low",    zone: "B", damageType: "Wind Lodging" },
    { id: 4, lat: 40.1120, lng: -88.2380, severity: "high",   zone: "A", damageType: "Defoliation"  },
    { id: 5, lat: 40.1085, lng: -88.2425, severity: "low",    zone: "B", damageType: "Wind Lodging" },
    { id: 6, lat: 40.1130, lng: -88.2370, severity: "medium", zone: "A", damageType: "Defoliation"  }
  ],
  agentOutputs: {
    vision:        "Analyzed 1/100th acre samples (17.4 feet). Detected 80% leaf area destruction. Horizontal leaf method stages plant at 10-leaf.",
    environmental: "Radar confirms 1.5 inch hail core tracking over coordinates at 16:00 CST.",
    spatial:       "Clustering confirms Zone A (Ridge) suffered primary hail impact. Zone B exhibits localized root lodging.",
    insurance:     "FCIC-25080 Exhibit 15 applied. 10-leaf corn with 80% defoliation correlates to 11% yield loss penalty.",
    synthesis:     "Pre-qualification complete. 11% yield loss estimated on affected acreage. Crop possesses physiological time to recover. Recommend filing NOL but delaying final appraisal."
  },
  insuranceMatches: [
    {
      reference:   "FCIC-25080",
      title:       "Corn Loss Adjustment Standards Handbook - Defoliation",
      explanation: "Your corn is at the 10-leaf stage (adjuster method). Even with 80% visible leaf damage, the actuarial yield loss is only 11% because the growing point is intact and new leaves will form.",
      relevance:   "High"
    },
    {
      reference:   "CCIP Section 14",
      title:       "Duties in the Event of Damage",
      explanation: "Written confirmation of loss must be submitted within 15 days of your initial verbal notice.",
      relevance:   "Critical"
    }
  ],
  actionItems: [
    { text: "File Notice of Loss (NOL) within 72 hours of damage discovery.",                                                                                   urgent: true,  checked: false },
    { text: "Do NOT destroy the crop or replant without written adjuster consent. This results in an appraised yield equal to the full guarantee (zero indemnity).", urgent: true,  checked: false },
    { text: "Leave representative sample areas intact if harvesting early.",                                                                                    urgent: false, checked: false }
  ]
}
