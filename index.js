const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 Render 환경변수에 이미 넣어둔 값들을 사용
const APP_KEY = process.env.KIS_APP_KEY;
const APP_SECRET = process.env.KIS_APP_SECRET;

const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";

// ---------- 토큰 캐시 ----------
let accessToken = null;
let tokenExpiresAt = 0; // ms 단위 (Date.now() 와 비교)

// 새 토큰 발급
async function issueToken() {
  const url = `${KIS_BASE_URL}/oauth2/tokenP`;

  const res = await axios.post(url, {
    grant_type: "client_credentials",
    appkey: APP_KEY,
    appsecret: APP_SECRET,
  });

  // KIS 응답 구조 기준 (필요하면 콘솔 찍어서 맞춰도 됨)
  accessToken = res.data.access_token;
  const expiresIn = res.data.expires_in || 3600; // 초 단위 (기본 1시간)
  tokenExpiresAt = Date.now() + expiresIn * 1000;

  console.log("✅ 새 토큰 발급 완료, 만료까지(초):", expiresIn);
  return accessToken;
}

// 항상 유효한 토큰을 돌려주는 함수
async function getValidToken() {
  const now = Date.now();

  // 아직 유효하면 그대로 사용 (만료 1분 전까지만)
  if (accessToken && now < tokenExpiresAt - 60 * 1000) {
    return accessToken;
  }

  // 없거나 만료 직전이면 새로 발급
  return await issueToken();
}

// KIS 현재가 API 한 번 호출하는 함수
async function callKisPriceApi(code, token) {
  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`;

  const headers = {
    "content-type": "application/json; charset=utf-8",
    authorization: `Bearer ${token}`,
    appkey: APP_KEY,
    appsecret: APP_SECRET,
    tr_id: "FHKST01010100", // 국내주식 현재가 조회 (모의/실전에 맞게 필요시 변경)
  };

  const params = {
    fid_cond_mrkt_div_code: "J", // 코스피/코스닥 통합
    fid_input_iscd: code,        // 종목코드 6자리
  };

  const res = await axios.get(url, { headers, params });
  return res.data;
}

// 토큰 만료 오류인지 확인하는 함수
function isTokenExpiredError(data) {
  const msgCd =
    data?.msg_cd ||
    data?.output?.msg_cd ||
    data?.errorCode ||
    data?.rt_cd;

  return msgCd === "EGW00123"; // 기간이 만료된 token
}

// 헬스체크
app.get("/", (req, res) => {
  res.send("kis-proxy is running");
});

// ---------- /price 엔드포인트 ----------
app.get("/price", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res
      .status(400)
      .json({ error: "NO_CODE", message: "code 쿼리 파라미터가 필요합니다." });
  }

  try {
    // 1차 호출
    let token = await getValidToken();
    let data = await callKisPriceApi(code, token);

    // 성공 코드(rt_cd === "0")면 바로 반환
    if (data.rt_cd === "0") {
      return res.json(data);
    }

    // 토큰 만료라면 → 토큰 재발급 후 한 번 더 시도
    if (isTokenExpiredError(data)) {
      console.log("⚠️ 토큰 만료 감지, 재발급 후 재시도");
      accessToken = null;
      tokenExpiresAt = 0;

      token = await getValidToken();
      data = await callKisPriceApi(code, token);
      return res.json(data);
    }

    // 그 외 오류는 그대로 전달
    return res.status(500).json({
      error: "KIS_API_ERROR",
      message: "KIS 응답 에러",
      detail: data,
    });
  } catch (e) {
    console.error("❌ /price 오류:", e.response?.data || e.message);
    return res.status(500).json({
      error: "PRICE_API_ERROR",
      message: "KIS 현재가 조회 중 오류가 발생했습니다.",
      detail: e.response?.data || e.message,
    });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`kis-proxy listening on port ${PORT}`);
});
