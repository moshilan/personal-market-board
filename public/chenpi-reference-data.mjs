const collectedAt = '2026-09-28';
const quote = (data) => ({ priceDate: null, sourceDate: null, collectedAt, ...data });
const media = {
  market: { sourceName: '信息时报｜清平中药材市场走访', sourceUrl: 'https://huacheng.gz-cmc.com/pages/2026/01/13/4b7567cf031e46469178443dd4e1f0b6.html', sourceDate: '2026-01-13', observationType: '实地走访 · 零售观察', period: '2026-observation' },
  taKungPao: { sourceName: '大公报｜新会一线产区陈皮价格一览', sourceUrl: 'https://dw-media.tkww.hk/epaper/tkp/20251012/A14_Screen.pdf', sourceDate: '2025-10-12', observationType: '媒体价格表 · 历史资料', period: 'historical' },
  health: { sourceName: '健康时报｜媒体转述指导参考', sourceUrl: 'https://www.jksb.com.cn/index.php?a=show&catid=788&id=256999&m=wap', sourceDate: '2026-07-28', priceDate: '2026-01', observationType: '行业指导价转述 · 原公告待核', period: '2026-observation' },
};
const luoSource = { sourceName: '惠农网｜罗立荣供应页面', sourceUrl: 'https://www.cnhnb.com/gongying/5707835/', merchant: '罗立荣' };
const taKungPaoNote = '投资报道中的媒体参考表，未披露采价日期、样本数量及批发或零售性质；不代表成交价或官方指数，不按产区折扣推算其他村价格。';
const pageCheck = (text, observedAt, observedPrice, offerText, excerpt) => ({
  checkedAt: collectedAt, state: 'price-visible', method: 'direct-page', httpStatus: 200,
  text, observedAt, observedPrice, offerText, excerpt,
});
const historicalCircle = (years, peel, min, max) => quote({
  id: `historical-circle-${years}-${peel}`, label: `${years}年圈枝${peel}${years === 1 ? '（原表年档，非足3年陈皮）' : ''}`,
  yearBand: years, peelType: peel,
  price: { min, max, unit: '元/斤' }, originalText: `${years}年圈枝${peel}：${min}-${max}；原单位人民币／斤`,
  priceType: '历史媒体价格表', ...media.taKungPao, circle: '圈枝',
  note: `${taKungPaoNote}${years < 10 ? '原表十年以下为新树价格，以梅江为基准。' : '未给出各村独立采价。'}`,
});

