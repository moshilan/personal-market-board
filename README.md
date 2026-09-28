# Personal Market Board

面向个人及家人手机日常使用的零付费PWA行情看板。当前已完成核心数据采集、本地缓存与历史、移动端页面、趋势图、白银模块、新会陈皮价格参考，以及GitHub Pages部署前适配。

本文件是当前状态和操作入口。`docs/`中的2026-08-24 UI规格与数据源验证记录保留当时设计、样本和失败来源，作为历史资料查阅，不作为当前页面或采集口径的要求。

## 目标范围

- 国际金价
- 国际白银XAG/USD与人民币折算
- USD/CNY 汇率
- 国际金价折算人民币/克
- 上金所 Au99.99
- 上金所Ag(T+D)与国内白银
- 国内外价差
- 国内外白银价差
- 品牌金价
- 广东油价
- 黄金及油价历史趋势
- 新会陈皮价格参考（固定调研快照）

## 数据可靠性约束

- 运行和日常使用不得依赖付费API、付费服务器或付费订阅
- 金价仅在能够取得可靠的当日最新数据时展示，不以估算或过期数据冒充当前行情
- 油价根据最新有效调价公告展示
- 广东油价从省发展改革委商品价格公告列表动态发现，按北京时间公告生效时刻选取；价格直接读取公告元/升列，不做吨升换算
- 油价公告发现或解析失败时保留既有缓存兜底，但明确显示为缓存；不把无法确认的新鲜度的旧公告标记为当前值
- 已发布但尚未生效的广东调价公告单独保存为upcoming；油价页显示三种油品的当前价、新价和涨跌，首页只显示生效时间提醒，到生效时自动转为当前价
- 每个价格记录必须保留来源、数据时间和采集时间
- 数据无法可靠获取时显示“不可用”，不伪造数据，也不静默回退后标记为“实时”

## 当前汇率口径

汇率采集使用ECB官方SDMX CSV每日参考汇率。解析同一数据日的CNY、USD、HKD、JPY、GBP、KRW、SGD七个EUR基准报价，再归一为USD基准的八币种数据（含EUR）；缺币种、重复报价、日期不一致、未来日期或无效数值时整批不可用。源数据日期与采集时间分别保存，页面明确标注每日参考汇率及非盘中实时属性，不沿用早期高频源的2小时有效性口径。

金银人民币折算及相应国内外价差共用该批次生成的USD/CNY，计算口径为EUR基准CNY报价除以EUR基准USD报价，不再单独请求USD/CNY。ECB本轮失败时，折算只回用最近成功的ECB参考批次；旧来源缓存不参与金银计算。汇率页保留最近成功缓存及其原来源，并明确显示缓存状态，失败诊断另行保存。当前实现见[src/exchange-rates.mjs](src/exchange-rates.mjs)及[scripts/collect-v1-data.mjs](scripts/collect-v1-data.mjs)，本段描述本地实现，不确认当前线上采集状态。

## 当前状态

`01｜核心数据源与采集`、`02｜数据模型、缓存与历史`、`03｜首页与移动端 UI`、`04｜趋势图与国内外价差`已完成最小版本。采集输出统一为观察记录，成功记录保存至本地JSON缓存与历史；实时采集失败时，展示层才会返回明确标记为`cached`的最后成功记录。缓存文件为`data/market-data.json`，不纳入Git。

运行采集：`node scripts/collect-v1-data.mjs`

运行本地测试：`node --test tests/*.test.mjs`

本地开发预览：运行`node scripts/collect-v1-data.mjs`、`node scripts/build-static-site.mjs`、`node scripts/serve-dashboard.mjs`，再访问`http://localhost:8787`。`刷新显示`只重新读取已生成的静态数据，不触发采集。

首页使用底部导航在首页、黄金、白银、汇率、油价、陈皮六个视图间切换。黄金页提供国际黄金人民币折算价、Au99.99和国内外价差的真实历史趋势；白银页提供国际白银人民币折算、Ag(T+D)换算后的国内白银和国内外白银价差趋势。黄金、白银、两类价差和品牌黄金趋势支持1周、1月、3月、6月、1年范围；油价页按现有历史中的实际调价生效日期提供近10次、半年和1年趋势范围，历史不足时展示已有记录，不额外补齐。

### 新会陈皮价格参考

陈皮页按「年限行情参考 / 四村相关圈枝资料 / 四村公开报价观察」展示固定快照，页头注明「价格资料快照截至2026年9月28日，本页暂不自动更新」。数据保存在`public/chenpi-reference-data.mjs`，不随行情定时采集自动更新。四村指东甲、梅江、天马、茶坑，不代表官方产区分级。信息时报保留实地走访零售区间；健康时报的行业指导价转述注明原公告待核；大公报2025年圈枝1/5/10/15年及青皮/二红/大红12档单列历史资料，不与2026参考合并。价格差异提示保留来源日期、皮类及批零口径限制，不计算均价、排名或趋势。

