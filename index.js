import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------
// 🔥 토큰 캐싱 (속도 3~5배 빨라짐)
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
  // 한국투자 토큰 만료는 24시간 → 24시간 캐싱
  tokenExpireTime = now + (24 * 60 * 60 * 1000);

  return cachedToken;
}

// -----------------------------
// 🔥 종목 현재가 조회 API
// -----------------------------
app.get('/price', async (req, res) => {
  try {
    const token = await getToken();
    const code = req.query.code;

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
    res.json(json);

  } catch (e) {
    res.json({ error: e.toString() });
  }
});

// -----------------------------
// 서버 시작
// -----------------------------
app.listen(3000, () => {
  console.log("KIS Proxy server running on port 3000");
});
