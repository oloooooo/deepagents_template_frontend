# API 客户端：手写薄封装 + 生成类型，不做全量代码生成

后端有 `openapi.json`，但客户端不走 `openapi-typescript-codegen` 这类全量生成器：
后端路径风格是「一个操作一条独立路径」（`/microservices/create`、`/chat/send`），
不是 REST 资源风格，生成器产出的资源式客户端与真实接口对不上，包一层等于写两遍。
决定：请求函数按端点手写薄封装（35 个端点，一端点一函数），只让
`openapi-typescript` 从 `openapi.json` 生成 `components/schemas` 的 TS 类型，
请求/响应结构复用生成类型、路径字符串手工维护。

难回头的原因：全部调用点都建立在这层手写封装上，且 `openapi.json` 更新需要
手动重跑生成；反直觉的原因是「明明有 schema 却不全量生成」。
