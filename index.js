import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// 한국투자 토큰 발급
async function getToken() {
  const url = "https://openapi.koreainvestment.com:9443/oauth2/tokenP";
  const body = {
    grant_type: "client_credentials",
    appkey: process.env.KIS_APP_KEY,
    appsecret: process.env.KIS_APP_SECRET,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data.access_token;
}

// 주가 조회 API
app.get('/price', async (req, res) => {
  try {
    const token = await getToken();
    const code = req.query.code;   // 예: 005930

    const url =
      `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${code}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        appkey: process.env.KIS_APP_KEY,
        appsecret: process.env.KIS_APP_SECRET,
        tr_id: "FHKST01010100",
      },
    });

    const result = await response.json();
    res.json(result);
  } catch (e) {
    console.error(e);
    res.json({ error: e.toString() });
  }
});

app.listen(3000, () => {
  console.log("KIS Proxy server running on port 3000");
});
