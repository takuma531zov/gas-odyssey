# packages/instagramDMtoSlack 改修
## 概要
現状Difyに投げていたメインの処理をGASで完結させたい

## 現状仕様
1. InstagramDM受信
2. InstagramWebhook発火
3. GASが中継
4. Difyワークフロー起動

### Dify側の処理
参照[packages/instagramDMtoSlack/INSTAGRAM_DM_TO_SLACK２.yml]

## 改修案
1. InstagramDM受信
2. InstagramWebhook発火
3. GASで処理完結

### GAS処理内容
基本機能は現状[packages/instagramDMtoSlack/INSTAGRAM_DM_TO_SLACK２.yml]と同一

#### 追加機能
- InstagramAPI認証時にトークンの有効期限切れを確認したら自動更新する仕様にしたい。
- 実行ログは"LOG_SHEET_NAME"に出力（GASと紐づいてるのでSHEET_ID指定不要）

## 経緯
InstagramAPIは仕様上無期限トークンを発行できない。
Difyはワークフロー内で環境変数を更新することができない。
GASはスクリプトプロパティを更新できる。

## Instagram API Token更新方法及びレスポンス
```
==== Query
  curl -i -X GET \
   "https://graph.instagram.com/refresh_access_token ?grant_type=ig_refresh_token&access_token=<現在のトークン>"
==== Access Token Info
  {
    "perms": [
      "instagram_business_basic",
      "instagram_business_manage_messages",
      "instagram_business_content_publish",
      "instagram_business_manage_insights",
      "instagram_business_manage_comments"
    ],
    "user_id": "USER_ID",
    "app_id": APP_ID
  }
==== Parameters
- Query Parameters


  {
    "grant_type": "ig_refresh_token"
  }
- POST Parameters


  {}
==== Response
  {
    "access_token": "<更新トークン>",
    "token_type": "bearer",
    "expires_in": 5127758,
    "permissions": "instagram_business_basic,instagram_business_manage_messages,instagram_business_content_publish,instagram_business_manage_insights,instagram_business_manage_comments"
  }
==== Debug Information from Graph API Explorer
- https://developers.facebook.com/tools/explorer/?domain=INSTAGRAM&method=GET&path=refresh_access_token%20%3Fgrant_type%3Dig_refresh_token&version=v24.0

```

## スクリプトプロパティ
要参照[packages/instagramDMtoSlack/src/env.ts]
DIFY_WEBHOOK_URLは改修完了後削除
