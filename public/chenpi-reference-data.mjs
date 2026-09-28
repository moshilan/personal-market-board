const collectedAt = '2026-09-28';
const quote = (data) => ({ priceDate: null, sourceDate: null, collectedAt, ...data });
const media = {
  market: { sourceName: '信息时报｜清平中药材市场走访', sourceUrl: 'https://huacheng.gz-cmc.com/pages/2026/01/13/4b7567cf031e46469178443dd4e1f0b6.html', sourceDate: '2026-01-13' },
  taKungPao: { sourceName: '大公报｜新会一线产区陈皮价格一览', sourceUrl: 'https://dw-media.tkww.hk/epaper/tkp/20251012/A14_Screen.pdf', sourceDate: '2025-10-12' },
  health: { sourceName: '健康时报｜媒体转述指导参考', sourceUrl: 'https://www.jksb.com.cn/index.php?a=show&catid=788&id=256999&m=wap', sourceDate: '2026-07-28', priceDate: '2026-01' },
};
const luoSource = { sourceName: '惠农网｜罗立荣供应页面', sourceUrl: 'https://www.cnhnb.com/gongying/5707835/', merchant: '罗立荣' };
const taKungPaoNote = '投资报道中的媒体参考表，未披露采价日期、样本数量及批发或零售性质；不代表成交价或官方指数，不按产区折扣推算其他村价格。';

