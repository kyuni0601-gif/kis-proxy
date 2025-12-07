import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------
// 🔥 토큰 캐싱 (한 번 받은 토큰 재사용)
// -----------------------------
let cachedToken = null;
let tokenExpireTime = 0;

// 한국투자 토큰 발급 (캐싱 적용)
async function getToken() {
  const now = Date.now();

  // 유효한 토큰이 있으면 5분 전까지 재사용
  if (cachedToken && now < tokenExpireTime - 5 * 60 * 1000) {
    return cachedToken;
  }

  const url = "https://openapi.koreainvestment.com:9443/oauth2/tokenP";
  const body = {
    grant_type: "client_credentials",
    appkey: process.env.KIS_APP_KEY,
    appsecret: process.env.KIS_APP_SECRET
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  cachedToken = data.access_token;
  // 한국투자 토큰 만료 24시간
  tokenExpireTime = now + 24 * 60 * 60 * 1000;

  return cachedToken;
}

// 한국투자 현재가 하나 조회
async function fetchPrice(code, token) {
  const url =
    `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${code}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
      appkey: process.env.KIS_APP_KEY,
      appsecret: process.env.KIS_APP_SECRET,
      tr_id: "FHKST01010100"
    }
  });

  const json = await response.json();

  const out = json.output || json.output1 || {};
  const priceStr = out.stck_prpr;
  const name = out.hts_kor_isnm || out.prdt_name || null;

  return {
    code,
    name,
    price: priceStr ? Number(priceStr) : null,
    raw: json
  };
}

// -----------------------------
// ✅ 1) 단일 종목 조회 (/price)
// -----------------------------
app.get('/price', async (req, res) => {
  try {
    const token = await getToken();
    const code = req.query.code;

    if (!code) {
      return res.status(400).json({ error: "code 파라미터 필요" });
    }

    const result = await fetchPrice(code, token);
    res.json(result.raw);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.toString() });
  }
});

// -----------------------------
// ✅ 2) 여러 종목 조회 (/prices)
// -----------------------------
app.get('/prices', async (req, res) => {
  try {
    const token = await getToken();
    const codesParam = req.query.codes;

    if (!codesParam) {
      return res.status(400).json({ error: "codes 파라미터 필요" });
    }

    const codes = codesParam
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    if (codes.length === 0) {
      return res.status(400).json({ error: "유효한 코드 없음" });
    }

    // 병렬 처리
    const results = await Promise.all(
      codes.map(code =>
        fetchPrice(code, token).catch(err => ({
          code,
          name: null,
          pr