export const CHENPI_REFERENCE = {
  collectedAt,
  conflictNote: '2026年媒体转述10年圈枝指导参考为3500～5000元/斤；2025年媒体表10年圈枝青皮4500～6000、二红6000～7500、大红7500～10000元/斤。价格差异明显，来源日期、皮类、价格性质及采价方法不同，不能合成统一行情，也不能推算四村排名。',
  market: [
    quote({
      id: 'market-3-to-5-years', label: '3–5年', price: { min: 400, max: 1160, unit: '元/公斤' },
      originalText: '3年～5年的新会陈皮零售价为400元～1160元/公斤', priceType: '零售调查观察', ...media.market,
      note: '记者走访广州清平中药材市场的零售区间；未绑定村级产区、圈枝或驳枝、等级及仓储，不拆成独立3年或5年报价。',
    }),
    quote({
      id: 'market-7-to-8-years', label: '7–8年', price: { min: 1600, max: 2400, unit: '元/公斤' },
      originalText: '7年～8年份的陈皮为1600元～2400元/公斤', priceType: '零售调查观察', ...media.market,
      note: '同次清平市场走访的零售区间；未绑定村级产区、枝型、等级及仓储。',
    }),
    quote({
      id: 'market-8-to-10-plus-years', label: '8–10年及以上', price: { min: 2400, max: 4000, unit: '元/公斤', openEnded: true },
      originalText: '8年～10年及以上年份的陈皮，价格甚至高达2400元～4000元以上/公斤', priceType: '零售调查观察', ...media.market,
      note: '原报道区间含更高报价，4000元不是封顶价；年限包含10年以上，不改标成独立10年报价，未绑定村级产区和枝型。',
    }),
  ],
  core: [
    historicalCircle(1, '青皮', 350, 450),
    historicalCircle(1, '二红皮', 420, 520),
    historicalCircle(1, '大红皮', 480, 580),
    historicalCircle(5, '青皮', 1400, 1700),
    quote({
      id: 'core-meijiang-5-years-circle-erhong', label: '梅江基准5年圈枝二红皮', price: { min: 1700, max: 2000, unit: '元/斤' },
      yearBand: 5, peelType: '二红皮',
      originalText: '5年圈枝二紅皮：1700-2000；單位人民幣／斤', priceType: '历史媒体价格表', ...media.taKungPao, circle: '圈枝',
      note: `${taKungPaoNote}原表注明十年以下为新树价格，以梅江为价格基准。`,
    }),
    quote({
      id: 'core-meijiang-5-years-circle-dahong', label: '梅江基准5年圈枝大红皮', price: { min: 2000, max: 2500, unit: '元/斤' },
      yearBand: 5, peelType: '大红皮',
      originalText: '5年圈枝大紅皮：2000-2500；單位人民幣／斤', priceType: '历史媒体价格表', ...media.taKungPao, circle: '圈枝',
      note: `${taKungPaoNote}原表注明十年以下为新树价格，以梅江为价格基准。`,
    }),
    quote({
      id: 'core-10-years-circle-guidance', label: '10年圈枝指导价转述（四村相关）', price: { min: 3500, max: 5000, unit: '元/斤' },
      originalText: '据新会陈皮行业协会2026年1月发布的指导价，核心产区圈枝柑10年陈皮参考价约在3500～5000元/斤',
      priceType: '媒体转述指导参考', ...media.health, circle: '圈枝',
      note: '仅作媒体转述资料，降低参考权重。原文使用「核心产区」，并提及四村，未给出各村独立指导价；协会原始公告及采价方法待核，不认定为官方指数、当前有效价或成交价。2026年1月为报道明确引用的指导价月份，非本轮新报价。',
    }),
    historicalCircle(10, '青皮', 4500, 6000),
    quote({
      id: 'core-10-years-circle-erhong', label: '四村相关10年圈枝二红皮', price: { min: 6000, max: 7500, unit: '元/斤' },
      yearBand: 10, peelType: '二红皮',
      originalText: '10年圈枝二紅皮：6000-7500；單位人民幣／斤', priceType: '历史媒体价格表', ...media.taKungPao, circle: '圈枝',
      note: `${taKungPaoNote}原表一线产区包括梅江、东甲、天马、茶坑，未给出10年各村独立采价。`,
    }),
    quote({
      id: 'core-10-years-circle-dahong', label: '四村相关10年圈枝大红皮', price: { min: 7500, max: 10000, unit: '元/斤' },
      yearBand: 10, peelType: '大红皮',
      originalText: '10年圈枝大紅皮：7500-10000；單位人民幣／斤', priceType: '历史媒体价格表', ...media.taKungPao, circle: '圈枝',
      note: `${taKungPaoNote}原表一线产区包括梅江、东甲、天马、茶坑，未给出10年各村独立采价。`,
    }),
    historicalCircle(15, '青皮', 10000, 15000),
    historicalCircle(15, '二红皮', 15000, 22000),
    historicalCircle(15, '大红皮', 22000, 35000),
  ],
  villages: [
    { name: '东甲', quotes: [
      quote({
        id: 'dongjia-luo-10-years', label: '东甲10年商家供应样本', price: { min: 750, max: 850, unit: '元/斤' },
        originalOffer: '750～850元/斤', packageSpec: null, listingTier: 'supply',
        yearEvidence: { kind: 'merchant-age', text: '仅商家标称10年，未披露生产或晒制时间' },
        pageCheck: pageCheck('有询价入口', '2026-09-28T18:20:25+08:00', { min: 750, max: 850, unit: '元/斤' }, '750～850元/斤', '十年东甲陈皮；750-850元/斤；1斤起批'),
        originalText: '东甲十年陈皮：750～850元/斤，1斤起批', priceType: '供应挂牌', ...luoSource, circle: '商品总说明标称，规格未单独注明', minimumOrder: '1斤起批',
        note: '圈枝来自商品总说明，规格未独立注明；产地与十年年限均为商家声明。',
      }),
    ] },
    { name: '梅江', quotes: [
      quote({
        id: 'meijiang-jiaye-2016', label: '梅江2016年标供应样本', price: { min: 1650, max: 1800, unit: '元/斤' },
        originalOffer: '1650～1800元/斤', packageSpec: null, listingTier: 'supply',
        yearEvidence: { kind: 'conflict', text: '2016商品年标性质未确认，参数却为三～五年陈，字段冲突' },
        pageCheck: pageCheck('2016年标与三～五年陈参数冲突，移出当前参考', '2026-09-28T18:20:28+08:00', { min: 1650, max: 1800, unit: '元/斤' }, '1650～1800元/斤', '2016年梅江塞口围；1650-1800元/斤；等级三~五年陈'),
        exclusionReason: '价格虽重新核到，年份字段冲突仍未解决',
        originalText: '2016年梅江塞口围：1650～1800元/斤，1斤起批', priceType: '供应挂牌',
        sourceName: '惠农网｜江门家业贸易供应页面', sourceUrl: 'https://www.cnhnb.com/gongying/5073788/', merchant: '江门家业贸易有限公司', circle: '标题明确', minimumOrder: '1斤起批',
        note: '标题明确梅江产区圈枝柑皮；2016为商品年标，是否采收或生产年份未确认。参数货品等级标三～五年陈，与标题年标冲突，降低参考权重，不换算为10年陈皮。',
      }),
    ] },
    { name: '天马', quotes: [
      quote({
        id: 'tianma-luo-5-years', label: '天马5年商家供应样本', price: { min: 250, max: 280, unit: '元/斤' },
        originalOffer: '250～280元/斤', packageSpec: null, listingTier: 'supply',
        yearEvidence: { kind: 'merchant-age', text: '仅商家标称5年，未披露生产或晒制时间' },
        pageCheck: pageCheck('有询价入口', '2026-09-28T18:20:25+08:00', { min: 250, max: 280, unit: '元/斤' }, '250～280元/斤', '五年天马陈皮；250-280元/斤；1斤起批'),
        originalText: '天马五年陈皮：250～280元/斤，1斤起批', priceType: '供应挂牌', ...luoSource, circle: '商品总说明标称，规格未单独注明', minimumOrder: '1斤起批',
        note: '圈枝来自商品总说明，规格未独立注明；产地与五年年限均为商家声明。',
      }),
      quote({
        id: 'tianma-shengyuan-10-years-500g', label: '天马10年500克供应样本', price: { min: 380.9, max: 380.9, unit: '元/件', weightGrams: 500 },
        originalOffer: '原记录380.9元/袋', packageSpec: '500克/袋', listingTier: 'supply',
        yearEvidence: { kind: 'conflict', text: '原记录10年陈；本轮页面已标2020年、5年陈，页面版本与年限冲突' },
        pageCheck: pageCheck('现标5年陈，与原10年380.9元记录不符；有下单入口', '2026-09-28T18:20:30+08:00', { min: 380, unit: '元/件', weightGrams: 500 }, '380元/500g', '新会陈皮2020年5年；五年老陈皮500克袋装；380元/袋；1袋起批'),
        exclusionReason: '原记录与本轮页面的年限及价格不一致，不选任一版本作为统一参考',
        originalText: '10年老陈皮500克袋装：380.9元/袋，1袋起批；标题标称天马大红皮', priceType: '供应挂牌',
        sourceName: '惠农网｜生源供应页面', sourceUrl: 'https://www.cnhnb.com/gongying/5288782/', merchant: '生源新会陈皮产地直供', minimumOrder: '1袋起批',
        note: '保留原采集报价供审查，并列记录本轮页面5年陈380元/500克；不把2020年标按年份相减认定足5年。枝型及原始报价生效日期未披露，不再采用10年版本进入主参考。',
      }),
      quote({
        id: 'tianma-cha-story-10-years-50g', label: '天马10年50克零售样本', price: { min: 108, max: 108, unit: '元/件', weightGrams: 50 },
        originalOffer: '108元/件（50克）', packageSpec: '50克/件', listingTier: 'branded-retail',
        yearEvidence: { kind: 'merchant-age', text: '仅商家标称十年陈，未披露生产或晒制时间' },
        pageCheck: pageCheck('有立即购买入口，未实际下单', '2026-09-28T18:20:35+08:00', { min: 108, unit: '元/件', weightGrams: 50 }, '108元/50g', '十年陈天马大红皮50g；￥108.00；立即购买'),
        originalText: '赛黄金丨十年陈 天马大红皮 新会陈皮 代用茶 50g：108元', priceType: '零售挂牌',
        sourceName: '有赞｜茶的故事商品页面', sourceUrl: 'https://detail.youzan.com/show/goods?alias=277ncpbdac7jhjx', merchant: '茶的故事旗舰店', minimumOrder: null,
        note: '品牌小包装零售，包含包装与品牌成本，不与散装供应挂牌合成区间。',
      }),
    ] },
    { name: '茶坑', quotes: [
      quote({
        id: 'chakeng-zhang-2020-erhong', label: '茶坑2020年标圈枝二红皮', price: { min: 550, max: 550, unit: '元/斤' },
        originalOffer: '550元/斤', packageSpec: null, listingTier: 'supply',
        yearEvidence: { kind: 'merchant-year', text: '仅商家2020年标，未明确为生产或晒制年份；不推算足年' },
        pageCheck: pageCheck('仅询价／电话入口', '2026-09-28T18:20:32+08:00', { min: 550, unit: '元/斤' }, '550元/斤', '2020年二红柑皮，新会茶坑，圈枝柑皮；通货550元/斤；10斤起批'),
        originalText: '2020年二红柑皮，新会茶坑，圈枝柑皮：550元/斤，10斤起批', priceType: '供应挂牌',
        sourceName: '惠农网｜张群定供应页面', sourceUrl: 'https://www.cnhnb.com/gongying/6253587/', merchant: '张群定', circle: '圈枝', minimumOrder: '10斤起批',
        note: '2020年标仅为商家声明，不能据此认定已满5年或6年陈。',
      }),
      quote({
        id: 'chakeng-zhimian-2023-erhong-250g', label: '茶坑2023年晒制圈枝二红皮', price: { min: 255, max: 255, unit: '元/件', weightGrams: 250 },
        originalOffer: '255元/件（250克）', packageSpec: '250克/件', listingTier: 'retail',
        yearEvidence: { kind: 'production-date', text: '页面明确晒制时间2023年12月；截至快照日未满3年，不进入3年陈皮档' },
        pageCheck: pageCheck('显示库存15件及立即购买入口，未实际下单', '2026-09-28T18:20:37+08:00', { min: 255, unit: '元/件', weightGrams: 250 }, '255元/250g', '￥255.00-510.00；库存15件；255元/250克，510元/500克；晒制2023年12月'),
        originalText: '茶坑二红皮250g：255元；晒制时间：2023年12月；品种：圈枝（老品种）', priceType: '零售挂牌',
        sourceName: '有赞｜直面茶商品页面', sourceUrl: 'https://detail.youzan.com/show/goods?alias=2frkjss49mrng8k', merchant: '直面茶订制旗舰店', circle: '参数明确，圈枝（老品种）', minimumOrder: null,
        note: '作为柑皮零售样本观察；晒制时间不等于报价时间。',
      }),
    ] },
  ],
};