export const CHENPI_REFERENCE = {
  collectedAt,
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
    quote({
      id: 'core-meijiang-5-years-circle-erhong', label: '梅江基准5年圈枝二红皮', price: { min: 1700, max: 2000, unit: '元/斤' },
      originalText: '5年圈枝二紅皮：1700-2000；單位人民幣／斤', priceType: '媒体参考价', ...media.taKungPao, circle: '圈枝',
      note: `${taKungPaoNote}原表注明十年以下为新树价格，以梅江为价格基准。`,
    }),
    quote({
      id: 'core-meijiang-5-years-circle-dahong', label: '梅江基准5年圈枝大红皮', price: { min: 2000, max: 2500, unit: '元/斤' },
      originalText: '5年圈枝大紅皮：2000-2500；單位人民幣／斤', priceType: '媒体参考价', ...media.taKungPao, circle: '圈枝',
      note: `${taKungPaoNote}原表注明十年以下为新树价格，以梅江为价格基准。`,
    }),
    quote({
      id: 'core-10-years-circle-guidance', label: '核心产区10年圈枝指导参考', price: { min: 3500, max: 5000, unit: '元/斤' },
      originalText: '据新会陈皮行业协会2026年1月发布的指导价，核心产区圈枝柑10年陈皮参考价约在3500～5000元/斤',
      priceType: '媒体转述指导参考', ...media.health, circle: '圈枝',
      note: '报道转述2026年1月协会指导参考，协会原始公告及采价方法待核；报道日期不等于报价日期，未细分四个村，不认定为官方指数或成交价。',
    }),
    quote({
      id: 'core-10-years-circle-erhong', label: '一线产区10年圈枝二红皮', price: { min: 6000, max: 7500, unit: '元/斤' },
      originalText: '10年圈枝二紅皮：6000-7500；單位人民幣／斤', priceType: '媒体参考价', ...media.taKungPao, circle: '圈枝',
      note: `${taKungPaoNote}原表一线产区包括梅江、东甲、天马、茶坑，未给出10年各村独立采价。`,
    }),
    quote({
      id: 'core-10-years-circle-dahong', label: '一线产区10年圈枝大红皮', price: { min: 7500, max: 10000, unit: '元/斤' },
      originalText: '10年圈枝大紅皮：7500-10000；單位人民幣／斤', priceType: '媒体参考价', ...media.taKungPao, circle: '圈枝',
      note: `${taKungPaoNote}原表一线产区包括梅江、东甲、天马、茶坑，未给出10年各村独立采价。`,
    }),
  ],
  villages: [
    { name: '东甲', quotes: [
      quote({
        id: 'dongjia-luo-10-years', label: '东甲10年商家供应样本', price: { min: 750, max: 850, unit: '元/斤' },
        originalText: '东甲十年陈皮：750～850元/斤，1斤起批', priceType: '供应挂牌', ...luoSource, circle: '商品总说明标称，规格未单独注明', minimumOrder: '1斤起批',
        note: '商品副标题为「专营一线核心产区的圈枝陈皮」，枝型来自总说明；报价未见日期，产地及年限为商家声明，未见独立成交凭证。',
      }),
    ] },
    { name: '梅江', quotes: [
      quote({
        id: 'meijiang-jiaye-2016', label: '梅江2016年标供应样本', price: { min: 1650, max: 1800, unit: '元/斤' },
        originalText: '2016年梅江塞口围：1650～1800元/斤，1斤起批', priceType: '供应挂牌',
        sourceName: '惠农网｜江门家业贸易供应页面', sourceUrl: 'https://www.cnhnb.com/gongying/5073788/', merchant: '江门家业贸易有限公司', circle: '标题明确', minimumOrder: '1斤起批',
        note: '标题明确梅江产区圈枝柑皮；2016为商品年标，是否采收或生产年份未确认。参数货品等级标三～五年陈，与标题年标冲突，降低参考权重，不换算为10年陈皮。',
      }),
    ] },
    { name: '天马', quotes: [
      quote({
        id: 'tianma-luo-5-years', label: '天马5年商家供应样本', price: { min: 250, max: 280, unit: '元/斤' },
        originalText: '天马五年陈皮：250～280元/斤，1斤起批', priceType: '供应挂牌', ...luoSource, circle: '商品总说明标称，规格未单独注明', minimumOrder: '1斤起批',
        note: '圈枝来自商品副标题总说明，未披露报价日期；产地及陈化年限为商家声明，报价不代表成交价。',
      }),
      quote({
        id: 'tianma-shengyuan-10-years-500g', label: '天马10年500克供应样本', price: { min: 380.9, max: 380.9, unit: '元/件', weightGrams: 500 },
        originalText: '10年老陈皮500克袋装：380.9元/袋，1袋起批；标题标称天马大红皮', priceType: '供应挂牌',
        sourceName: '惠农网｜生源供应页面', sourceUrl: 'https://www.cnhnb.com/gongying/5288782/', merchant: '生源新会陈皮产地直供', minimumOrder: '1袋起批',
        note: '500克袋装供应价，枝型未说明；页面与索引的年限信息有冲突，采用商品页面声明并保留冲突，不作为同品市场均价；未披露报价日期。',
      }),
      quote({
        id: 'tianma-cha-story-10-years-50g', label: '天马10年50克零售样本', price: { min: 108, max: 108, unit: '元/件', weightGrams: 50 },
        originalText: '赛黄金丨十年陈 天马大红皮 新会陈皮 代用茶 50g：108元', priceType: '零售挂牌',
        sourceName: '有赞｜茶的故事商品页面', sourceUrl: 'https://detail.youzan.com/show/goods?alias=277ncpbdac7jhjx', merchant: '茶的故事旗舰店', minimumOrder: '页面未单独披露，规格50克',
        note: '50克包装零售展示价，枝型未说明，未公开库存数量及报价日期；包装与品牌成本包含在零售价中。',
      }),
    ] },
    { name: '茶坑', quotes: [
      quote({
        id: 'chakeng-zhang-2020-erhong', label: '茶坑2020年标圈枝二红皮', price: { min: 550, max: 550, unit: '元/斤' },
        originalText: '2020年二红柑皮，新会茶坑，圈枝柑皮：550元/斤，10斤起批', priceType: '供应挂牌',
        sourceName: '惠农网｜张群定供应页面', sourceUrl: 'https://www.cnhnb.com/gongying/6253587/', merchant: '张群定', circle: '圈枝', minimumOrder: '10斤起批',
        note: '产区、2020年标、圈枝及二红皮均为商品标题声明；不以采集日推算真实陈化年限，未披露报价日期和独立成交凭证。',
      }),
      quote({
        id: 'chakeng-zhimian-2023-erhong-250g', label: '茶坑2023年晒制圈枝二红皮', price: { min: 255, max: 255, unit: '元/件', weightGrams: 250 },
        originalText: '茶坑二红皮250g：255元；晒制时间：2023年12月；品种：圈枝（老品种）', priceType: '零售挂牌',
        sourceName: '有赞｜直面茶商品页面', sourceUrl: 'https://detail.youzan.com/show/goods?alias=2frkjss49mrng8k', merchant: '直面茶订制旗舰店', circle: '参数明确，圈枝（老品种）', minimumOrder: '页面未单独披露，规格250克',
        note: '页面注明2023年12月晒制，截至2026年9月28日未满三年，作为柑皮零售样本保留，不归入3年陈皮。晒制时间不等于报价日期。',
      }),
    ] },
  ],
};
