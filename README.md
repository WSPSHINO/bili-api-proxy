# Bili Resolver 专用 API 代理

为当前 Worker 的 VERCEL_PROXY / PROXY_TOKEN 接口编写的独立 Vercel Node.js 服务。只转发普通视频所需的六个 api.bilibili.com API 路径，不中转视频文件，不支持直播。这是对 Worker 出口 412 问题的替代部署尝试，不保证 Vercel 出口一定成功，也不增加账号权限或画质。

## 部署

1. 在 GitHub 新建一个私人仓库，例如 bili-api-proxy。上传本目录全部文件，确保 package.json 和 api 目录位于仓库根目录，不多套一层目录。
2. Vercel 中 Add New / Project，导入此仓库。Framework Preset 选择 Other，Root Directory 保持仓库根目录。无前端构建步骤，不设置 dist 输出目录。
3. 在部署的 Environment Variables 添加 PROXY_TOKEN，值为自己用密码管理器生成的至少 32 位随机字符串（推荐 48 位）。选择 Production；不把值写进 GitHub，不发截图。之后修改变量需要重新部署。
4. Deploy 后取得固定 Production 域名，如 https://bili-api-proxy-xxxx.vercel.app。根路径 404 正常，本项目只有 /api/proxy。
5. Production API 需要允许机器直接访问，不能出现 Vercel 登录或交互式验证页。保留函数自身的 Token 鉴权。不要使用临时 Preview 链接。
6. Cloudflare 的 bili-resolver → Settings → Variables and Secrets 添加运行时变量：
   - VERCEL_PROXY（文本）：https://你的项目.vercel.app/api/proxy?url=
   - PROXY_TOKEN（Secret）：与 Vercel 完全相同的值。
   注意不是 Builds 下的构建变量。地址结尾必须保留 ?url=。
7. 保存并部署 Worker。访问原域名 /v 应显示两项已配置；保留先前 BILI_DIAG 日志。
8. 再解析一次普通公开视频，检查 Cloudflare BILI_DIAG 与 Vercel BILI_PROXY 日志。

## 验证与排障

- 本地 node --test 仅验证模拟上游：鉴权、精确目标限制、头转发、412 保留、拒绝重定向、大小上限。不等于实际 Vercel/B站/VRChat 验证。
- 未带 Token 打开 /api/proxy 返回 401 是预期；返回 HTML 登录页表示被部署保护挡住；503 表示 PROXY_TOKEN 缺失或太短。
- 401：核对两端密钥与部署保护；404：核对根目录、文件位置、生产域名及 /api/proxy 路径。
- BILI_PROXY 仍返回 412：Vercel 路径也失败，停止反复请求，不能声称修复成功。
- HTTP 200 仍需核对 B 站 JSON code 与 Worker 最终解析结果。视频信息成功不等于播放地址成功。
- 解析成功后验证网页音画、seek，再在 VRChat 两台客户端测试同步/晚加入。自建域名仍需观众允许不受信任 URL。

代理限制：12 秒上游超时、2 MiB 响应上限；HTTPS 精确主机与路径白名单；不跟随重定向；Token 不传给 B 站；不记录 Cookie/查询串/响应内容。没有分布式请求限额，观察 Vercel 用量并设置平台可用的费用通知/限额。Worker 前端仍是公开服务，代理 Token 不会自动让网页成为私人服务。

此文件包不修改原 Worker、不更改原域名。若回滚，删除 Worker 的 VERCEL_PROXY 与 PROXY_TOKEN 并重新部署。公开视频代理不提供会员登录或 4K 合并；仅处理你有权访问的内容。

运行时参考：https://vercel.com/docs/functions/runtimes/node-js
