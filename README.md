# 概要
このプログラムは Supabase Strage に保存された画像を配信するAPIです。　Vercelでの実行を想定しています。

Supabase Storage上の指定されたバケットから画像の一覧を取得して配信します。

アクセスは 

https://stream-image.vercel.app/api/image?id=1

というURLに対して行い、ID=1 で最後にUploadされた画像が表示されます。

# 環境変数

| 変数名               | 内容                        | 例                          |
| ----------------- | ------------------------- | -------------------------- |
| `SUPABASE_URL`    | Supabase プロジェクトのURL       | `https://xxxx.supabase.co` |
| `SUPABASE_KEY`    | Supabase のAPIキー | `eyJhbGciOi...`            |
| `SUPABASE_BUCKET` | 対象のストレージバケット名             | `images`                   |
