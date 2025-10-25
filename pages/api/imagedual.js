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
  const index1 = (2*(id - 1)) % sorted.length;
  const index2 = ((2*(id - 1))+1) % sorted.length;
  const target1 = sorted[index1];
  const target2 = sorted[index2];


  // 🔹 ファイルをダウンロード
   const [{ data: d1 }, { data: d2 }] = await Promise.all([
    supabase.storage.from(bucket).download(target1.name),
    supabase.storage.from(bucket).download(target2.name),
  ]);

  if (!d1 || !d2) {
    return res.status(404).json({ error: "Failed to download both images" });
  }


  // 🔹 Sharpでリサイズ
  const b1 = Buffer.from(await d1.arrayBuffer());
  const b2 = Buffer.from(await d2.arrayBuffer());

  const resized1 = await sharp(b1)
    .resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true })
    .toBuffer();

  const resized2 = await sharp(b2)
    .resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true })
    .toBuffer();
  
    // 🔹 メタデータ（幅・高さ）を取得
  const [meta1, meta2] = await Promise.all([
    sharp(resized1).metadata(),
    sharp(resized2).metadata(),
  ]);

  const maxWidth = Math.max(meta1.width, meta2.width);
  const totalHeight = meta1.height + meta2.height;

  // 🔹 新しいキャンバスを作って上下に合成
  const combined = await sharp({
    create: {
      width: maxWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: resized1, top: 0, left: Math.floor((maxWidth - meta1.width) / 2) },
      { input: resized2, top: meta1.height, left: Math.floor((maxWidth - meta2.width) / 2) },
    ])
    .png()
    .toBuffer();

  // 🔹 Sharpでリサイズ
  const resized = await sharp(combined)
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside", // 比率を保ちつつ収まるように
      withoutEnlargement: true, // 元より大きくしない
    })
  .toBuffer();

  // 🔹 レスポンス送信
  res.setHeader("Content-Type", "image/png");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="combined_${target1.name}_${target2.name}.png"`
  );
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(resized);
}
