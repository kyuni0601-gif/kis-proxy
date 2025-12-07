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
          price: null,
          error: err.toString()
        }))
      )
    );

    res.json({
      count: results.length,
      results
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.toString() });
  }
});

// -----------------------------
// 🖼 루트 페이지: 이미지 + 복사 버튼
// -----------------------------
app.get('/', (req, res) => {
  res.send(`
    <h1>자동버전 이미지 복사 테스트</h1>

    <p>아래 이미지를 복사 버튼으로 바로 클립보드에 담을 수 있어요.</p>

    <!-- 보여줄 이미지 -->
    <img id="autoImage" 
         src="https://i.ibb.co/6Dd5vhM/sample-image.png"
         alt="sample image"
         style="max-width: 400px; border: 1px solid #ddd;">

    <br><br>

    <!-- 복사 버튼 -->
    <button id="copyBtn" style="padding: 10px 20px;">이미지 복사하기</button>
    <span id="copyMsg" style="margin-left: 10px; font-size: 0.9rem;"></span>

    <script>
      const copyBtn = document.getElementById("copyBtn");
      const copyMsg = document.getElementById("copyMsg");

      copyBtn.addEventListener("click", async () => {
        const img = document.getElementById("autoImage");

        try {
          copyBtn.disabled = true;
          copyMsg.textContent = "복사 중...";

          const response = await fetch(img.src);
          const blob = await response.blob();

          const item = new ClipboardItem({ [blob.type]: blob });
          await navigator.clipboard.write([item]);

          copyMsg.textContent = "✅ 이미지 복사 완료!";
        } catch (err) {
          console.error(err);
          copyMsg.textContent = "❌ 복사 실패 (브라우저 권한 확인)";
        } finally {
          copyBtn.disabled = false;
          setTimeout(() => (copyMsg.textContent = ""), 3000);
        }
      });
    </script>
  `);
});

// -----------------------------
// 서버 시작
// -----------------------------
app.listen(3000, () => {
  console.log("KIS Proxy server running on port 3000");
});
