import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  let { id } = req.query;
  id = parseInt(id, 10);

  if (!id || isNaN(id) || id < 1) {
    return res.status(400).json({ error: "Invalid ?id parameter" });
  }

  const bucket = process.env.SUPABASE_BUCKET;

  // 🔹 バケット内のファイル一覧取得
  const { data: files, error: listError } = await supabase.storage
    .from(bucket)
    .list("", { limit: 100 });

  if (listError || !files || files.length === 0) {
    return res.status(404).json({ error: "No files found in bucket" });
  }
  
  console.log(files);

  // 🔹 画像ファイルのみ抽出
  const sorted = files
    .filter((f) => {
      const ext = f.name.split(".").pop().toLowerCase();
      return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
    })
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

  if (sorted.length === 0) {
    return res.status(404).json({ error: "No valid image files found" });
  }

  console.log(sorted);

  // 🔹 idを循環
  const index = (id - 1) % sorted.length;
  const target = sorted[index];

  // 🔹 ファイルをダウンロード
  const { data, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(target.name);

  if (downloadError || !data) {
    return res.status(404).json({ error: "Failed to download file" });
  }

  // 🔹 Content-Type 判定
  const ext = target.name.split(".").pop().toLowerCase();
  const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;

  // 🔹 Sharpでリサイズ
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const resized = await sharp(buffer)
    .resize({
      width: 1920,
      height: 1080,
      fit: "inside", // 比率を保ちつつ収まるように
      withoutEnlargement: true, // 元より大きくしない
    })
    .toBuffer();

  // 🔹 レスポンス
  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${target.name.replace(/"/g, '\\"')}"`
  );
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(resized);
}
