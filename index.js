import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/**
 * 로컬 테스트용 루트 페이지 (렌더 서버에서 보여지는 HTML)
 * 이미지 "새 창 열기" 버튼 포함
 */

app.get("/", (req, res) => {
  const page = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>자동버전 이미지 테스트 페이지</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
            padding: 20px;
          }
          #imgWrap {
            margin-top: 20px;
          }
          img {
            max-width: 300px;
            border: 1px solid #ccc;
            border-radius: 6px;
          }
          button {
            margin-top: 15px;
            padding: 8px 14px;
            font-size: 14px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <h2>자동버전 이미지 테스트</h2>
        <p>아래 이미지를 새 창에서 열어 크게 볼 수 있어요.</p>

        <div id="imgWrap">
          <img id="preview" src="https://i.ibb.co/6J7KkBp/sampleflower.jpg" />
        </div>

        <button id="openBtn">이미지 새 창으로 열기</button>

        <script>
          const openBtn = document.getElementById("openBtn");
          const img = document.getElementById("preview");

          openBtn.addEventListener("click", () => {
            if (!img.src) {
              alert("이미지 URL이 존재하지 않습니다!");
              return;
            }
            window.open(img.src, "_blank");
          });
        </script>
      </body>
    </html>
  `;

  res.send(page);
});

/**
 * 📌 KIS 주가 조회 API 프록시 (그대로 유지)
 */

app.post("/price", async (req, res) => {
  try {
    const { codes: codesParam, token } = req.body;

    if (!codesParam) {
      return res.status(400).json({ error: "codes 값이 필요합니다." });
    }

    const codes = codesParam
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (codes.length === 0) {
      return res.status(400).json({ error: "유효한 종목 코드가 없습니다." });
    }

    const results = await Promise.all(
      codes.map((code) =>
        fetchPrice(code, token).catch((err) => ({
          code,
          name: null,
          price: null,
          error: err.toString(),
        }))
      )
    );

    res.json({
      count: results.length,
      results,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.toString() });
  }
});

async function fetchPrice(code, token) {
  const url = `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      appkey: process.env.APP_KEY,
      appsecret: process.env.APP_SECRET,
      tr_id: "FHKST01010100",
    },
    qs: {
      fid_cond_mrkt_div_code: "J",
      fid_input_iscd: code,
    },
  });

  const data = await response.json();
  return data;
}

// 서버 시작
app.listen(3000, () => {
  console.log("KIS Proxy server running on port 3000");
});
