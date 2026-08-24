# 核心数据源与采集调研笔记

调研日期：2026-08-24
调研目标：验证零付费条件下，V1核心行情、品牌金价与广东油价的真实可采集性，并记录可追溯的数据源与失败边界

## 关键问题

1. XAU/USD、USD/CNY、上金所Au99.99能否取得当天且带时间的数据
2. 国际金价人民币折算与国内外价差能否完整追溯输入记录
3. 四个品牌金价与广东油价能否取得真实、可验证的当日或当前有效报价

## 发现

- 第一轮无凭证实测完成。XAUS、Frankfurter、上金所延时和每日行情、周生生官方金价页、四个品牌官网入口、SMM页面和广东省发改委站点可访问。
- XAUS响应含价格、价格时间与来源字段。Frankfurter是日频参考，不适合直接承担实时价差折算。
- 上金所官方延时页和每日行情页均含Au99.99；前者适合当日最新参考，后者适合收盘核验。
- 周生生中国内地官方页公开给出足金饰品克价及最后更新时间。其余三品牌只确认入口可访问，尚未确认可采集挂牌价。
- 腾讯候选代码无报价，新浪直连403。高频USD/CNY主源仍待验证。
- 补测Currency Exchange Tool公开接口，返回USD/CNY、`updatedAt`和24小时变动字段，可作为高频候选；Ratata实际返回Frankfurter来源的日频数据，不适合实时价差。
- 广东省发改委站点可访问，但当前有效公告尚未可靠提取，不能展示价格。

## 来源列表

- XAUS：https://xaus.com/api/v1/spot
- Frankfurter：https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY
- Currency Exchange Tool：https://www.currencyexchangetool.com/api/v1/convert?amount=1&from=USD&to=CNY
- 上金所延时行情：https://www.sge.com.cn/h5_sjzx/yshq
- 上金所每日行情：https://www.sge.com.cn/sjzx/quotation_daily_new
- 周生生中国内地金价：https://cn.chowsangsang.com/gold-info
- 周大福官网：https://www.ctf.com.cn/zh-hans/
- 六福官网：https://www.lukfook.com.cn/
- 老凤祥官网：https://www.laofengxiang.com/
- SMM品牌金价：https://precious.smm.cn/gold-price
- 广东省发展改革委：https://drc.gd.gov.cn/