商品优先显示原报价及规格，元/斤仅作为按1斤＝500克的辅助换算；包装规格与起购量分别保存，未披露起购量不按包装重量补值。供应/批发、普通零售、品牌小包装零售分层显示。价格时间优先原「报价日期」，仅有媒体报道日期时显示「报道时间」，无挂牌生效日期时显示「采集时间：2026年9月28日」。当前挂牌必须有明确报价/更新日期，或采集日直达页面核到同一价格与规格；页面存在、旧搜索结果或商品年份均不足以证明价格时间。每条保留当日展示金额和核验状态，不称价格仍有效。生产/晒制时间、仅商家标称年限、性质未明年标、字段冲突分别注明，不按年份相减推足年。

`刷新显示`在陈皮页只重绘固定快照，不查询或更新商品报价。其他行情数据读取失败时，仍可从底部导航查看陈皮参考。下架、售罄、字段/版本冲突及本轮无法核验的挂牌仅保留在审查记录，不进入主参考；页面显示价格、购买入口和库存各自记录，不保证购买成功或价格生效期限。完整审查见[陈皮V1数据与展示审查](docs/chenpi-v1-audit-20260928.md)。

年限行情区增加「1年 · 新皮／低年限参考」入口；暂无已核实的1年当前报价，入口仅展开来源明确的2025年1年历史档，不把未满3年的商品归入1年。普通缺失的圈枝、包装、起购量在类别下方统一说明；字段冲突和价格时间不明仍逐条提示。

## 部署与自动更新

部署目标为GitHub Pages。GitHub Actions在每小时UTC第17分和第47分运行，错开整点与半点高峰，执行测试、真实采集、静态构建和Pages发布。GitHub的定时任务可能因平台负载延后或丢弃，页面始终显示实际采集时间，不将延迟数据标记为实时。[GitHub官方说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

应用代码只在主分支维护，采集状态单独存于`market-data`分支。该分支每次由Actions强制替换为一个仅含`market-data.json`的快照提交，不会让主分支积累自动采集提交。仓储保留最近366天真实历史，支持页面最长1年趋势窗口；下一次采集先恢复该快照，再按当前缓存与新鲜度规则更新。

发布后的固定地址为`https://<GitHub用户名>.github.io/personal-market-board/`。应用的资源、数据请求、PWA清单和Service Worker均使用相对路径，可在这个项目页子路径下工作。

### GitHub账号侧操作

本地已配置远程`origin`为`https://github.com/moshilan/personal-market-board.git`。以下保留初次部署的账号侧操作清单；当前远程权限、Actions和Pages运行状态需在GitHub核验，不能仅凭本地配置认定在线服务正常：

- 新建公开仓库`personal-market-board`，并推送本项目主分支。GitHub Free的Pages仅支持公开仓库
- 在`Settings → Actions → General`将`Workflow permissions`设为`Read and write permissions`，供工作流更新独立数据分支
- 在`Settings → Pages`将发布来源设为`GitHub Actions`
- 打开`Actions`，手动运行一次`Refresh market data and deploy`，首次运行会创建`market-data`分支并完成首次Pages发布

### 定时任务维护

公开仓库连续60天没有仓库活动时，GitHub可能自动禁用scheduled workflow。[GitHub官方说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

- 每月在`Actions → Refresh market data and deploy`查看最近一次运行是否成功，并确认workflow没有显示已禁用
- 若已停用，在该workflow页面的菜单中选择`Enable workflow`，然后手动运行一次
- 修改并提交工作流中的cron配置也会重新启用该scheduled workflow

PWA包含manifest、192px与512px PNG图标、Apple触屏图标和最小Service Worker。它支持浏览器提供的安装入口，但不缓存行情数据或伪造离线行情；断网时无法获取的新数据仍会按页面现有失败状态显示。

## 目录

- `src/`：数据模型与首页展示模型
- `public/`：首页静态资源与PWA基础文件
- `scripts/build-static-site.mjs`：将本地仓储构建为静态站点和`api/home.json`
- `scripts/serve-dashboard.mjs`：本地静态站点服务
- `.github/workflows/refresh-and-deploy.yml`：定时采集、独立数据分支和GitHub Pages发布
- `docs/`：需求、数据源与设计文档
- `tests/`：数据模型、采集解析、汇率与页面验证代码

## 迁移边界

`20260711-market-price-analyzer`和`PersonalProject`仅作为后续迁移参考。本阶段不删除、不移动，也不整包复制其内容。
