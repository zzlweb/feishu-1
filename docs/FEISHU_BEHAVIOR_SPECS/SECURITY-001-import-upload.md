# SECURITY-001 / 导入与上传边界

## 公开链接导入

- 只接受 `https://*.feishu.cn` 与 `https://*.larksuite.com`，端口只能为空或 443，禁止 URL 用户名/密码。
- 每次请求前解析全部 DNS 地址；任一结果为 loopback、私网、链路本地、保留或组播地址时拒绝。
- HTTP 客户端绑定到已验证的公网地址，避免校验后重新解析。
- 每次重定向重新执行域名和 DNS 校验，最多跟随 5 次。
- 响应正文最多 5MB，只接受 HTML/XHTML MIME。

## 文件上传

- 扩展名使用明确白名单；HTML、SVG、脚本和可执行文件不进入上传目录。
- 图片、音视频、PDF、Office/ZIP 和文本均检查文件头或文本特征，扩展名伪装会删除临时文件并返回错误。
- 服务端根据扩展名返回可信 MIME，不回显客户端伪造的 MIME。
- 可预览媒体使用 inline；其他文档按 attachment 下载。
- `/static/uploads` 返回 `nosniff`、sandbox CSP 与 same-origin 资源策略。

## 当前边界

- 资产仍位于共享目录，尚未建立 document/record 归属和引用计数。
- 文件删除、孤儿回收与上传中断恢复由 UPLOAD-002 继续实现。

## 自动化

- URL 规则、私网地址、合法相对跳转和跨域/HTTP 跳转拒绝。
- 合法 PNG 上传及隔离响应头。
- SVG 主动内容与伪装 PNG 拒绝。
