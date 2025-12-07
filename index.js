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
