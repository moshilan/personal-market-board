const officialNotice = (postId) => `https://drc.gd.gov.cn/spjg/content/post_${postId}.html`

export const GUANGDONG_FUEL_HISTORY_BACKFILL = [
  { effectiveFrom: '2026-09-24T16:00:00.000Z', sourceUrl: officialNotice('4960319'), prices: { '92号汽油': 8.63, '95号汽油': 9.35, '0号柴油': 8.31 } },
  { effectiveFrom: '2026-09-11T16:00:00.000Z', sourceUrl: officialNotice('4954696'), prices: { '92号汽油': 8.31, '95号汽油': 9.00, '0号柴油': 7.98 } },
  { effectiveFrom: '2026-08-28T16:00:00.000Z', sourceUrl: officialNotice('4948266'), prices: { '92号汽油': 8.10, '95号汽油': 8.78, '0号柴油': 7.76 } },
  { effectiveFrom: '2026-08-14T16:00:00.000Z', sourceUrl: officialNotice('4942633'), prices: { '92号汽油': 7.80, '95号汽油': 8.45, '0号柴油': 7.45 } },
  { effectiveFrom: '2026-07-31T16:00:00.000Z', sourceUrl: officialNotice('4936357'), prices: { '92号汽油': 7.99, '95号汽油': 8.65, '0号柴油': 7.64 } },
  { effectiveFrom: '2026-07-17T16:00:00.000Z', sourceUrl: officialNotice('4926319'), prices: { '92号汽油': 7.44, '95号汽油': 8.06, '0号柴油': 7.08 } },
  { effectiveFrom: '2026-07-03T16:00:00.000Z', sourceUrl: officialNotice('4919967'), prices: { '92号汽油': 7.20, '95号汽油': 7.80, '0号柴油': 6.83 } },
  { effectiveFrom: '2026-06-18T16:00:00.000Z', sourceUrl: officialNotice('4913645'), prices: { '92号汽油': 7.96, '95号汽油': 8.62, '0号柴油': 7.62 } },
  { effectiveFrom: '2026-06-04T16:00:00.000Z', sourceUrl: officialNotice('4906704'), prices: { '92号汽油': 8.37, '95号汽油': 9.07, '0号柴油': 8.04 } },
  { effectiveFrom: '2026-05-21T16:00:00.000Z', sourceUrl: officialNotice('4899816'), prices: { '92号汽油': 8.79, '95号汽油': 9.53, '0号柴油': 8.47 } },
]
