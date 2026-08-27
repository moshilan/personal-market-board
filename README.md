# Personal Market Board

面向个人及家人手机日常使用的零付费PWA行情看板。当前已完成核心数据采集、本地缓存与历史、移动端页面、趋势图、白银模块，以及GitHub Pages部署前适配。

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

## 数据可靠性约束

- 运行和日常使用不得依赖付费API、付费服务器或付费订阅
- 金价仅在能够取得可靠的当日最新数据时展示，不以估算或过期数据冒充当前行情
- 油价根据最新有效调价公告展示
- 每个价格记录必须保留来源、数据时间和采集时间
- 数据无法可靠获取时显示“不可用”，不伪造数据，也不静默回退后标记为“实时”

## 当前状态

`01｜核心数据源与采集`、`02｜数据模型、缓存与历史`、`03｜首页与移动端 UI`、`04｜趋势图与国内外价差`已完成最小版本。采集输出统一为观察记录，成功记录保存至本地JSON缓存与历史；实时采集失败时，展示层才会返回明确标记为`cached`的最后成功记录。缓存文件为`data/market-data.json`，不纳入Git。

运行采集：`node scripts/collect-v1-data.mjs`

运行本地测试：`node --test tests/*.test.mjs`

本地开发预览：运行`node scripts/collect-v1-data.mjs`、`node scripts/build-static-site.mjs`、`node scripts/serve-dashboard.mjs`，再访问`http://localhost:8787`。`刷新显示`只重新读取已生成的静态数据，不触发采集。

首页使用底部导航在首页、金价、白银、油价四个视图间切换。金价页提供国际黄金人民币折算价、Au99.99和国内外价差的真实历史趋势；白银页提供国际白银人民币折算、Ag(T+D)换算后的国内白银和国内外白银价差趋势，支持7天、30天范围；油价页按实际调价生效日期展示92号、95号和0号柴油近30天记录。历史不足时明确提示积累中，不补造历史。

## 部署与自动更新

部署目标为GitHub Pages。GitHub Actions在每小时UTC第17分和第47分运行，错开整点与半点高峰，执行测试、真实采集、静态构建和Pages发布。GitHub的定时任务可能因平台负载延后或丢弃，页面始终显示实际采集时间，不将延迟数据标记为实时。[GitHub官方说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

应用代码只在主分支维护，采集状态单独存于`market-data`分支。该分支每次由Actions强制替换为一个仅含`market-data.json`的快照提交，不会让主分支积累自动采集提交。仓储保留最近31天真实历史，满足页面30天趋势窗口；下一次采集先恢复该快照，再按当前缓存与新鲜度规则更新。

发布后的固定地址为`https://<GitHub用户名>.github.io/personal-market-board/`。应用的资源、数据请求、PWA清单和Service Worker均使用相对路径，可在这个项目页子路径下工作。

### GitHub账号侧操作

以下操作需要仓库所有者在GitHub网页完成，本仓库尚未创建远程仓库，也未启用任何远程服务：

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
- `tests/`：后续测试代码

## 迁移边界

`20260711-market-price-analyzer`和`PersonalProject`仅作为后续迁移参考。本阶段不删除、不移动，也不整包复制其内容。
