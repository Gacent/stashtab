


<!-- spec-superflow-phase-guard-start -->
# Phase Guard

**当前阶段**: closing | **工作流**: full

## ✅ 允许操作
- 运行验证（三维验证）
- 归档变更
- 合并 delta specs

## ⛔ 禁止操作
- 修改 execution-contract.md
- 执行新任务
- 修改 proposal.md, specs/, design.md

## 🔔 决策点
- DP-6: 验证失败 — 验证未通过时需用户决定
- DP-7: 归档确认 — 需用户确认归档
<!-- spec-superflow-phase-guard-end -->


<!-- spec-superflow-phase-guard-start -->
# Phase Guard

**当前阶段**: approved-for-build | **工作流**: full

## ✅ 允许操作
- 选择执行模式（TDD 或 SDD）
- 准备执行环境

## ⛔ 禁止操作
- 修改 execution-contract.md（需回退到 bridging）
- 修改 proposal.md, specs/, design.md, tasks.md

## 🔔 决策点
- DP-4: 执行模式选择 — 用户选择 TDD 或 SDD
<!-- spec-superflow-phase-guard-end -->
