param(
  [string]$AsOfDate = '2026-08-24'
)

$ErrorActionPreference = 'Stop'
$headers = @{ 'User-Agent' = 'PersonalMarketBoardSourceVerifier/0.1' }
$datePattern = $AsOfDate -replace '-', '.{0,3}'

$targets = @(
  @{ id = 'xau-usd-xaus'; category = 'international_gold'; url = 'https://xaus.com/api/v1/spot'; kind = 'json' },
  @{ id = 'usd-cny-tencent'; category = 'fx_high_frequency'; url = 'https://qt.gtimg.cn/q=fx_susdcny'; kind = 'text' },
  @{ id = 'usd-cny-sina'; category = 'fx_high_frequency'; url = 'https://hq.sinajs.cn/list=fx_susdcny'; kind = 'text' },
  @{ id = 'usd-cny-currencyexchangetool'; category = 'fx_high_frequency'; url = 'https://www.currencyexchangetool.com/api/v1/convert?amount=1&from=USD&to=CNY'; kind = 'json' },
  @{ id = 'usd-cny-frankfurter'; category = 'fx_reference'; url = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY'; kind = 'json' },
  @{ id = 'sge-delayed'; category = 'sge_au9999'; url = 'https://www.sge.com.cn/h5_sjzx/yshq'; kind = 'html' },
  @{ id = 'sge-daily'; category = 'sge_au9999'; url = "https://www.sge.com.cn/sjzx/quotation_daily_new?start_date=$AsOfDate&end_date=$AsOfDate"; kind = 'html' },
  @{ id = 'brand-chow-sang-sang'; category = 'brand_gold'; url = 'https://cn.chowsangsang.com/gold-info'; kind = 'html' },
  @{ id = 'brand-chow-tai-fook'; category = 'brand_gold'; url = 'https://www.ctf.com.cn/zh-hans/'; kind = 'html' },
  @{ id = 'brand-lukfook'; category = 'brand_gold'; url = 'https://www.lukfook.com.cn/'; kind = 'html' },
  @{ id = 'brand-laofengxiang'; category = 'brand_gold'; url = 'https://www.laofengxiang.com/'; kind = 'html' },
  @{ id = 'brand-third-party-xwteam'; category = 'brand_gold_crosscheck'; url = 'https://free.xwteam.cn/api/gold/brand'; kind = 'json' },
  @{ id = 'brand-third-party-smm'; category = 'brand_gold_crosscheck'; url = 'https://precious.smm.cn/gold-price'; kind = 'html' },
  @{ id = 'guangdong-drc'; category = 'guangdong_fuel'; url = 'https://drc.gd.gov.cn/'; kind = 'html' }
)

function Get-Checks([string]$id, [string]$content) {
  switch ($id) {
    'xau-usd-xaus' { return @{ price = $content -match 'price'; observedAt = $content -match 'price_as_of'; source = $content -match 'price_source' } }
    'usd-cny-tencent' { return @{ quote = $content -match 'v_fx_susdcny'; timestamp = $content -match '\d{4}-\d{2}-\d{2}' } }
    'usd-cny-sina' { return @{ quote = $content -match 'fx_susdcny'; timestamp = $content -match '\d{4}-\d{2}-\d{2}' } }
    'usd-cny-currencyexchangetool' { return @{ rate = $content -match '"rate"'; observedAt = $content -match '"updatedAt"'; source = $content -match '"success":true' } }
    'usd-cny-frankfurter' { return @{ rate = $content -match 'CNY'; observedAt = $content -match 'date' } }
    'sge-delayed' { return @{ au9999 = $content -match 'Au99\.99'; marketDate = $content -match $datePattern } }
    'sge-daily' { return @{ au9999 = $content -match 'Au99\.99'; marketDate = $content -match $datePattern } }
    'brand-chow-sang-sang' { return @{ goldPrice = $content -match 'gold'; timestamp = $content -match 'updated|time' } }
    'brand-third-party-xwteam' { return @{ goldPrice = $content -match 'goldPrice'; responseData = $content -match 'data' } }
    default { return @{ reachable = $content.Length -gt 0 } }
  }
}

$results = foreach ($target in $targets) {
  $collectedAt = [DateTimeOffset]::Now.ToString('o')
  try {
    $raw = & curl.exe -sS --compressed --connect-timeout 10 --max-time 20 -A $headers['User-Agent'] --write-out "`n__HTTP_STATUS__%{http_code}" $target.url 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw ($raw -join "`n")
    }
    $joined = [string]($raw -join "`n")
    $marker = '__HTTP_STATUS__'
    $markerAt = $joined.LastIndexOf($marker)
    if ($markerAt -lt 0) {
      throw 'curl response did not include an HTTP status marker'
    }
    $content = $joined.Substring(0, $markerAt).TrimEnd("`r", "`n")
    $httpStatus = [int]$joined.Substring($markerAt + $marker.Length).Trim()
    if ($httpStatus -lt 200 -or $httpStatus -ge 300) {
      throw "HTTP $httpStatus"
    }
    [pscustomobject]@{
      id = $target.id
      category = $target.category
      url = $target.url
      collectedAt = $collectedAt
      httpStatus = $httpStatus
      contentType = $target.kind
      contentLength = $content.Length
      checks = Get-Checks $target.id $content
      sample = $content.Substring(0, [Math]::Min(240, $content.Length)).Replace("`r", ' ').Replace("`n", ' ')
      error = $null
    }
  } catch {
    [pscustomobject]@{
      id = $target.id
      category = $target.category
      url = $target.url
      collectedAt = $collectedAt
      httpStatus = $null
      contentType = $null
      contentLength = 0
      checks = $null
      sample = $null
      error = $_.Exception.Message
    }
  }
}

$results | ConvertTo-Json -Depth 5
